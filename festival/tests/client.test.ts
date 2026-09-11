import test from 'node:test'
import assert from 'node:assert/strict'
import { AuthorityClient } from '../src/client'
import { ConcertAuthority } from '../src/authority'
import { ServerNotebook } from '../src/notebook'
import { GENRES, newArena } from '../src/rules/concert'
const one = '0x' + '1'.repeat(40), two = '0x' + '2'.repeat(40)
const server = () => new ConcertAuthority(1000, 'test')
test('two client views converge on the server-owned crew state', () => {
  const host = server(), a = new AuthorityClient(one, 1000), b = new AuthorityClient(two, 1000)
  for (const client of [a, b]) client.receiveState(host.state, 1000, true, 1000)
  assert.equal(a.command({ kind: 'join', genre: 'kpop' }, 1100), true)
  const packet = a.drain()[0]
  const accepted = host.command(one, JSON.parse(packet.json), 1100, { x: 7.5, z: 18.5 })
  a.ack(packet.request, accepted)
  for (const client of [a, b]) client.receiveState(host.state, 1100, true, 1100)
  assert.deepEqual(a.state, b.state); assert.equal(a.state.players[0].id, one)
})
test('no server heartbeat means no local promotion, score or command', () => {
  const a = new AuthorityClient(one, 1000), host = server()
  assert.equal(a.command({ kind: 'join', genre: 'kpop' }, 1000), false)
  a.receiveState(host.state, 1000, true, 1000)
  assert.equal(a.command({ kind: 'join', genre: 'kpop' }, 5100), false)
  assert.equal(a.ready, false); assert.equal(a.drain().length, 0)
  assert.equal(host.state.players.length, 0)
})
test('server save hold prevents new commands', () => {
  const a = new AuthorityClient(one, 1000)
  a.receiveState(server().state, 1000, false, 1000)
  assert.equal(a.command({ kind: 'join', genre: 'kpop' }, 1000), false)
})
test('stale, malformed and non-authoritative snapshots are rejected', () => {
  const a = new AuthorityClient(one, 1000), s = server().state
  assert.equal(a.receiveState(s, 2000, true, 1000), true)
  assert.equal(a.receiveState(s, 1999, true, 1001), false)
  assert.equal(a.receiveState({}, 2001, true, 1001), false)
  assert.equal(a.receiveState(newArena(1000, 'peer:1000'), 2001, true, 1001), false)
})
test('new server round discards stale pending actions', () => {
  const a = new AuthorityClient(one, 1000)
  a.receiveState(server().state, 1000, true, 1000)
  a.command({ kind: 'join', genre: 'kpop' }, 1100)
  a.receiveState(newArena(1200, 'authority:restart:1200'), 1200, true, 1200)
  assert.equal(a.pending, null); assert.equal(a.drain().length, 0)
})
test('midpoint clock synchronization rejects stale pong and unbounded delay', () => {
  const a = new AuthorityClient(one, 1000)
  a.ping(1000); assert.equal(a.pong(999, 1600, 1200), false)
  assert.equal(a.pong(1000, 1600, 1200), true)
  assert.equal(a.offset, 500); assert.equal(a.roundTripMs, 200)
  a.ping(2000); assert.equal(a.pong(2000, 5000, 5001), false)
})
test('lost ack retries exact intent but unrelated ack cannot clear it', () => {
  const a = new AuthorityClient(one, 1000)
  a.receiveState(server().state, 1000, true, 1000)
  a.command({ kind: 'join', genre: 'kpop' }, 1100)
  const first = a.drain()[0]
  a.ack(first.request + 1, true); assert.notEqual(a.pending, null)
  a.tick(1800); assert.deepEqual(a.drain()[0], first)
  a.ack(first.request, true); assert.equal(a.pending, null)
})
function payload() {
  return { scope: 'LAB_PILOT', album: [{ match: 'authority:show:1000', date: '2026-09-10', genre: 'kpop', kind: 'ILLUSTRATED_KEEPSAKE', mode: 'HUMAN_MATCH', attributes: { rhythm: 80, precision: 80, harmony: 80, consistency: 80 } }],
    standings: GENRES.map(genre => ({ genre, humanShows: 1, humanWins: genre === 'kpop' ? 1 : 0, averageScore: 320, exhibitionWins: 0 })) }
}
test('notebook only hydrates server results; observation never awards a cover', () => {
  const n = new ServerNotebook()
  assert.equal(n.loaded, false); assert.equal(n.observe(server().state, one, 1000), false)
  assert.equal(n.receive(payload()), true); assert.equal(n.album.length, 1)
  assert.equal(n.album[0].score, 320); assert.equal(n.wins.kpop.human, 1)
})
test('invalid notebook preserves previous confirmed data', () => {
  const n = new ServerNotebook(); n.receive(payload())
  const bad = payload(); bad.standings[0].humanWins = 100
  assert.equal(n.receive(bad), false); assert.equal(n.wins.kpop.human, 1)
  assert.equal(n.receive({ scope: 'GLOBAL', album: [], standings: [] }), false)
})
test('notebook payload stays below transport budget with maximum-length match IDs', () => {
  const p = payload(); p.album = Array.from({ length: 8 }, () => ({ ...p.album[0], match: 'a'.repeat(180) }))
  assert.ok(Buffer.byteLength(JSON.stringify(p), 'utf8') < 10000)
  assert.equal(new ServerNotebook().receive(p), true)
})

test('queue readback rejects impossible positions and delayed packets',()=>{
  const c=new AuthorityClient(one,1000)
  assert.equal(c.receiveEnrollment({genre:'kpop',position:1,total:2},1100),true)
  assert.equal(c.receiveEnrollment({genre:null,position:0,total:1},1099),false)
  assert.equal(c.receiveEnrollment({genre:'kpop',position:4,total:2},1200),false)
  assert.equal(c.receiveEnrollment({genre:'kpop',position:0,total:2},1200),false)
  assert.equal(c.enrollment.genre,'kpop')
})
test('promotion to a real crew clears queued presentation',()=>{
  const c=new AuthorityClient(one,1000), host=server(), s=host.state
  c.receiveEnrollment({genre:'kpop',position:1,total:1},1000)
  host.command(one,{match:s.match,phase:s.phase,round:s.round,command:{kind:'join',genre:'kpop'}},1100,{x:7.5,z:18.5})
  c.receiveState(host.state,1100,true,1100)
  assert.equal(c.enrollment.genre,null)
})
test('queue cancellation stays available during server save hold, but not offline',()=>{
  const c=new AuthorityClient(one,1000)
  c.receiveState(server().state,1000,false,1000)
  c.receiveEnrollment({genre:'kpop',position:1,total:1},1000)
  assert.equal(c.command({kind:'leave'},1100),true)
  c.tick(6000)
  assert.equal(c.command({kind:'leave'},6000),false)
})
