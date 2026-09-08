import test from 'node:test'
import assert from 'node:assert/strict'
import { newArena, applyCommand, advance, cueFor, publicSnapshot, validSnapshot, validCommand, GENRES, TRAINING_MS, TURN_MS, CUE_MS, type Arena, type Command } from '../src/arena'
const ids = ['a', 'b', 'c', 'd']
function send(s: Arena, id: string, command: Command, now = s.since) { return applyCommand(s, id, { match: s.match, phase: s.phase, round: s.round, command }, now) }
function ready() {
  let s = newArena(1000, 'host:1000')
  ids.forEach((id, i) => { s = send(s, id, { kind: 'join', genre: i < 2 ? 'kpop' : 'funk' }) })
  ids.forEach(id => { s = send(s, id, { kind: 'ready' }) })
  return s
}
function trained(correct = true) {
  let s = ready()
  for (let r = 0; r < 6; r++) {
    if (correct) ids.forEach(id => { s = send(s, id, { kind: 'beat', value: cueFor(s, id) }, s.since + CUE_MS) })
    s = advance(s, s.since + TRAINING_MS)
  }
  return s
}
test('K-pop and six communities are selectable without statistical advantages', () => {
  assert.equal(GENRES.length, 6)
  for (const g of GENRES) assert.equal(send(newArena(0, 'm'), 'a', { kind: 'join', genre: g }).players[0].genre, g)
})
test('four real ready players are required; no synthetic teammates', () => {
  assert.equal(newArena(0, 'm').players.length, 0)
  assert.equal(ready().phase, 'training')
  let s = send(newArena(0, 'm'), 'a', { kind: 'join', genre: 'kpop' })
  s = send(s, 'a', { kind: 'ready' }); assert.equal(advance(s, 999999).phase, 'lobby')
})
test('capacity, duplicate identity, third crew and unequal team size are rejected', () => {
  let s = newArena(0, 'm')
  for (const id of ['a', 'b']) s = send(s, id, { kind: 'join', genre: 'kpop' })
  assert.equal(send(s, 'c', { kind: 'join', genre: 'kpop' }), s)
  assert.equal(send(s, 'a', { kind: 'join', genre: 'funk' }), s)
  s = send(s, 'c', { kind: 'join', genre: 'funk' })
  assert.equal(send(s, 'd', { kind: 'join', genre: 'latin' }), s)
})
test('training choices are accepted only after the cue hides, once, before deadline', () => {
  const s = ready(), c: Command = { kind: 'beat', value: 1 }
  assert.equal(send(s, 'a', c), s)
  assert.equal(send(s, 'a', c, s.since + TRAINING_MS), s)
  const n = send(s, 'a', c, s.since + CUE_MS)
  assert.equal(send(n, 'a', { kind: 'beat', value: 2 }, n.since + 3000), n)
})
test('team preparation sets capped battle energy and protection', () => {
  const best = trained(), missed = trained(false)
  assert.equal(best.phase, 'battle'); assert.equal(best.round, 0)
  assert.deepEqual(best.crews.map(c => [c.energy, c.shield]), [[8, 12], [8, 12]])
  assert.deepEqual(missed.crews.map(c => [c.energy, c.shield]), [[4, 0], [4, 0]])
})
test('only both teammates succeeding earns harmony; no one-player farming', () => {
  let s = ready(); s = send(s, 'a', { kind: 'beat', value: cueFor(s, 'a') }, s.since + CUE_MS)
  s = advance(s, s.since + TRAINING_MS)
  assert.equal(s.crews[0].hits, 1); assert.equal(s.crews[0].harmony, 0)
})
test('both crews have equivalent cue patterns', () => {
  const s = ready(); assert.equal(cueFor(s, 'a'), cueFor(s, 'c')); assert.equal(cueFor(s, 'b'), cueFor(s, 'd'))
})
test('attack damage and shield resolve simultaneously', () => {
  let s = trained()
  ids.forEach(id => { s = send(s, id, { kind: 'card', value: 'attack' }) })
  s = advance(s, s.since + TURN_MS)
  assert.deepEqual(s.crews.map(c => c.hp), [86, 86]); assert.deepEqual(s.crews.map(c => c.energy), [5, 5])
})
test('paired combo is stronger than isolated combo and costs shared energy', () => {
  let s = trained()
  s = send(s, 'a', { kind: 'card', value: 'combo' }); s = send(s, 'b', { kind: 'card', value: 'combo' })
  s = advance(s, s.since + TURN_MS)
  assert.equal(s.crews[1].hp, 76); assert.equal(s.crews[0].energy, 3)
})
test('insufficient resources fizzle paid cards, without negative energy', () => {
  let s = trained(false)
  s = send(s, 'a', { kind: 'card', value: 'combo' }); s = send(s, 'b', { kind: 'card', value: 'combo' })
  s = advance(s, s.since + TURN_MS)
  assert.equal(s.crews[1].hp, 100); assert.equal(s.crews[0].energy, 5)
})
test('guard and charge work, and energy is capped', () => {
  let s = trained()
  s = send(s, 'a', { kind: 'card', value: 'guard' }); s = send(s, 'b', { kind: 'card', value: 'charge' })
  s = send(s, 'c', { kind: 'card', value: 'attack' }); s = send(s, 'd', { kind: 'card', value: 'attack' })
  s = advance(s, s.since + TURN_MS)
  assert.equal(s.crews[0].hp, 96); assert.equal(s.crews[0].energy, 11)
})
test('timeouts finish a draw and reset without a scheduled host', () => {
  let s = trained(false)
  for (let i = 0; i < 5; i++) s = advance(s, s.since + TURN_MS)
  assert.equal(s.phase, 'result'); assert.equal(s.winner, 'draw')
  const n = advance(s, s.since + 18000); assert.equal(n.phase, 'lobby'); assert.equal(n.players.length, 0); assert.notEqual(n.match, s.match)
})
test('departures cancel rather than award a fake win', () => {
  const s = send(ready(), 'a', { kind: 'leave' })
  assert.equal(s.phase, 'result'); assert.equal(s.winner, null)
})
test('untrusted commands and stale phase/round/match never mutate rules', () => {
  const s = ready()
  for (const v of [null, {}, { kind: 'beat', value: 3 }, { kind: 'card', value: 'win' }, { kind: 'join', genre: 'unknown' }]) assert.equal(validCommand(v), false)
  for (const id of ['__proto__', 'constructor', 'alien']) assert.equal(send(s, id, { kind: 'card', value: 'attack' }), s)
  assert.equal(applyCommand(s, 'a', { match: 'old', phase: s.phase, round: s.round, command: { kind: 'leave' } }, s.since), s)
})
test('published snapshots redact live choices and validate hostile input', () => {
  const s = send(trained(), 'a', { kind: 'card', value: 'combo' })
  assert.equal(validSnapshot(publicSnapshot(s)), true); assert.equal(validSnapshot(s), false)
  assert.equal(validSnapshot({ ...publicSnapshot(s), players: [...s.players, s.players[0]] }), false)
  assert.equal(validSnapshot({ ...publicSnapshot(s), crews: [{ ...s.crews[0], energy: Infinity }] }), false)
  assert.equal(validSnapshot(null), false)
})
