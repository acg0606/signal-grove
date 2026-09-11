import { GENRES, newArena, validCommand, validSnapshot, type Arena, type Command, type Envelope } from './rules/concert'
import { MAX_WAITERS, type Enrollment } from './authority'
import { wallet } from './ledger'
export type Intent = { request: number; json: string }
/** Client keeps confirmed snapshots, never elects itself or calculates ranked outcomes. */
export class AuthorityClient {
  state: Arena
  notice = 'Connecting to the show server...'
  offset = 0
  roundTripMs = 0
  ready = false
  enrollment: Enrollment = { genre: null, position: 0, total: 0 }
  private enrollmentAt = -Infinity
  pending: { request: number; json: string; sent: number; at: number; envelope: Envelope } | null = null
  private lastSeen = -Infinity
  private lastStateTime = -Infinity
  private seq = 0
  private pingAt = -1
  private clockReady = false
  private out: Intent[] = []
  constructor(readonly id: string, now: number) {
    if (!wallet(id)) throw Error('A verified wallet identity is required')
    this.state = newArena(now, 'authority:waiting:0')
  }
  receiveState(raw: unknown, serverNow: number, ready: boolean, now: number) {
    if (!validSnapshot(raw) || !raw.match.startsWith('authority:') || !Number.isFinite(serverNow) || serverNow < this.lastStateTime || typeof ready !== 'boolean') return false
    if (raw.match === this.state.match && raw.version < this.state.version) return false
    if (raw.match !== this.state.match) { this.pending = null; this.out = [] }
    this.state = JSON.parse(JSON.stringify(raw)); this.lastSeen = now; this.lastStateTime = serverNow
    if (raw.phase !== 'result' && raw.players.some(p => p.id === this.id && !p.withdrawn && (!raw.finalists.length || raw.finalists.includes(p.genre)))) this.enrollment = { genre: null, position: 0, total: 0 }
    this.ready = ready
    if (!this.clockReady) this.offset = serverNow - now
    this.notice = ready ? 'Connected. Find your studio.' : 'Saving results or restoring the server. Please wait.'
    return true
  }
  receiveEnrollment(raw: unknown, serverNow: number) {
    if (!raw || typeof raw !== 'object' || !Number.isFinite(serverNow) || serverNow < this.enrollmentAt) return false
    const e = raw as Enrollment
    if ((e.genre !== null && !GENRES.includes(e.genre)) || !Number.isSafeInteger(e.position) || !Number.isSafeInteger(e.total)
      || e.total < 0 || e.total > MAX_WAITERS || e.position < 0 || e.position > e.total || (e.genre === null) !== (e.position === 0)) return false
    this.enrollment = { ...e }; this.enrollmentAt = serverNow; return true
  }
  command(command: Command, now: number) {
    this.tick(now)
    if (!validCommand(command) || (!this.ready && !(command.kind === 'leave' && this.enrollment.genre && now - this.lastSeen <= 4000))) return false
    if (this.pending && !(command.kind === 'note' && this.pending.envelope.command.kind === 'note')) return false
    const envelope: Envelope = { match: this.state.match, phase: this.state.phase, round: this.state.round, command }
    this.pending = { request: ++this.seq, json: JSON.stringify(envelope), envelope, sent: now, at: now }
    this.out.push({ request: this.pending.request, json: this.pending.json })
    this.notice = 'Waiting for server confirmation.'
    return true
  }
  ack(request: number, accepted: boolean) {
    if (request !== this.pending?.request || typeof accepted !== 'boolean') return
    this.pending = null; this.notice = accepted ? 'Confirmed.' : 'Not accepted. Check your position and note timing.'
  }
  ping(now: number) { this.pingAt = now; return { at: now } }
  pong(at: number, serverNow: number, now: number) {
    if (at !== this.pingAt || !Number.isFinite(serverNow) || now < at || now - at > 2000) return false
    this.roundTripMs = now - at; this.offset = serverNow - (now + at) / 2; this.clockReady = true; this.pingAt = -1
    return true
  }
  tick(now: number) {
    if (now - this.lastSeen > 4000) { this.ready = false; this.pending = null; this.out = []; this.clockReady = false; this.notice = 'Connection lost. Reconnecting; scores are not awarded offline.' }
    if (!this.pending) return
    const p = this.pending
    if (p.envelope.match !== this.state.match || p.envelope.phase !== this.state.phase || p.envelope.round !== this.state.round || now - p.at > 3000) {
      this.pending = null; this.notice = 'No confirmation. Continue with the next note.'; return
    }
    if (now - p.sent >= (p.envelope.command.kind === 'note' ? 100 : 600)) {
      p.sent = now; this.out.push({ request: p.request, json: p.json })
    }
  }
  drain() { const batch = this.out; this.out = []; return batch }
}
