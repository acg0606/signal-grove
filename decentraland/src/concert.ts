/** v0.8 walk-up concert. Stage readiness is separate from rehearsal. */
import { GENRES, GENRE_NAMES, validId, type Genre } from './arena'
import { hitCount, noteLane, noteTime, recordNote } from './rhythm'
export { GENRES, GENRE_NAMES, validId, type Genre }
export const QUEUE_MS = 10000, TRAINING_MS = 7000, TURN_MS = 12000, RESULT_MS = 24000, INTERMISSION_MS = 120000
export const TRAINING_ROUNDS = 3, BATTLE_ROUNDS = 5
export const ATTRIBUTES = ['rhythm', 'precision', 'harmony', 'consistency'] as const
export type Attributes = Record<typeof ATTRIBUTES[number], number>
export type Phase = 'lobby' | 'training' | 'intermission' | 'battle' | 'result'
export type Member = { id: string; genre: Genre; ready: boolean; bot: boolean }
export type Crew = { genre: Genre; training: Attributes; live: Attributes; final: Attributes }
export type Arena = {
  match: string; version: number; phase: Phase; round: number; since: number; seed: number
  queueAt: number | null; players: Member[]; crews: Crew[]; choices: Record<string, number>
  mode: 'HUMAN_MATCH' | 'BOT_EXHIBITION'; winner: Genre | 'draw' | null; log: string[]
}
export type Command = { kind: 'join'; genre: Genre } | { kind: 'ready' } | { kind: 'leave' }
  | { kind: 'note'; value: number; index: number }
export type Envelope = { match: string; phase: Phase; round: number; command: Command }
const integer = (v: unknown, low: number, high: number): v is number => Number.isSafeInteger(v) && Number(v) >= low && Number(v) <= high
const empty = (): Attributes => ({ rhythm: 0, precision: 0, harmony: 0, consistency: 0 })
export function validCommand(v: unknown): v is Command {
  if (!v || typeof v !== 'object') return false
  const c = v as Command
  return c.kind === 'join' ? GENRES.includes(c.genre) : c.kind === 'note' ? integer(c.index, 0, 3) && integer(c.value, 0, 2) : c.kind === 'leave' || c.kind === 'ready'
}
export function newArena(now: number, match: string, seed = 1): Arena {
  return { match, version: 0, phase: 'lobby', round: 0, since: now, seed: seed >>> 0, queueAt: null,
    players: [], crews: [], choices: {}, mode: 'HUMAN_MATCH', winner: null, log: ['Walk to a studio instrument. Empty seats become labeled bots after 10 seconds.'] }
}
function clone(s: Arena): Arena { return { ...s, version: s.version + 1, players: s.players.map(p => ({ ...p })),
  crews: s.crews.map(c => ({ ...c, training: { ...c.training }, live: { ...c.live }, final: { ...c.final } })), choices: { ...s.choices }, log: [...s.log] } }
export function cueFor(s: Arena, id: string, i: number) {
  const m = s.players.find(p => p.id === id)
  return noteLane(s.seed, s.round, s.players.filter(p => p.genre === m?.genre).findIndex(p => p.id === id), i)
}
export function applyCommand(s: Arena, id: string, e: Envelope, now: number): Arena {
  if (!validId(id) || id.startsWith('bot:') || !e || !validCommand(e.command) || e.match !== s.match || e.phase !== s.phase || e.round !== s.round || !Number.isFinite(now) || now < s.since) return s
  const c = e.command, m = s.players.find(p => p.id === id)
  if (c.kind === 'leave') {
    if (!m || s.phase === 'result') return s
    const n = clone(s)
    if (s.phase === 'lobby') { n.players = n.players.filter(p => p.id !== id); if (!n.players.length) n.queueAt = null }
    else { n.phase = 'result'; n.since = now; n.winner = null; n.log = ['Show cancelled: a real player left. No winner.'] }
    return n
  }
  if (c.kind === 'join') {
    if (s.phase !== 'lobby' || m || s.players.length >= 4 || s.players.filter(p => p.genre === c.genre).length >= 2 || (new Set(s.players.map(p => p.genre)).size >= 2 && !s.players.some(p => p.genre === c.genre))) return s
    const n = clone(s); n.players.push({ id, genre: c.genre, ready: true, bot: false }); n.queueAt ??= now; return n
  }
  if (!m || m.bot) return s
  if (c.kind === 'ready') {
    if (s.phase !== 'intermission' || m.ready) return s
    const n = clone(s); n.players.find(p => p.id === id)!.ready = true
    if (n.players.every(p => p.ready)) { n.phase = 'battle'; n.round = 0; n.since = now; n.choices = {}; n.log = ['All performers ready. Live stage counts 2x.'] }
    return n
  }
  if (c.kind !== 'note' || !['training', 'battle'].includes(s.phase)) return s
  const target = noteTime(s.round, c.index, s.phase === 'battle'), age = now - s.since
  const key = `${id}:notes`, mask = s.choices[key] ?? 0
  const next = recordNote(mask, c.index, c.value, cueFor(s, id, c.index), age, target)
  if (next === mask) return s
  const n = clone(s); n.choices[key] = next
  if (c.value === cueFor(s, id, c.index) && Math.abs(age - target) <= 120) n.choices[`${id}:perfect`] = (n.choices[`${id}:perfect`] ?? 0) | (1 << c.index)
  return n
}
function botMask(s: Arena, slot: number): { notes: number; perfect: number } {
  // Reproducible skill variation; neither player performance nor genre affects it.
  let notes = 15, perfect = 0
  for (let i = 0; i < 4; i++) {
    let x = (s.seed ^ ((s.round + 1) * 2654435761) ^ ((slot + 1) * 2246822519) ^ ((i + 1) * 3266489917) ^ (s.phase === 'battle' ? 0xabcdef : 0)) >>> 0
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5
    if ((x >>> 0) % 100 < 68) { notes |= 1 << (i + 4); if ((x >>> 0) % 100 < 38) perfect |= 1 << i }
  }
  return { notes, perfect }
}
function countBits(v: number) { let count = 0; for (let i = 0; i < 4; i++) if (v & (1 << i)) count++; return count }
function longest(mask: number) { let run = 0, best = 0; for (let i = 0; i < 4; i++) { run = mask & (1 << (i + 4)) ? run + 1 : 0; best = Math.max(best, run) } return best }
export function roundAttributes(a: number, b: number, perfectA: number, perfectB: number): Attributes {
  return { rhythm: (hitCount(a) + hitCount(b)) * 12.5,
    precision: (countBits(perfectA) + countBits(perfectB)) * 12.5,
    harmony: countBits((a >> 4) & (b >> 4)) * 25,
    consistency: (longest(a) + longest(b)) * 12.5 }
}
export function combine(training: Attributes, live: Attributes): Attributes {
  return Object.fromEntries(ATTRIBUTES.map(k => [k, Math.round((training[k] + 2 * live[k]) / 3 * 100) / 100])) as Attributes
}
export const total = (a: Attributes) => Math.round(ATTRIBUTES.reduce((sum, k) => sum + a[k], 0) * 100) / 100
function scoreRound(s: Arena) {
  s.players.forEach((p, slot) => { if (p.bot) { const b = botMask(s, slot); s.choices[`${p.id}:notes`] = b.notes; s.choices[`${p.id}:perfect`] = b.perfect } })
  for (const c of s.crews) {
    const [a, b] = s.players.filter(p => p.genre === c.genre)
    const scores = roundAttributes(s.choices[`${a.id}:notes`] ?? 0, s.choices[`${b.id}:notes`] ?? 0, s.choices[`${a.id}:perfect`] ?? 0, s.choices[`${b.id}:perfect`] ?? 0)
    const field = s.phase === 'training' ? 'training' : 'live'
    for (const k of ATTRIBUTES) c[field][k] = (c[field][k] * s.round + scores[k]) / (s.round + 1)
    c.final = combine(c.training, c.live)
  }
}
function startShow(s: Arena, now: number): Arena {
  const n = clone(s), genres = [...new Set(n.players.map(p => p.genre))]
  if (genres.length === 1) genres.push(GENRES[(GENRES.indexOf(genres[0]) + 1 + n.seed % 5) % GENRES.length])
  for (const g of genres) while (n.players.filter(p => p.genre === g).length < 2) n.players.push({ id: `bot:${g}:${n.players.length}`, genre: g, bot: true, ready: true })
  n.mode = n.players.some(p => p.bot) ? 'BOT_EXHIBITION' : 'HUMAN_MATCH'
  n.phase = 'training'; n.since = now; n.round = 0
  n.crews = genres.map(g => ({ genre: g, training: empty(), live: empty(), final: empty() }))
  n.log = [n.mode === 'BOT_EXHIBITION' ? 'EXHIBITION: labeled bots fill empty seats. No real-player win claim.' : 'Four real fans. Team show!', 'Train now. The main stage counts double.']
  return n
}
export function advance(s: Arena, now: number): Arena {
  if (!Number.isFinite(now) || now < s.since) return s
  if (s.phase === 'lobby') return s.players.length && (s.players.length === 4 || (s.queueAt !== null && now >= s.queueAt + QUEUE_MS)) ? startShow(s, now) : s
  if (s.phase === 'result') return now >= s.since + RESULT_MS ? newArena(now, `${s.match.slice(0, s.match.lastIndexOf(':'))}:${now}`, s.seed + 1) : s
  if (s.phase === 'intermission') {
    if (now < s.since + INTERMISSION_MS) return s
    const n = clone(s); n.phase = 'result'; n.since = now; n.winner = null; n.log = ['Show cancelled: performers did not reach the stage. No winner.']; return n
  }
  if (now < s.since + (s.phase === 'training' ? TRAINING_MS : TURN_MS)) return s
  const n = clone(s); scoreRound(n); n.choices = {}; n.since = now
  if (s.phase === 'training' && s.round + 1 === TRAINING_ROUNDS) { n.phase = 'intermission'; n.round = 0; n.players.forEach(p => { p.ready = p.bot }); n.log = ['Rehearsal complete. Review your attributes, then walk to the main-stage microphone.'] }
  else if (s.phase === 'battle' && s.round + 1 === BATTLE_ROUNDS) {
    n.phase = 'result'
    const [a, b] = n.crews.map(c => total(c.final))
    n.winner = a === b ? 'draw' : n.crews[a > b ? 0 : 1].genre
    n.log = [n.winner === 'draw' ? 'Equal scores. The crowd celebrates both crews!' : `${GENRE_NAMES[n.winner]} wins the show!`, 'Final = (studio + 2 x live) / 3. NPC crowd animation, not audience polling.']
  } else n.round++
  return n
}
export const publicSnapshot = (s: Arena): Arena => ({ ...clone(s), version: s.version })
export function validSnapshot(v: unknown): v is Arena {
  if (!v || typeof v !== 'object') return false
  const s = v as Arena
  if (typeof s.match !== 'string' || s.match.length > 180 || !integer(s.version, 0, 1e9) || !['lobby', 'training', 'intermission', 'battle', 'result'].includes(s.phase) || !integer(s.round, 0, 5) || !Number.isFinite(s.since) || !integer(s.seed, 0, 0xffffffff) || (s.queueAt !== null && !Number.isFinite(s.queueAt))) return false
  if (!['HUMAN_MATCH', 'BOT_EXHIBITION'].includes(s.mode) || !Array.isArray(s.players) || s.players.length > 4 || !Array.isArray(s.crews) || s.crews.length > 2 || !Array.isArray(s.log) || s.log.length > 5 || s.log.some(x => typeof x !== 'string' || x.length > 240)) return false
  if (s.players.some(p => !p || !validId(p.id) || !GENRES.includes(p.genre) || typeof p.bot !== 'boolean' || typeof p.ready !== 'boolean' || p.id.startsWith('bot:') !== p.bot) || new Set(s.players.map(p => p.id)).size !== s.players.length || new Set(s.players.map(p => p.genre)).size > 2 || s.players.some(p => s.players.filter(q => q.genre === p.genre).length > 2)) return false
  if (s.mode === 'HUMAN_MATCH' && s.players.some(p => p.bot)) return false
  if (s.crews.some(c => !c || !GENRES.includes(c.genre) || ['training', 'live', 'final'].some(f => !c[f as keyof Crew] || ATTRIBUTES.some(k => typeof (c as any)[f][k] !== 'number' || !Number.isFinite((c as any)[f][k]) || (c as any)[f][k] < 0 || (c as any)[f][k] > 100.001)))) return false
  if (!s.choices || typeof s.choices !== 'object' || Array.isArray(s.choices) || Object.keys(s.choices).length > 8 || Object.entries(s.choices).some(([k, v]) => !s.players.some(p => k === `${p.id}:notes` || k === `${p.id}:perfect`) || !integer(v, 0, k.endsWith(':notes') ? 255 : 15))) return false
  if (s.winner !== null && s.winner !== 'draw' && !s.crews.some(c => c.genre === s.winner)) return false
  if (['training', 'intermission', 'battle'].includes(s.phase) && (s.players.length !== 4 || s.crews.length !== 2 || new Set(s.crews.map(c => c.genre)).size !== 2 || s.crews.some(c => s.players.filter(p => p.genre === c.genre).length !== 2))) return false
  return true
}
