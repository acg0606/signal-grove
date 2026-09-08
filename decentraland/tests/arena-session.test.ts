import test from 'node:test'
import assert from 'node:assert/strict'
import { ArenaSession } from '../src/arena-session'
import { publicSnapshot, newArena, cueFor } from '../src/arena'
import { noteTime } from '../src/rhythm'
function network() {
  const clients = ['a', 'b', 'c', 'd'].map(id => new ArenaSession(id, 1000))
  const pump = (now: number) => {
    for (let loop = 0; loop < 10; loop++) {
      const batches = clients.map(c => [c, c.drain()] as const)
      if (!batches.some(([, packets]) => packets.length)) break
      for (const [origin, packets] of batches) for (const p of packets) for (const target of clients) if (origin !== target) target.receive(p, origin.id, now)
    }
  }
  clients.forEach(c => c.tick(1000)); pump(1000)
  // Synchronization heartbeat gives peers the host's actual initial epoch.
  clients.forEach(c => c.tick(2000)); pump(2000)
  return { clients, pump }
}
test('four transport-isolated clients elect and converge, then join and ready', () => {
  const { clients, pump } = network()
  assert.deepEqual(clients.map(c => c.host), ['a', 'a', 'a', 'a'])
  clients.forEach((c, i) => { c.command({ kind: 'join', genre: i < 2 ? 'kpop' : 'funk' }, 2100); pump(2100) })
  assert.deepEqual(clients.map(c => c.state.players.length), [4, 4, 4, 4])
  clients.forEach(c => { c.command({ kind: 'ready' }, 2200); pump(2200) })
  assert.deepEqual(clients.map(c => c.state.phase), ['training', 'training', 'training', 'training'])
  clients.forEach(c => assert.equal(c.pending, null))
})
test('a non-coordinator cannot forge a state, and commands bind transport sender', () => {
  const { clients, pump } = network()
  const before = clients[1].state
  clients[1].receive({ kind: 'state', state: publicSnapshot(newArena(5000, 'c:5000')), time: 5000 }, 'c', 5000)
  assert.equal(clients[1].state, before)
  clients[2].command({ kind: 'join', genre: 'kpop' }, 2100); pump(2100)
  assert.equal(clients[0].state.players[0].id, 'c')
})
test('duplicate commands are acknowledged but never applied twice', () => {
  const { clients, pump } = network()
  clients[1].command({ kind: 'join', genre: 'kpop' }, 2100)
  const packet = clients[1].drain()[0]
  clients[0].receive(packet, 'b', 2100); clients[0].receive(packet, 'b', 2100); pump(2100)
  assert.equal(clients[0].state.players.length, 1); assert.equal(clients[1].pending, null)
})
test('lost host returns the room to a joinable lobby rather than inventing victory', () => {
  const { clients } = network()
  clients[1].tick(11000)
  assert.equal(clients[1].host, 'b'); assert.equal(clients[1].state.phase, 'lobby'); assert.equal(clients[1].state.winner, null)
})
test('pending commands have a bounded confirmation timeout', () => {
  const { clients } = network()
  clients[1].command({ kind: 'join', genre: 'kpop' }, 2100)
  clients[1].receive({ kind: 'hello', incarnation: 1000 }, 'a', 6000); clients[1].tick(7200)
  assert.equal(clients[1].pending, null); assert.match(clients[1].notice, /No confirmation/)
})
test('late lower-ID spectator discovers an active host without clearing the match', () => {
  const { clients, pump } = network()
  clients.forEach((c, i) => { c.command({ kind: 'join', genre: i < 2 ? 'kpop' : 'funk' }, 2100); pump(2100) })
  clients.forEach(c => { c.command({ kind: 'ready' }, 2200); pump(2200) })
  const late = new ArenaSession('0', 3000); late.tick(3000)
  const hello = late.drain().find(p => p.kind === 'hello')!
  clients.forEach(c => c.receive(hello, '0', 3000))
  for (const c of clients) for (const p of c.drain()) late.receive(p, c.id, 3000)
  // Introductions precede accepting any state from that transport identity.
  late.receive({ kind: 'hello', incarnation: 1000 }, 'a', 3100)
  clients[0].tick(3100)
  for (const p of clients[0].drain()) late.receive(p, 'a', 3100)
  assert.equal(clients[0].host, 'a'); assert.equal(clients[0].state.players.length, 4)
  assert.equal(late.host, 'a'); assert.equal(late.state.phase, 'training')
  late.tick(3200); assert.equal(late.host, 'a')
})
test('refresh before lease expiry resets dedup identity and allows new commands', () => {
  const { clients, pump } = network()
  clients[1].command({ kind: 'join', genre: 'kpop' }, 2100); pump(2100)
  clients[1].command({ kind: 'ready' }, 2200); pump(2200)
  const fresh = new ArenaSession('b', 3000)
  fresh.tick(3000)
  for (const p of fresh.drain()) clients[0].receive(p, 'b', 3000)
  fresh.receive({ kind: 'hello', incarnation: 1000 }, 'a', 3000)
  for (const p of clients[0].drain()) fresh.receive(p, 'a', 3000)
  fresh.command({ kind: 'leave' }, 3100)
  for (const p of fresh.drain()) clients[0].receive(p, 'b', 3100)
  for (const p of clients[0].drain()) fresh.receive(p, 'a', 3100)
  assert.equal(fresh.pending, null); assert.equal(fresh.state.players.length, 0)
})

test('200ms each-way delay uses midpoint clock sync and survives one lost note ACK', () => {
  const clients = ['a', 'b', 'c', 'd'].map(id => new ArenaSession(id, 1000))
  let now = 1000, dropped = false
  const queue: { at: number; from: string; target: ArenaSession; packet: any }[] = []
  function step() {
    clients.forEach(c => c.tick(now))
    for (const c of clients) for (const packet of c.drain()) for (const target of clients) if (target !== c) {
      if (!dropped && packet.kind === 'ack' && packet.target === 'b' && clients[0].state.phase === 'training') { dropped = true; continue }
      queue.push({ at: now + 200, from: c.id, target, packet })
    }
    for (let i = queue.length - 1; i >= 0; i--) if (queue[i].at <= now) { const p = queue.splice(i, 1)[0]; p.target.receive(p.packet, p.from, now) }
    now += 10
  }
  function run(ms: number) { const end = now + ms; while (now < end) step() }
  run(2500)
  clients.forEach((c, i) => { c.command({ kind: 'join', genre: i < 2 ? 'kpop' : 'funk' }, now); run(600) })
  clients.forEach(c => { c.command({ kind: 'ready' }, now); run(600) })
  assert.equal(clients[0].state.phase, 'training')
  clients.slice(1).forEach(c => assert.ok(Math.abs(c.offset) <= 15, `midpoint offset ${c.offset}`))
  for (let index = 0; index < 4; index++) {
    const at = clients[0].state.since + noteTime(0, index) + 50
    while (now < at) step()
    for (const c of clients) { assert.equal(c.pending, null); c.command({ kind: 'note', index, value: cueFor(c.state, c.id, index) }, now) }
    run(550)
    clients.slice(1).forEach(c => assert.equal(c.notice, 'Confirmed.'))
  }
  while (clients[0].state.round === 0) step()
  assert.deepEqual(clients[0].state.crews.map(c => [c.hits, c.harmony]), [[2, 1], [2, 1]])
  assert.equal(dropped, true)
})

test('unacknowledged expired note releases input before the next fast note', () => {
  const { clients, pump } = network()
  clients.forEach((c, i) => { c.command({ kind: 'join', genre: i < 2 ? 'kpop' : 'funk' }, 2100); pump(2100) })
  clients.forEach(c => { c.command({ kind: 'ready' }, 2200); pump(2200) })
  const b = clients[1]
  b.command({ kind: 'note', index: 0, value: cueFor(b.state, 'b') }, 4200)
  b.drain(); b.tick(4610)
  assert.equal(b.pending, null)
})
