import { advance, applyCommand, newArena, publicSnapshot, validCommand, validId, validSnapshot, type Arena, type Command, type Envelope } from './arena'
import { noteTime, LATE_MS } from './rhythm'
const LEASE = 8000
export const CHANNEL = 'affinity-arena-v2-rhythm'
export type Packet = { kind: 'hello'; incarnation: number } | { kind: 'state'; state: Arena; time: number }
  | { kind: 'ping'; target: string; at: number } | { kind: 'pong'; target: string; at: number; time: number }
  | { kind: 'command'; target: string; incarnation: number; seq: number; envelope: Envelope }
  | { kind: 'ack'; target: string; incarnation: number; seq: number; accepted: boolean }
export class ArenaSession {
  state: Arena
  host = ''
  notice = 'Connecting to the arena...'
  offset = 0
  roundTripMs = 0
  private pingAt = -1
  private clockReady = false
  pending: { packet: Extract<Packet, { kind: 'command' }>; at: number; sent: number } | null = null
  private peers = new Map<string, number>()
  private incarnations = new Map<string, number>()
  private incarnation: number
  private seq = 0
  private seen = new Map<string, { seq: number; accepted: boolean }>()
  private lastBeat = -Infinity
  private outbox: Packet[] = []
  constructor(readonly id: string, now: number) {
    if (!validId(id)) throw new Error('Invalid player identity')
    this.state = newArena(now, `${id}:${now}`, now >>> 0)
    this.incarnation = now
    this.incarnations.set(id, now)
    this.peers.set(id, now)
  }
  drain(): Packet[] { const batch = this.outbox; this.outbox = []; return batch }
  private broadcast(now: number) { this.outbox.push({ kind: 'state', state: publicSnapshot(this.state), time: now }) }
  private elect(now: number) {
    this.peers.set(this.id, now)
    for (const [id, at] of this.peers) if (now - at > LEASE) { this.peers.delete(id); this.seen.delete(id); this.incarnations.delete(id) }
    const next = this.state.phase !== 'lobby' && this.peers.has(this.host) ? this.host : [...this.peers.keys()].sort()[0]
    if (next !== this.host) {
      const changed = !!this.host
      this.host = next; this.pending = null; this.seen.clear(); this.offset = 0; this.clockReady = false; this.pingAt = -1
      this.state = newArena(now, `${next}:${next === this.id ? now : 0}`, now >>> 0)
      this.notice = changed ? 'Connection changed. Rejoin your crew; no winner awarded.' : 'Choose a music crew, then Ready.'
      if (this.host === this.id) this.broadcast(now)
    }
  }
  tick(now: number) {
    this.elect(now)
    if (this.host === this.id) {
      for (const p of this.state.players) {
        if (!this.peers.has(p.id) && this.state.phase !== 'result') {
          this.state = applyCommand(this.state, p.id, this.envelope({ kind: 'leave' }), now)
        }
      }
      const next = advance(this.state, now)
      if (next !== this.state) { this.state = next; this.broadcast(now) }
    }
    if (now - this.lastBeat >= 1000) {
      this.lastBeat = now; this.outbox.push({ kind: 'hello', incarnation: this.incarnation })
      if (this.host !== this.id) { this.pingAt = now; this.outbox.push({ kind: 'ping', target: this.host, at: now }) }
      if (this.host === this.id) this.broadcast(now)
    }
    if (this.pending?.packet.envelope.command.kind === 'note') {
      const e = this.pending.packet.envelope, c = this.pending.packet.envelope.command
      if (e.match !== this.state.match || e.phase !== this.state.phase || e.round !== this.state.round || now + this.offset > this.state.since + noteTime(e.round, c.index, e.phase === 'battle') + LATE_MS + this.roundTripMs / 2 + 50) {
        this.pending = null; this.notice = 'Note window closed. Follow the next note.'
      }
    }
    if (this.pending && now - this.pending.at > 5000) { this.pending = null; this.notice = 'No confirmation. Check your connection and try again.' }
    if (this.pending && now - this.pending.sent >= (this.pending.packet.envelope.command.kind === 'note' ? 80 : 600)) { this.pending.sent = now; this.outbox.push(this.pending.packet) }
  }
  envelope(command: Command): Envelope { return { match: this.state.match, phase: this.state.phase, round: this.state.round, command } }
  command(command: Command, now: number) {
    if (!this.host || !validCommand(command)) return
    // A lost note ACK must not prevent playing the next note. Older ACKs may
    // arrive later; only the current intent receives UI confirmation.
    if (this.pending && !(command.kind === 'note' && this.pending.packet.envelope.command.kind === 'note')) return
    const packet: Extract<Packet, { kind: 'command' }> = { kind: 'command', target: this.host, incarnation: this.incarnation, seq: ++this.seq, envelope: this.envelope(command) }
    this.pending = { packet, at: now, sent: now }; this.notice = 'Sending choice...'
    if (this.host === this.id) this.receive(packet, this.id, now)
    else this.outbox.push(packet)
  }
  receive(raw: unknown, sender: string, now: number) {
    if (!validId(sender) || !raw || typeof raw !== 'object') return
    let size: number
    try { size = JSON.stringify(raw).length } catch { return }
    if (size > 12000) return
    const p = raw as Packet
    if (p.kind === 'hello') {
      if (this.peers.size >= 32 && !this.peers.has(sender)) return
      if (!Number.isSafeInteger(p.incarnation) || p.incarnation < 0 || p.incarnation > now + 300000) return
      const old = this.incarnations.get(sender)
      if (old !== undefined && p.incarnation < old) return
      if (old !== p.incarnation) { this.seen.delete(sender); this.incarnations.set(sender, p.incarnation) }
      this.peers.set(sender, now); this.elect(now)
      if (this.host === this.id) this.broadcast(now)
      return
    }
    if (!this.peers.has(sender)) return
    if (p.kind === 'ping') {
      if (this.host === this.id && p.target === this.id && Number.isFinite(p.at)) this.outbox.push({ kind: 'pong', target: sender, at: p.at, time: now })
      return
    }
    if (p.kind === 'pong') {
      if (sender === this.host && p.target === this.id && p.at === this.pingAt && Number.isFinite(p.time) && now >= p.at && now - p.at <= 2000) {
        this.roundTripMs = now - p.at
        this.offset = p.time - (now + p.at) / 2
        this.clockReady = true; this.pingAt = -1
      }
      return
    }
    if (p.kind === 'state') {
      if (sender === this.id || !Number.isFinite(p.time) || !validSnapshot(p.state) || !p.state.match.startsWith(`${sender}:`)) return
      // New spectators discover the running coordinator instead of restarting it.
      if (sender !== this.host) {
        if (this.state.phase !== 'lobby' || this.state.players.length !== 0 || !['training', 'battle', 'result'].includes(p.state.phase)) return
        this.host = sender; this.pending = null; this.clockReady = false; this.state = newArena(now, `${sender}:0`)
      }
      // Host match identifiers end with a monotonically increasing timestamp.
      const oldEpoch = Number(this.state.match.slice(this.state.match.lastIndexOf(':') + 1))
      const newEpoch = Number(p.state.match.slice(p.state.match.lastIndexOf(':') + 1))
      if (!Number.isFinite(newEpoch) || (this.state.match.startsWith(`${sender}:`) && newEpoch < oldEpoch)) return
      if (p.state.match === this.state.match && p.state.version < this.state.version) return
      this.state = p.state; if (!this.clockReady) this.offset = p.time - now
    } else if (p.kind === 'command') {
      if (this.host !== this.id || p.target !== this.id || p.incarnation !== this.incarnations.get(sender) || !Number.isSafeInteger(p.seq) || p.seq < 1 || !p.envelope || !validCommand(p.envelope.command)) return
      const prior = this.seen.get(sender)
      if (prior && p.seq <= prior.seq) {
        if (p.seq === prior.seq) this.ack(sender, p.incarnation, p.seq, prior.accepted)
        return
      }
      const next = applyCommand(this.state, sender, p.envelope, now), accepted = next !== this.state
      this.state = next; this.seen.set(sender, { seq: p.seq, accepted }); this.ack(sender, p.incarnation, p.seq, accepted)
      if (accepted) this.broadcast(now)
    } else if (p.kind === 'ack' && sender === this.host && p.target === this.id && p.incarnation === this.incarnation && p.seq === this.pending?.packet.seq && typeof p.accepted === 'boolean') {
      this.pending = null
      this.notice = p.accepted ? 'Confirmed.' : 'Not accepted: crew full, round closed, or choice already locked.'
    }
  }
  private ack(target: string, incarnation: number, seq: number, accepted: boolean) {
    const p: Packet = { kind: 'ack', target, incarnation, seq, accepted }
    if (target === this.id) this.receive(p, this.id, this.state.since)
    else this.outbox.push(p)
  }
}
