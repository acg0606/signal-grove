import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeSignal, mergeRemoteSignal, describeGrove, isSignal, PRESENCE_TTL_MS, type Role, type Room } from '../src/room'
const signal = (playerId: string, role: Role | null, revision = 1) => ({ schema: 'signal-grove/1' as const, playerId, role, revision })
test('solo activity never claims a social outcome', () => {
  const room = mergeSignal({}, signal('one', 'listen'), 10)
  assert.equal(describeGrove(room, 11).status, 'WAITING_FOR_FRIEND')
  assert.equal(describeGrove(room, 11).bloom, 0)
})
test('real distinct participants determine the visible shared outcome', () => {
  let room = mergeSignal({}, signal('one', 'listen'), 10)
  room = mergeSignal(room, signal('two', 'listen'), 10)
  assert.equal(describeGrove(room, 11).status, 'ECHO_LOOP')
  room = mergeSignal(room, signal('two', 'invite', 2), 12)
  assert.equal(describeGrove(room, 13).status, 'SHARED_RHYTHM')
  room = mergeSignal(room, signal('three', 'build'), 13)
  assert.equal(describeGrove(room, 14).status, 'FULL_SPECTRUM')
})
test('out-of-order and duplicate updates cannot undo a later choice', () => {
  let room = mergeSignal({}, signal('one', 'build', 3), 10)
  const before = room
  room = mergeSignal(room, signal('one', 'listen', 1), 11)
  room = mergeSignal(room, signal('one', 'invite', 3), 11)
  assert.equal(room, before)
})
test('two independent clients converge despite reordered messages', () => {
  const messages = [signal('a', 'listen'), signal('b', 'invite'), signal('c', 'build'), signal('b', 'build', 2)]
  const first = messages.reduce((room, event) => mergeSignal(room, event, 10), {} as Room)
  const second = [...messages].reverse().reduce((room, event) => mergeSignal(room, event, 10), {} as Room)
  assert.deepEqual(describeGrove(first, 11), describeGrove(second, 11))
})
test('expired presence cannot leave a fake crowd', () => {
  const room = mergeSignal({}, signal('one', 'listen'), 10)
  assert.equal(describeGrove(room, 10 + PRESENCE_TTL_MS).visitors, 0)
})
test('invalid and oversized messages are ignored', () => {
  for (const value of [null, {}, signal('__proto__', 'build'), signal('x'.repeat(81), 'build'), { ...signal('x', 'build'), revision: NaN }, { ...signal('x', 'build'), role: 'admin' }]) {
    assert.equal(isSignal(value), false)
    assert.deepEqual(mergeSignal({}, value, 10), {})
  }
})
test('expired slots can be reused and a reconnected visitor can restart its counter', () => {
  let room: Room = {}
  for (let i = 0; i < 32; i++) room = mergeSignal(room, signal('visitor_' + i, 'listen', 99), 0)
  room = mergeSignal(room, signal('visitor_0', 'invite', 1), PRESENCE_TTL_MS + 1)
  assert.equal(describeGrove(room, PRESENCE_TTL_MS + 2).visitors, 1)
  assert.equal(room.visitor_0.role, 'invite')
})

test('transport identity cannot claim another visitor and self echoes are ignored', () => {
  assert.deepEqual(mergeRemoteSignal({}, signal('victim', 'build'), 'attacker', 10), {})
  assert.deepEqual(mergeRemoteSignal({}, signal('self', 'build'), 'self', 10), {})
  assert.equal(mergeRemoteSignal({}, signal('guest', 'listen'), 'GUEST', 10).guest.role, 'listen')
})

test('unexpected payload fields are not retained in room state', () => {
  const room = mergeSignal({}, { ...signal('one', 'listen'), privateData: ['untrusted'] }, 10)
  assert.equal('privateData' in room.one, false)
})
