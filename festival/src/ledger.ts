import { ATTRIBUTES, GENRES, combine, total, validSnapshot, type Arena, type Attributes, type Genre } from './rules/concert'

export interface Store { get(key: string): Promise<string | undefined>; set(key: string, value: string): Promise<boolean> }
export type Result = { match: string; at: number; winner: Genre | 'draw'; mode: Arena['mode']; crews: { genre: Genre; attributes: Attributes }[]; players: { id: string; genre: Genre }[] }
type Journal = { schema: 1; results: Result[] }
type Head = { schema: 2; archives: number; results: Result[] }
export const JOURNAL_KEY = 'affinity-festival-season-v011-journal-v1'
// Each sealed page retains deduplication receipts; the active page never grows unbounded.
export const MAX_RESULTS = 256
export const archiveKey = (page: number) => `${JOURNAL_KEY}-archive-${page}`
export const wallet = (id: unknown): id is string => typeof id === 'string' && /^0x[0-9a-f]{40}$/.test(id)
function resultOf(s: Arena): Result | null {
  if (!validSnapshot(s) || s.phase !== 'result' || !s.winner || s.finalists.length !== 2) return null
  s = { ...s, crews: s.crews.filter(c => s.finalists.includes(c.genre)), players: s.players.filter(p => s.finalists.includes(p.genre)) }
  if (s.crews.length !== 2 || s.players.length !== 4) return null
  if (new Set(s.crews.map(c => c.genre)).size !== 2 || s.crews.some(c => s.players.filter(p => p.genre === c.genre).length !== 2)) return null
  if (s.players.some(p => !p.bot && !wallet(p.id)) || !s.players.some(p => !p.bot)) return null
  if ((s.mode === 'BOT_EXHIBITION') !== s.players.some(p => p.bot)) return null
  if (s.crews.some(c => ATTRIBUTES.some(k => c.final[k] !== combine(c.training, c.live)[k]))) return null
  const [a, b] = s.crews
  const expected = total(a.final) === total(b.final) ? 'draw' : total(a.final) > total(b.final) ? a.genre : b.genre
  if (expected !== s.winner) return null
  return { match: s.match, at: s.since, winner: s.winner, mode: s.mode,
    crews: s.crews.map(c => ({ genre: c.genre, attributes: { ...c.final } })),
    players: s.players.filter(p => !p.bot).map(p => ({ id: p.id, genre: p.genre })) }
}
function validResult(r: Result) {
  return !!r && typeof r.match === 'string' && r.match.length > 0 && r.match.length <= 180 && Number.isFinite(r.at)
    && r.at >= 0 && (r.winner === 'draw' || GENRES.includes(r.winner)) && ['HUMAN_MATCH', 'BOT_EXHIBITION'].includes(r.mode)
    && Array.isArray(r.crews) && r.crews.length === 2 && new Set(r.crews.map(c => c?.genre)).size === 2
    && r.crews.every(c => c && GENRES.includes(c.genre) && c.attributes && ATTRIBUTES.every(k => Number.isFinite(c.attributes[k]) && c.attributes[k] >= 0 && c.attributes[k] <= 100))
    && (r.winner === 'draw' ? total(r.crews[0].attributes) === total(r.crews[1].attributes)
      : r.crews.some(c => c.genre === r.winner && r.crews.every(other => other === c || total(c.attributes) > total(other.attributes))))
    && Array.isArray(r.players) && r.players.length > 0 && r.players.length <= 4 && (r.mode !== 'HUMAN_MATCH' || r.players.length === 4)
    && new Set(r.players.map(p => p?.id)).size === r.players.length
    && r.players.every(p => p && wallet(p.id) && r.crews.some(c => c.genre === p.genre) && r.players.filter(q => q.genre === p.genre).length <= 2)
}
/** Single-writer checkpoint journal: rankings and personal albums derive from one durable write. */
export class ResultLedger {
  private journal: Journal = { schema: 1, results: [] }
  private head: Head = { schema: 2, archives: 0, results: [] }
  private serial: Promise<unknown> = Promise.resolve()
  ready = false
  error = ''
  constructor(private store: Store) {}
  async load() {
    this.ready = false
    try {
      const raw = await this.store.get(JOURNAL_KEY)
      const parsed = raw === undefined ? { schema: 1, results: [] } : JSON.parse(raw)
      const validPage = (page: Journal) => Array.isArray(page?.results) && page.results.length <= MAX_RESULTS && page.results.every(validResult)
      if (![1, 2].includes(parsed?.schema) || !validPage(parsed)) throw Error('Unknown or invalid journal; preserving stored data')
      const archives = parsed.schema === 1 ? 0 : parsed.archives
      if (!Number.isSafeInteger(archives) || archives < 0) throw Error('Invalid archive index')
      const results: Result[] = []
      // Sequential reads stay below the host-call concurrency limit. Never assume a
      // missing archive is empty: a confirmed head promises that it was committed.
      for (let page = 0; page < archives; page++) {
        const rawPage = await this.store.get(archiveKey(page))
        if (rawPage === undefined) throw Error('Missing committed archive; preserving data')
        const sealed = JSON.parse(rawPage)
        if (sealed?.schema !== 1 || !validPage(sealed) || sealed.results.length !== MAX_RESULTS) throw Error('Invalid committed archive')
        results.push(...sealed.results)
      }
      results.push(...parsed.results)
      if (new Set(results.map(r => r.match)).size !== results.length) throw Error('Duplicate stored result')
      this.head = { schema: 2, archives, results: parsed.results }
      this.journal = { schema: 1, results }; this.ready = true; this.error = ''
    } catch (e) { this.error = String(e) }
    return this.ready
  }
  record(s: Arena): Promise<'saved' | 'duplicate' | 'ignored' | 'retry'> {
    // Snapshot before any await: callers cannot mutate a pending result.
    const result = resultOf(s)
    const job = this.serial.then(async () => {
      if (!result) return 'ignored' as const
      if (!this.ready) return 'retry' as const
      if (this.journal.results.some(r => r.match === result.match)) return 'duplicate' as const
      try {
        let archives = this.head.archives, active = this.head.results
        if (active.length === MAX_RESULTS) {
          const key = archiveKey(archives), sealed = JSON.stringify({ schema: 1, results: active })
          const existing = await this.store.get(key)
          // A failed head write can leave an unreferenced archive. Reuse only an
          // identical page on retry; never overwrite conflicting saved history.
          if (existing !== undefined && existing !== sealed) throw Error('Archive conflict; preserving stored history')
          if (existing === undefined && !await this.store.set(key, sealed)) throw Error('Archive not persisted')
          archives++; active = []
        }
        const next: Head = { schema: 2, archives, results: [...active, result] }
        if (!await this.store.set(JOURNAL_KEY, JSON.stringify(next))) throw Error('Checkpoint not persisted')
        this.head = next
      } catch (e) { this.error = String(e); return 'retry' as const }
      this.journal = { schema: 1, results: [...this.journal.results, result] }; this.error = ''; return 'saved' as const
    })
    this.serial = job.catch(() => undefined)
    return job
  }
  album(id: string) {
    if (!wallet(id)) return []
    return this.journal.results.filter(r => r.players.some(p => p.id === id && p.genre === r.winner)).slice(-24).reverse().map(r => ({
      match: r.match, date: new Date(r.at).toISOString().slice(0, 10), genre: r.winner as Genre,
      attributes: { ...r.crews.find(c => c.genre === r.winner)!.attributes }, mode: r.mode, kind: 'ILLUSTRATED_KEEPSAKE' as const
    }))
  }
  standings() {
    return GENRES.map(genre => {
      const human = this.journal.results.filter(r => r.mode === 'HUMAN_MATCH' && r.crews.some(c => c.genre === genre))
      return { genre, humanShows: human.length, humanWins: human.filter(r => r.winner === genre).length,
        humanDraws: human.filter(r => r.winner === 'draw').length,
        averageScore: human.length ? Math.round(human.reduce((sum, r) => sum + total(r.crews.find(c => c.genre === genre)!.attributes), 0) / human.length * 100) / 100 : 0,
        exhibitionWins: this.journal.results.filter(r => r.mode === 'BOT_EXHIBITION' && r.winner === genre).length }
    })
  }
}
