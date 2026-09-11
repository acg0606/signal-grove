import { advance, applyCommand, newArena, publicSnapshot, validCommand, type Envelope, type Genre } from './rules/concert'
import { nearPerformance, studioPosition, VENUE } from './rules/concert-sheet'
import { wallet } from './ledger'
export type Position = { x: number; z: number }
export const DISCONNECT_GRACE_MS = 12000
export const MAX_WAITERS = 24
export type Enrollment = { genre: Genre | null; position: number; total: number }
/** No peer election, client scores, client clocks or self-reported positions. */
export class ConcertAuthority {
  private current
  private absent = new Map<string, number>()
  private waiting: { id: string; genre: Genre }[] = []
  constructor(now: number, boot: string) { this.current = newArena(now, `authority:${boot}:${now}`, now >>> 0) }
  get state() { return publicSnapshot(this.current) }
  enrollment(id: string): Enrollment {
    const i = this.waiting.findIndex(p => p.id === id)
    return { genre: i >= 0 ? this.waiting[i].genre : null, position: i + 1, total: this.waiting.length }
  }
  command(sender: string, envelope: Envelope, now: number, verifiedPosition?: Position) {
    if (!wallet(sender) || !envelope || !validCommand(envelope.command) || !Number.isFinite(now) || now < this.current.since
      || envelope.match !== this.current.match || envelope.phase !== this.current.phase || envelope.round !== this.current.round) return false
    const c = envelope.command
    const queued = this.waiting.findIndex(p => p.id === sender)
    if (c.kind === 'leave' && queued >= 0) { this.waiting.splice(queued, 1); this.absent.delete(sender); return true }
    if (c.kind !== 'leave') {
      if (!verifiedPosition || !Number.isFinite(verifiedPosition.x) || !Number.isFinite(verifiedPosition.z)) return false
      if (c.kind === 'join') {
        const studio = studioPosition(c.genre)
        if (Math.hypot(studio.x - verifiedPosition.x, studio.z - verifiedPosition.z) > 8) return false
      } else if (c.kind === 'ready') {
        const p = this.current.players.find(p => p.id === sender)
        const index = this.current.finalists.indexOf(p?.genre as Genre)
        if (index < 0 || Math.hypot(VENUE.stageXs[index] - verifiedPosition.x, VENUE.stagePlayZ - verifiedPosition.z) > 6) return false
      } else if (!nearPerformance(this.current, sender, verifiedPosition)) return false
    }
    if (c.kind === 'join') {
      const member = this.current.players.find(p => p.id === sender)
      const eliminated = member && this.current.finalists.length === 2 && !this.current.finalists.includes(member.genre)
      if (member && !eliminated && !member.withdrawn && this.current.phase !== 'result') return false
      if (queued >= 0) return this.waiting[queued].genre === c.genre
      // Existing waiters are not overtaken by a new walk-up enrollment.
      if (this.current.phase === 'lobby' && !this.waiting.length) {
        const joined = applyCommand(this.current, sender, envelope, now)
        if (joined !== this.current) { this.current = joined; return true }
      }
      if (this.waiting.length >= MAX_WAITERS) return false
      this.waiting.push({ id: sender, genre: c.genre })
      return true
    }
    const next = applyCommand(this.current, sender, envelope, now)
    const accepted = next !== this.current
    this.current = next
    return accepted
  }
  tick(now: number, verifiedConnected: Set<string>, verifiedPositions = new Map<string, Position>()) {
    if (!Number.isFinite(now) || now < this.current.since) return
    for (const p of [...this.current.players, ...this.waiting.map(p => ({ ...p, bot: false }))]) {
      if (p.bot || ('withdrawn' in p && p.withdrawn)) continue
      if (verifiedConnected.has(p.id)) this.absent.delete(p.id)
      else {
        if (!this.absent.has(p.id)) this.absent.set(p.id, now)
        if (now - this.absent.get(p.id)! >= DISCONNECT_GRACE_MS) {
          this.waiting = this.waiting.filter(q => q.id !== p.id)
          this.current = applyCommand(this.current, p.id,
            { match: this.current.match, phase: this.current.phase, round: this.current.round, command: { kind: 'leave' } }, now)
        }
      }
    }
    for (const id of this.absent.keys()) if (!this.current.players.some(p => p.id === id) && !this.waiting.some(p => p.id === id)) this.absent.delete(id)
    if (this.current.phase !== 'lobby') this.current = advance(this.current, now)
    if (this.current.phase === 'lobby') {
      const remaining: typeof this.waiting = []
      for (const p of this.waiting) {
        const position = verifiedPositions.get(p.id), studio = studioPosition(p.genre)
        if (!verifiedConnected.has(p.id) || !position || !Number.isFinite(position.x) || !Number.isFinite(position.z)
          || Math.hypot(studio.x - position.x, studio.z - position.z) > 8) { remaining.push(p); continue }
        const next = applyCommand(this.current, p.id, { match: this.current.match, phase: 'lobby', round: this.current.round, command: { kind: 'join', genre: p.genre } }, now)
        if (next === this.current) remaining.push(p)
        else this.current = next
      }
      this.waiting = remaining
      this.current = advance(this.current, now)
    }
  }
}
