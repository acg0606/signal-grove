import { VisitMemories, type Keepsake } from '../compatibility/concert-memories'
import { ATTRIBUTES, GENRES, total, type Genre } from './rules/concert'
export type Standing = { genre: Genre; humanShows: number; humanWins: number; humanDraws?: number; averageScore: number; exhibitionWins: number }
export class ServerNotebook extends VisitMemories {
  loaded = false
  status = 'Connecting to your saved covers...'
  standings: Standing[] = []
  // Never infer durable awards from a scene snapshot.
  override observe(..._args: Parameters<VisitMemories['observe']>) { return false }
  receive(raw: unknown) {
    if (!raw || typeof raw !== 'object') return false
    const p = raw as { album: Keepsake[]; standings: Standing[]; scope: string }
    const uint = (n: number) => Number.isSafeInteger(n) && n >= 0
    if (p.scope !== 'LAB_PILOT' || !Array.isArray(p.album) || p.album.length > 8 || !Array.isArray(p.standings) || p.standings.length !== GENRES.length) return false
    if (p.album.some(k => !k || !GENRES.includes(k.genre) || typeof k.match !== 'string' || k.match.length > 180 || !/^\d{4}-\d{2}-\d{2}$/.test(k.date)
      || k.kind !== 'ILLUSTRATED_KEEPSAKE' || !['HUMAN_MATCH', 'BOT_EXHIBITION'].includes(k.mode) || !k.attributes || ATTRIBUTES.some(a => !Number.isFinite(k.attributes[a]) || k.attributes[a] < 0 || k.attributes[a] > 100))) return false
    if (new Set(p.standings.map(s => s?.genre)).size !== GENRES.length || p.standings.some(s => !s || !GENRES.includes(s.genre) || !uint(s.humanShows) || !uint(s.humanWins) || !uint(s.humanDraws ?? 0) || s.humanWins + (s.humanDraws ?? 0) > s.humanShows || !uint(s.exhibitionWins) || !Number.isFinite(s.averageScore) || s.averageScore < 0 || s.averageScore > 400)) return false
    this.album.splice(0, this.album.length, ...p.album.map(k => ({ ...k, attributes: { ...k.attributes }, score: total(k.attributes) })))
    this.standings = p.standings.map(s => ({ ...s }))
    for (const s of this.standings) this.wins[s.genre] = { human: s.humanWins, exhibition: s.exhibitionWins }
    this.loaded = true; this.status = 'Saved by the server · pilot season'
    return true
  }
}
