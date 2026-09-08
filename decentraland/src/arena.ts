/** Affinity Arena: casual, realm-local cooperative preparation and team duel.
 * Pure rules: no SDK, clock reads, wallet operations, sound recordings or bots.
 */
export const GENRES = ['kpop', 'funk', 'latin', 'afrobeats', 'hiphop', 'electronic'] as const
export type Genre = typeof GENRES[number]
export const GENRE_NAMES: Record<Genre, string> = { kpop: 'K-pop', funk: 'Brazilian Funk', latin: 'Latin Urban', afrobeats: 'Afrobeats', hiphop: 'Hip-hop', electronic: 'Electronic' }
export const CARDS = ['attack', 'guard', 'charge', 'combo'] as const
export type Card = typeof CARDS[number]
export type Phase = 'lobby' | 'training' | 'battle' | 'result'
export const TRAINING_MS = 7000
export const CUE_MS = 2000
export const TURN_MS = 12000
export const RESULT_MS = 18000
export const TRAINING_ROUNDS = 6
export const BATTLE_ROUNDS = 5
export const MAX_PLAYERS = 4
export interface Member { id: string; genre: Genre; ready: boolean }
export interface Crew { genre: Genre; hp: number; energy: number; shield: number; hits: number; harmony: number }
export interface Arena {
  match: string; version: number; phase: Phase; round: number; since: number; seed: number
  players: Member[]; crews: Crew[]; choices: Record<string, number | Card>
  log: string[]; winner: Genre | 'draw' | null
}
export type Command = { kind: 'join'; genre: Genre } | { kind: 'ready' } | { kind: 'leave' }
  | { kind: 'beat'; value: number } | { kind: 'card'; value: Card }
export interface Envelope { match: string; phase: Phase; round: number; command: Command }
export function validId(id: unknown): id is string {
  return typeof id === 'string' && /^[a-z0-9:_-]{1,80}$/.test(id) && !['constructor', 'prototype', '__proto__'].includes(id)
}
const genre = (v: unknown): v is Genre => GENRES.includes(v as Genre)
const int = (v: unknown, min: number, max: number): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max
export function validCommand(value: unknown): value is Command {
  if (!value || typeof value !== 'object') return false
  const c = value as Command
  return c.kind === 'join' ? genre(c.genre) : c.kind === 'beat' ? int(c.value, 0, 2)
    : c.kind === 'card' ? CARDS.includes(c.value) : c.kind === 'ready' || c.kind === 'leave'
}
export function newArena(now: number, match: string, seed = 1): Arena {
  return { match, version: 0, phase: 'lobby', round: 0, since: now, seed: seed >>> 0, players: [], crews: [], choices: {}, log: ['Find your music crew. Two crews, two real people each.'], winner: null }
}
function copy(s: Arena): Arena { return { ...s, version: s.version + 1, players: s.players.map(p => ({ ...p })), crews: s.crews.map(c => ({ ...c })), choices: { ...s.choices }, log: [...s.log] } }
export function cueFor(s: Arena, id: string): number {
  const slot = s.players.findIndex(p => p.id === id)
  // Both teams receive equivalent patterns by teammate position, not genre.
  const member = s.players[slot]
  const lane = member ? s.players.filter(p => p.genre === member.genre).findIndex(p => p.id === id) : 0
  return ((s.seed % 3) + s.round + lane) % 3
}
export function applyCommand(s: Arena, id: string, e: Envelope, now: number): Arena {
  if (!validId(id) || !e || !validCommand(e.command) || e.match !== s.match || e.phase !== s.phase || e.round !== s.round || !Number.isFinite(now) || now < s.since) return s
  const command = e.command, member = s.players.find(p => p.id === id)
  if (command.kind === 'leave') {
    if (!member || s.phase === 'result') return s
    const n = copy(s)
    if (n.phase === 'lobby') n.players = n.players.filter(p => p.id !== id)
    else { n.phase = 'result'; n.since = now; n.winner = null; n.choices = {}; n.log = ['Match cancelled: a player left. No winner awarded.'] }
    return n
  }
  if (command.kind === 'join') {
    if (s.phase !== 'lobby' || member || s.players.length >= MAX_PLAYERS) return s
    const same = s.players.filter(p => p.genre === command.genre).length
    const genres = new Set(s.players.map(p => p.genre))
    if (same >= 2 || (!genres.has(command.genre) && genres.size >= 2)) return s
    const n = copy(s); n.players.push({ id, genre: command.genre, ready: false }); return n
  }
  if (!member) return s
  if (command.kind === 'ready') {
    if (s.phase !== 'lobby' || member.ready) return s
    const n = copy(s); n.players.find(p => p.id === id)!.ready = true
    if (n.players.length === 4 && n.players.every(p => p.ready) && new Set(n.players.map(p => p.genre)).size === 2) {
      n.phase = 'training'; n.since = now
      n.crews = [...new Set(n.players.map(p => p.genre))].map(g => ({ genre: g, hp: 100, energy: 4, shield: 0, hits: 0, harmony: 0 }))
      n.log = ['Watch your cue. Remember it, then tap together.']
    }
    return n
  }
  if (Object.prototype.hasOwnProperty.call(s.choices, id)) return s
  if (command.kind === 'beat') {
    if (s.phase !== 'training' || now < s.since + CUE_MS || now >= s.since + TRAINING_MS) return s
  } else if (command.kind === 'card') {
    if (s.phase !== 'battle' || now >= s.since + TURN_MS) return s
  } else return s
  const n = copy(s); n.choices[id] = command.value; return n
}
function train(s: Arena): void {
  s.log = []
  for (const crew of s.crews) {
    const members = s.players.filter(p => p.genre === crew.genre)
    const hits = members.filter(p => s.choices[p.id] === cueFor(s, p.id)).length
    crew.hits += hits
    if (hits === 2) crew.harmony++
    s.log.push(`${GENRE_NAMES[crew.genre]}: ${hits}/2 cues${hits === 2 ? ' - harmony!' : ''}`)
  }
}
function battle(s: Arena): void {
  const damage = [0, 0], protection = [0, 0]
  s.log = []
  s.crews.forEach((crew, i) => {
    // Per-player costs are independent: order cannot steal a teammate's energy.
    // Crew energy is spent only after summing the two requested cards.
    const cards = s.players.filter(p => p.genre === crew.genre).map(p => s.choices[p.id] as Card | undefined)
    const cost = cards.reduce((sum, c) => sum + (c === 'attack' ? 2 : c === 'combo' ? 3 : c === 'guard' ? 1 : 0), 0)
    const funded = cost <= crew.energy
    const attacks = cards.filter(c => c === 'attack').length
    const guards = cards.filter(c => c === 'guard').length
    const combos = cards.filter(c => c === 'combo').length
    const charges = cards.filter(c => c === 'charge').length
    if (funded) {
      crew.energy -= cost
      damage[i] = attacks * 13 + (combos === 2 ? 36 : combos * 5)
      protection[i] = guards * 10
    }
    crew.energy = Math.min(12, crew.energy + charges * 3 + 1)
    s.log.push(`${GENRE_NAMES[crew.genre]}: ${funded ? `${damage[i]} attack / ${protection[i]} guard` : 'not enough energy; paid cards fizzled'}${charges ? ' + recharge' : ''}`)
  })
  s.crews.forEach((crew, i) => {
    const hit = Math.max(0, damage[1 - i] - protection[i])
    const shieldHit = Math.min(crew.shield, hit)
    crew.shield -= shieldHit
    crew.hp = Math.max(0, crew.hp - (hit - shieldHit))
  })
}
export function advance(s: Arena, now: number): Arena {
  if (!Number.isFinite(now) || now < s.since) return s
  if (s.phase === 'result') return now >= s.since + RESULT_MS ? newArena(now, `${s.match.slice(0, s.match.lastIndexOf(':'))}:${now}`, s.seed + 1) : s
  if (s.phase === 'lobby' || now < s.since + (s.phase === 'training' ? TRAINING_MS : TURN_MS)) return s
  const n = copy(s)
  if (s.phase === 'training') {
    train(n)
    if (n.round + 1 === TRAINING_ROUNDS) {
      // Bounded preparation advantage: never a genre or team-size bonus.
      n.crews.forEach(c => { c.energy = 4 + Math.floor(c.hits / 3); c.shield = c.harmony * 2 })
      n.phase = 'battle'; n.round = 0
      n.log.push('Training complete. Spend shared energy together. Choices lock until reveal.')
    } else n.round++
  } else {
    battle(n)
    if (n.round + 1 >= BATTLE_ROUNDS || n.crews.some(c => c.hp === 0)) {
      n.phase = 'result'
      n.winner = n.crews[0].hp === n.crews[1].hp ? 'draw' : n.crews[n.crews[0].hp > n.crews[1].hp ? 0 : 1].genre
    } else n.round++
  }
  n.since = now; n.choices = {}; return n
}

/** Public snapshots intentionally redact all in-progress choices. */
export function publicSnapshot(s: Arena): Arena { return { ...s, choices: {} } }
export function validSnapshot(value: unknown): value is Arena {
  if (!value || typeof value !== 'object') return false
  const s = value as Arena
  if (typeof s.match !== 'string' || s.match.length > 160 || !int(s.version, 0, Number.MAX_SAFE_INTEGER) || !int(s.round, 0, 5) || !int(s.seed, 0, 4294967295)
    || !Number.isFinite(s.since) || !['lobby', 'training', 'battle', 'result'].includes(s.phase)
    || !Array.isArray(s.players) || s.players.length > 4 || !Array.isArray(s.crews) || s.crews.length > 2
    || !s.choices || typeof s.choices !== 'object' || Object.keys(s.choices).length !== 0
    || !Array.isArray(s.log) || s.log.length > 4 || !s.log.every(t => typeof t === 'string' && t.length <= 240)
    || !(s.winner === null || s.winner === 'draw' || genre(s.winner))) return false
  if (!s.players.every(p => p && validId(p.id) && genre(p.genre) && typeof p.ready === 'boolean') || new Set(s.players.map(p => p.id)).size !== s.players.length) return false
  if (new Set(s.players.map(p => p.genre)).size > 2 || GENRES.some(g => s.players.filter(p => p.genre === g).length > 2)) return false
  if (!s.crews.every(c => c && genre(c.genre) && int(c.hp, 0, 100) && int(c.energy, 0, 12) && int(c.shield, 0, 12) && int(c.hits, 0, 12) && int(c.harmony, 0, 6))) return false
  if (new Set(s.crews.map(c => c.genre)).size !== s.crews.length) return false
  if (s.phase === 'training' || s.phase === 'battle') {
    if (s.players.length !== 4 || s.crews.length !== 2 || !s.players.every(p => p.ready && s.crews.some(c => c.genre === p.genre))) return false
    if (s.phase === 'battle' && s.round >= BATTLE_ROUNDS) return false
  }
  return true
}
