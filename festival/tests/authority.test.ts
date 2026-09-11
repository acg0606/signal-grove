import test from 'node:test'
import assert from 'node:assert/strict'
import { ConcertAuthority, DISCONNECT_GRACE_MS } from '../src/authority'
import { ResultLedger, JOURNAL_KEY, MAX_RESULTS, archiveKey, type Store } from '../src/ledger'
import { decodeStorageRead } from '../src/storage-response'
import { QUEUE_MS, INTERMISSION_MS, TRAINING_MS, TRAINING_ROUNDS, PRESENTATION_MS, TURN_MS, BATTLE_ROUNDS, RESULT_MS, cueFor, type Command, type Arena } from '../src/rules/concert'
import { noteTime } from '../src/rules/rhythm'

const ids = [1, 2, 3, 4].map(n => `0x${n.toString().padStart(40, '0')}`)
const connected = new Set(ids)
const pos = (i: number) => i < 2 ? { x: 7.5, z: 19.5 } : { x: 40.5, z: 52.5 }
function send(a: ConcertAuthority, i: number, command: Command, now: number, p = pos(i)) {
  const s = a.state
  return a.command(ids[i], { match: s.match, phase: s.phase, round: s.round, command }, now, p)
}
function setup(humans = 4) {
  const a = new ConcertAuthority(1000, 'test')
  for (let i = 0; i < humans; i++) assert.equal(send(a, i, { kind: 'join', genre: i < 2 ? 'kpop' : 'electronic' }, 1000), true)
  a.tick(1000 + QUEUE_MS, connected)
  return a
}
function finish(a = setup()) {
  for (let round = 0; round < TRAINING_ROUNDS; round++) {
    const since = a.state.since
    for (let index = 0; index < 4; index++) for (let i = 0; i < 2; i++) {
      if (!a.state.players.some(p => p.id === ids[i])) continue
      send(a, i, { kind: 'note', index, value: cueFor(a.state, ids[i], index) }, since + noteTime(round, index, false))
    }
    a.tick(since + TRAINING_MS, connected)
  }
  assert.equal(a.state.phase, 'intermission')
  a.state.players.forEach(p => { if (!p.bot) {
    const i = ids.indexOf(p.id)
    assert.equal(send(a, i, { kind: 'ready' }, a.state.since, { x: a.state.finalists.indexOf(p.genre) === 0 ? 18 : 30, z: 69.5 }), true)
  } })
  a.tick(a.state.since + INTERMISSION_MS, connected)
  assert.equal(a.state.phase, 'presentation')
  a.tick(a.state.since + PRESENTATION_MS, connected)
  for (let round = 0; round < BATTLE_ROUNDS; round++) {
    const since = a.state.since
    for (let index = 0; index < 4; index++) for (let i = 0; i < 2; i++) {
      if (!a.state.players.some(p => p.id === ids[i])) continue
      send(a, i, { kind: 'note', index, value: cueFor(a.state, ids[i], index) }, since + noteTime(round, index, true), { x: a.state.finalists.indexOf('kpop') === 0 ? 18 : 30, z: 69.5 })
    }
    a.tick(since + TURN_MS, connected)
  }
  assert.equal(a.state.phase, 'result')
  assert.equal(a.state.winner, 'kpop')
  return a
}
class MemoryStore implements Store {
  values = new Map<string, string>(); writes = 0; fail = false
  async get(key: string) { return this.values.get(key) }
  async set(key: string, value: string) { this.writes++; if (this.fail) return false; this.values.set(key, value); return true }
}
test('full two-crew show preserves 30-second rehearsal and live double weight', () => {
  assert.equal(TRAINING_MS * TRAINING_ROUNDS, 30000)
  const s = finish().state
  assert.deepEqual(s.crews[0].final, { rhythm: 100, precision: 100, harmony: 100, consistency: 100 })
  assert.equal(s.mode, 'HUMAN_MATCH')
})
test('commands require verified wallet and verified studio position', () => {
  const a = new ConcertAuthority(1000, 'test'), s = a.state
  const e = { match: s.match, phase: s.phase, round: s.round, command: { kind: 'join', genre: 'kpop' } } as const
  assert.equal(a.command('alice', e, 1000, pos(0)), false)
  assert.equal(a.command(ids[0], e, 1000), false)
  assert.equal(a.command(ids[0], e, 1000, { x: 100, z: 100 }), false)
  assert.equal(a.command(ids[0], e, 1000, { x: NaN, z: 7 }), false)
  assert.equal(a.command(ids[0], e, 1000, pos(0)), true)
})
test('wrong location and wrong phase cannot play notes', () => {
  const a = setup(), now = a.state.since + noteTime(0, 0, false)
  assert.equal(send(a, 0, { kind: 'note', index: 0, value: cueFor(a.state, ids[0], 0) }, now, { x: 27, z: 30 }), false)
  const s = a.state
  assert.equal(a.command(ids[0], { match: s.match, phase: 'battle', round: 0, command: { kind: 'note', value: 0, index: 0 } }, now, pos(0)), false)
})
test('client supplied score, identity and timestamp cannot replace server rules', () => {
  const a = setup(), s = a.state
  assert.equal(a.command(ids[0], { match: s.match, phase: s.phase, round: 0, command: { kind: 'score', value: 9999 } } as any, 2000, pos(0)), false)
  assert.equal(send(a, 0, { kind: 'note', value: cueFor(s, ids[0], 0), index: 0 }, s.since), false)
  assert.deepEqual(a.state.choices, {})
})
test('duplicate note is scored once, snapshot mutation cannot change authority', () => {
  const a = setup(), now = a.state.since + noteTime(0, 0, false)
  const note: Command = { kind: 'note', index: 0, value: cueFor(a.state, ids[0], 0) }
  assert.equal(send(a, 0, note, now), true)
  assert.equal(send(a, 0, note, now), false)
  const s = a.state; s.players.length = 0; s.crews[0].final.rhythm = 9999
  assert.equal(a.state.players.length, 4)
  assert.equal(a.state.crews[0].final.rhythm, 0)
})
test('short reconnection preserves round without peer election', () => {
  const a = setup(), match = a.state.match
  a.tick(1100, new Set(ids.slice(1))); a.tick(2000, connected)
  assert.equal(a.state.match, match); assert.equal(a.state.phase, 'training')
})
test('expired disconnect withdraws a performer while the global festival continues', () => {
  const a = setup(), present = new Set(ids.slice(1))
  a.tick(a.state.since + 100, present); a.tick(a.state.since + 100 + DISCONNECT_GRACE_MS, present)
  assert.equal(a.state.phase, 'training'); assert.equal(a.state.players[0].withdrawn, true); assert.equal(a.state.winner, null)
})
test('completed performers can enroll again without changing the finished result', () => {
  const a = finish(), prior = a.state.match
  assert.equal(send(a, 0, { kind: 'join', genre: 'kpop' }, a.state.since), true)
  assert.equal(a.enrollment(ids[0]).position,1)
  assert.equal(a.state.winner,'kpop')
  a.tick(a.state.since + RESULT_MS, connected, new Map([[ids[0],pos(0)]]))
  assert.equal(a.state.phase, 'lobby'); assert.notEqual(a.state.match, prior)
  assert.equal(a.state.players[0].id,ids[0]);assert.equal(a.enrollment(ids[0]).genre,null)
})
test('durable journal restores personal keepsakes and genre totals without duplicate credit', async () => {
  const store = new MemoryStore(), s = finish().state, first = new ResultLedger(store)
  assert.equal(await first.load(), true); assert.equal(await first.record(s), 'saved')
  const restored = new ResultLedger(store); await restored.load()
  assert.equal(await restored.record(s), 'duplicate'); assert.equal(store.writes, 1)
  assert.equal(restored.album(ids[0]).length, 1); assert.equal(restored.album(ids[2]).length, 0)
  assert.equal(restored.album('unknown').length, 0)
  assert.equal(restored.standings()[0].humanWins, 1)
  assert.equal(restored.album(ids[0])[0].kind, 'ILLUSTRATED_KEEPSAKE')
})
test('failed save is not presented as durable and can be retried', async () => {
  const store = new MemoryStore(), ledger = new ResultLedger(store), s = finish().state
  await ledger.load(); store.fail = true
  assert.equal(await ledger.record(s), 'retry'); assert.equal(ledger.album(ids[0]).length, 0)
  store.fail = false; assert.equal(await ledger.record(s), 'saved')
})
test('concurrent duplicate checkpoints are serialized into one credit', async () => {
  const store = new MemoryStore(), ledger = new ResultLedger(store), s = finish().state
  await ledger.load()
  assert.deepEqual(await Promise.all([ledger.record(s), ledger.record(s)]), ['saved', 'duplicate'])
  assert.equal(store.writes, 1)
})
test('bot exhibitions never increment human standings', async () => {
  const store = new MemoryStore(), ledger = new ResultLedger(store), s = finish(setup(2)).state
  await ledger.load(); assert.equal(await ledger.record(s), 'saved')
  assert.equal(ledger.standings()[0].humanWins, 0); assert.equal(ledger.standings()[0].exhibitionWins, 1)
  assert.equal(ledger.album(ids[0])[0].mode, 'BOT_EXHIBITION')
})
test('cancelled, falsely declared draws and inconsistent outcomes are ignored', async () => {
  const ledger = new ResultLedger(new MemoryStore()); await ledger.load()
  for (const alter of [(s: Arena) => { s.winner = null }, (s: Arena) => { s.winner = 'draw' }, (s: Arena) => { s.winner = 'electronic' },
    (s: Arena) => { s.crews[0].final.rhythm = 99 }, (s: Arena) => { s.mode = 'BOT_EXHIBITION' }]) {
    const s = finish().state; alter(s); assert.equal(await ledger.record(s), 'ignored')
  }
})
test('unknown schema or corrupted journal cannot be overwritten', async () => {
  for (const raw of ['{"schema":2,"results":[]}', 'bad-json', '{"schema":1,"results":[{}]}', 'null']) {
    const store = new MemoryStore(); store.values.set(JOURNAL_KEY, raw)
    const ledger = new ResultLedger(store)
    assert.equal(await ledger.load(), false); assert.equal(await ledger.record(finish().state), 'retry')
    assert.equal(store.writes, 0); assert.equal(store.values.get(JOURNAL_KEY), raw)
  }
})
test('legacy full page rotates without erasing history or stopping new shows', async () => {
  const store = new MemoryStore(), ledger = new ResultLedger(store), s = finish().state
  await ledger.load(); await ledger.record(s)
  const sample = JSON.parse(store.values.get(JOURNAL_KEY)!).results[0]
  store.values.set(JOURNAL_KEY, JSON.stringify({ schema: 1, results: Array.from({ length: MAX_RESULTS }, (_, i) => ({ ...sample, match: `pilot:${i}` })) }))
  const restored = new ResultLedger(store); assert.equal(await restored.load(), true)
  assert.equal(await restored.record(s), 'saved'); assert.equal(restored.album(ids[0]).length, 24)
  assert.equal(JSON.parse(store.values.get(archiveKey(0))!).results.length, MAX_RESULTS)
  assert.equal(JSON.parse(store.values.get(JOURNAL_KEY)!).archives, 1)
  const reboot = new ResultLedger(store); assert.equal(await reboot.load(), true)
  assert.equal(reboot.standings()[0].humanWins, MAX_RESULTS + 1)
  assert.equal(await reboot.record({ ...s, match: 'pilot:0' }), 'duplicate')
  assert.equal(await reboot.record(s), 'duplicate')
})

test('failed head commit after archival is restartable without duplicate credits', async () => {
  const store = new MemoryStore(), ledger = new ResultLedger(store), s = finish().state
  await ledger.load()
  for (let i = 0; i < MAX_RESULTS; i++) assert.equal(await ledger.record({ ...s, match: `rotation:${i}` }), 'saved')
  const original = store.set.bind(store)
  store.set = async (key, value) => key === JOURNAL_KEY ? false : original(key, value)
  assert.equal(await ledger.record(s), 'retry')
  assert.equal(ledger.standings()[0].humanWins, MAX_RESULTS)
  const archive = store.values.get(archiveKey(0))
  assert.ok(archive)
  const reboot = new ResultLedger(store); assert.equal(await reboot.load(), true)
  store.set = original
  assert.equal(await reboot.record(s), 'saved')
  assert.equal(store.values.get(archiveKey(0)), archive)
  assert.equal(reboot.standings()[0].humanWins, MAX_RESULTS + 1)
})

test('missing or corrupt referenced archive blocks loading without overwriting data', async () => {
  for (const raw of [undefined, 'bad', '{"schema":1,"results":[]}']) {
    const store = new MemoryStore()
    store.values.set(JOURNAL_KEY, JSON.stringify({ schema: 2, archives: 1, results: [] }))
    if (raw !== undefined) store.values.set(archiveKey(0), raw)
    const ledger = new ResultLedger(store)
    assert.equal(await ledger.load(), false)
    assert.equal(await ledger.record(finish().state), 'retry'); assert.equal(store.writes, 0)
  }
})

test('multiple sealed pages survive restart; conflicts are never overwritten', async () => {
  const store = new MemoryStore(), ledger = new ResultLedger(store), s = finish().state
  await ledger.load()
  for (let i = 0; i < MAX_RESULTS * 2; i++) await ledger.record({ ...s, match: `pages:${i}` })
  store.values.set(archiveKey(1), 'unrecognized-existing-data')
  assert.equal(await ledger.record(s), 'retry')
  assert.equal(store.values.get(archiveKey(1)), 'unrecognized-existing-data')
  // Test fixture repairs its own synthetic conflict, not a production operation.
  store.values.delete(archiveKey(1))
  assert.equal(await ledger.record(s), 'saved')
  const reboot = new ResultLedger(store); assert.equal(await reboot.load(), true)
  assert.equal(reboot.standings()[0].humanWins, MAX_RESULTS * 2 + 1)
  assert.equal(await reboot.record({ ...s, match: 'pages:0' }), 'duplicate')
})
const guest = (n:number) => '0x'+n.toString(16).padStart(40,'0')
function request(a:ConcertAuthority,id:string,command:Command,now=a.state.since,p={x:7.5,z:18.5}){
  const s=a.state; return a.command(id,{match:s.match,phase:s.phase,round:s.round,command},now,p)
}
test('late spectator can queue but cannot alter the active crew or score',()=>{
  const a=setup(), before=a.state, id=guest(50)
  assert.equal(request(a,id,{kind:'join',genre:'kpop'}),true)
  assert.deepEqual(a.state,before); assert.equal(a.enrollment(id).position,1)
  assert.equal(request(a,id,{kind:'note',index:0,value:0},a.state.since+2000),false)
  assert.equal(request(a,id,{kind:'join',genre:'kpop'}),true)
  assert.equal(a.enrollment(id).total,1)
})
test('queue cancellation never cancels another crew show',()=>{
  const a=setup(), id=guest(50)
  request(a,id,{kind:'join',genre:'kpop'})
  assert.equal(request(a,id,{kind:'leave'}),true)
  assert.equal(a.state.phase,'training'); assert.equal(a.enrollment(id).genre,null)
})
test('stale queue packets and requests far from the chosen studio fail closed',()=>{
  const a=setup(), id=guest(50), s=a.state
  assert.equal(a.command(id,{match:'old',phase:s.phase,round:s.round,command:{kind:'join',genre:'kpop'}},s.since,{x:7.5,z:18.5}),false)
  assert.equal(request(a,id,{kind:'join',genre:'electronic'}),false)
  assert.equal(a.enrollment(id).total,0)
})
test('next show admits a third genre without skipping the selection countdown',()=>{
  const a=finish(), people=[guest(50),guest(51),guest(52),guest(53),guest(54)]
  const genres=['kpop','electronic','funk','kpop','electronic'] as const
  const positions=[{x:7.5,z:18.5},{x:40.5,z:51.5},{x:7.5,z:35},{x:7.5,z:18.5},{x:40.5,z:51.5}]
  people.forEach((id,i)=>assert.equal(request(a,id,{kind:'join',genre:genres[i]},a.state.since,positions[i]),true))
  a.tick(a.state.since+RESULT_MS,new Set(people),new Map(people.map((id,i)=>[id,positions[i]])))
  assert.equal(a.state.phase,'lobby'); assert.equal(a.state.players.length,5)
  assert.equal(a.enrollment(people[2]).genre,null)
  a.tick(a.state.since+QUEUE_MS,new Set(people))
  assert.equal(a.state.phase,'training'); assert.deepEqual(a.state.crews.map(c=>c.genre),['kpop','electronic','funk'])
})
test('queued player away from the studio is not forced into rehearsal',()=>{
  const a=finish(), id=guest(50);request(a,id,{kind:'join',genre:'kpop'})
  const now=a.state.since+RESULT_MS
  a.tick(now,new Set([id]),new Map([[id,{x:16,z:41}]]))
  assert.equal(a.state.players.length,0);assert.equal(a.enrollment(id).genre,'kpop')
  a.tick(now+100,new Set([id]),new Map([[id,{x:7.5,z:18.5}]]))
  assert.equal(a.state.players[0].id,id);assert.equal(a.enrollment(id).genre,null)
})
test('disconnected queue entries expire without interrupting current players',()=>{
  const a=setup(), id=guest(50);request(a,id,{kind:'join',genre:'kpop'})
  a.tick(a.state.since+100,connected);a.tick(a.state.since+100+DISCONNECT_GRACE_MS,connected)
  assert.equal(a.enrollment(id).total,0);assert.equal(a.state.phase,'training')
})
test('queue is bounded and repeat requests preserve position',()=>{
  const a=setup()
  for(let i=0;i<24;i++)assert.equal(request(a,guest(50+i),{kind:'join',genre:'kpop'}),true)
  assert.equal(request(a,guest(90),{kind:'join',genre:'kpop'}),false)
  assert.equal(request(a,guest(50),{kind:'join',genre:'kpop'}),true)
  assert.equal(a.enrollment(guest(50)).position,1);assert.equal(a.enrollment(guest(50)).total,24)
})
test('draws count as completed human shows but never award victory covers',async()=>{
  const s=finish().state;s.winner='draw'
  for(const c of s.crews){c.training={rhythm:0,precision:0,harmony:0,consistency:0};c.live={...c.training};c.final={...c.training}}
  const store=new MemoryStore(), ledger=new ResultLedger(store);await ledger.load()
  assert.equal(await ledger.record(s),'saved');assert.equal(await ledger.record(s),'duplicate')
  const restored=new ResultLedger(store);assert.equal(await restored.load(),true)
  assert.equal(restored.standings()[0].humanShows,1);assert.equal(restored.standings()[0].humanDraws,1)
  assert.equal(restored.standings()[0].humanWins,0);assert.equal(restored.album(ids[0]).length,0)
})
test('only confirmed HTTP absence permits empty journal initialization', () => {
  assert.equal(decodeStorageRead({ ok: false, status: 404 }), undefined)
  assert.equal(decodeStorageRead({ ok: true, status: 200, body: '{"value":"saved"}' }), 'saved')
  for (const response of [{ ok: false, status: 503 }, { ok: false, status: 401 }, { ok: true, status: 200, body: '{}' }, { ok: true, status: 200, body: 'bad' }]) {
    assert.throws(() => decodeStorageRead(response))
  }
})
