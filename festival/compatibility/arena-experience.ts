import { type Arena, type Genre, GENRE_NAMES, CARD_PICK_MS, TRAINING_MS, TURN_MS, RESULT_MS } from './arena'
import { noteLane, noteTime, recordNote, hitCount, EARLY_MS, LATE_MS } from './rhythm'

/** Local-only rehearsal. Never creates a player, command, team resource or packet. */
export class Warmup {
  mask = 0
  feedback = 'Watch the gold line. Tap C, E or G when the note reaches it.'
  constructor(readonly startedAt: number, readonly round = 0) {}
  age(now: number) { return Math.max(0, now - this.startedAt) }
  done(now: number) { return this.age(now) >= TRAINING_MS }
  lane(index: number) { return noteLane(0, this.round, 0, index) }
  get hits() { return hitCount(this.mask) }
  tap(lane: number, now: number) {
    if (this.done(now) || !Number.isInteger(lane) || lane < 0 || lane > 2) return
    const age = this.age(now)
    const index = [0, 1, 2, 3].filter(i => !(this.mask & (1 << i)) && age >= noteTime(this.round, i) - EARLY_MS && age <= noteTime(this.round, i) + LATE_MS)
      .sort((a, b) => Math.abs(age - noteTime(this.round, a)) - Math.abs(age - noteTime(this.round, b)))[0]
    if (index === undefined) { this.feedback = 'Wait for the note to reach the gold line.'; return }
    this.mask = recordNote(this.mask, index, lane, this.lane(index), age, noteTime(this.round, index))
    this.feedback = lane !== this.lane(index) ? 'Wrong lane. Follow the letter on the next note.'
      : Math.abs(age - noteTime(this.round, index)) <= 80 ? 'ON THE MARK. Keep that rhythm!' : 'ON BEAT. Keep the rhythm going!'
  }
}

export function crewAvailability(s: Arena, id: string, genre: Genre, pending = false) {
  const me = s.players.find(p => p.id === id), count = s.players.filter(p => p.genre === genre).length
  const crews = new Set(s.players.map(p => p.genre))
  const selected = me?.genre === genre
  const reason = selected ? (me.ready ? 'Ready' : 'Your crew') : count >= 2 ? 'Crew full'
    : me ? 'Leave to switch' : crews.size >= 2 && !crews.has(genre) ? 'Next match' : 'Join crew'
  return { count, selected, reason, enabled: !pending && !me && s.phase === 'lobby' && count < 2 && (crews.has(genre) || crews.size < 2) }
}

export function lobbyHint(s: Arena, id: string) {
  const me = s.players.find(p => p.id === id)
  if (!me) return 'Pick your music crew. All genres have equal power.'
  if (!me.ready) return `${GENRE_NAMES[me.genre]} is your crew. Ready when you are.`
  const missing = 4 - s.players.length
  if (missing) return `Waiting for ${missing} more ${missing === 1 ? 'fan' : 'fans'}. Try a solo warm-up.`
  return 'Both crews are here. Waiting for everyone to be ready.'
}

export function phaseCue(s: Arena, now: number) {
  const age = Math.max(0, now - s.since)
  const duration = s.phase === 'training' ? TRAINING_MS : s.phase === 'battle' ? TURN_MS : RESULT_MS
  const seconds = Math.max(0, Math.ceil((duration - age) / 1000))
  const progress = s.phase === 'lobby' ? s.players.filter(p => p.ready).length / 4 : Math.min(1, age / duration)
  const text = s.phase === 'lobby' ? 'Find your crew'
    : s.phase === 'training' ? age < 2000 ? `Get ready. Rehearsal ${s.round + 1} / 6` : `Rehearsal ${s.round + 1} / 6  ·  ${seconds}s`
    : s.phase === 'battle' ? age < CARD_PICK_MS ? `Choose your card  ·  ${Math.ceil((CARD_PICK_MS - age) / 1000)}s`
      : age < 5000 ? 'Cards locked. Notes next.' : `Duel ${s.round + 1} / 5  ·  ${seconds}s`
    : s.winner === 'draw' ? 'A shared rhythm. A draw.' : s.winner ? `${GENRE_NAMES[s.winner]} wins!` : 'Match cancelled. No winner.'
  return { age, seconds, progress, text }
}

/** Suppress unchanged SDK component writes, not network events or scoring ticks. */
export class ChangeGate {
  private values = new Map<string, unknown>()
  changed(key: string, value: unknown) {
    if (this.values.has(key) && this.values.get(key) === value) return false
    this.values.set(key, value)
    return true
  }
}
