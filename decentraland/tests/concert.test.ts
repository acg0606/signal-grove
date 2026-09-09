import test from 'node:test'
import assert from 'node:assert/strict'
import { advance, applyCommand, newArena, combine, total, cueFor, publicSnapshot, validSnapshot, roundAttributes, GENRES, type Arena, type Command } from '../src/concert'
import { noteTime } from '../src/rhythm'
import { concertLayout, CONCERT_RGB } from '../src/concert-layout'
import { ConcertSession } from '../src/concert-session'
const cmd = (s: Arena, id: string, command: Command, now = s.since) => applyCommand(s, id, { match: s.match, phase: s.phase, round: s.round, command }, now)
function joined(count = 1) { let s = newArena(1000, 'a:1000', 42); for (let i = 0; i < count; i++) s = cmd(s, String.fromCharCode(97 + i), { kind: 'join', genre: i < 2 ? 'kpop' : 'funk' }); return s }
test('solo has a finite visible queue and three explicitly labeled bots', () => {
  const s = joined(); assert.equal(s.queueAt, 1000); assert.equal(advance(s, 20999), s)
  const n = advance(s, 21000); assert.equal(n.phase, 'training'); assert.equal(n.mode, 'BOT_EXHIBITION')
  assert.equal(n.players.filter(p => p.bot).length, 3); assert.equal(n.players.filter(p => !p.bot).length, 1); assert.ok(validSnapshot(n))
})
test('four humans skip remaining queue and never create bots', () => {
  const n = advance(joined(4), 1000); assert.equal(n.phase, 'training'); assert.equal(n.mode, 'HUMAN_MATCH'); assert.ok(n.players.every(p => !p.bot))
})
test('leaving an empty queue cancels its timer; a later join gets a fresh countdown', () => {
  let s = cmd(joined(), 'a', { kind: 'leave' }, 1500); assert.equal(s.queueAt, null); assert.equal(advance(s, 40000), s)
  s = cmd(s, 'b', { kind: 'join', genre: 'funk' }, 41000); assert.equal(s.queueAt, 41000)
})
test('crew capacity, identity and membership reject invalid joins and third genres', () => {
  let s = joined(3)
  assert.equal(cmd(s, 'a', { kind: 'join', genre: 'funk' }), s)
  assert.equal(cmd(s, 'd', { kind: 'join', genre: 'kpop' }), s)
  assert.equal(cmd(s, 'd', { kind: 'join', genre: 'latin' }), s)
  assert.equal(cmd(s, 'bot:evil', { kind: 'join', genre: 'funk' }), s)
})
test('live attributes have exactly double weight and no genre bonus', () => {
  const a = { rhythm: 90, precision: 30, harmony: 60, consistency: 0 }, b = { rhythm: 30, precision: 90, harmony: 0, consistency: 60 }
  assert.deepEqual(combine(a, b), { rhythm: 50, precision: 70, harmony: 20, consistency: 40 }); assert.equal(total(combine(a, b)), 180)
  assert.deepEqual(roundAttributes(255, 255, 15, 15), { rhythm: 100, precision: 100, harmony: 100, consistency: 100 })
  assert.deepEqual(roundAttributes(0, 0, 0, 0), { rhythm: 0, precision: 0, harmony: 0, consistency: 0 })
})
test('note timing, wrong lanes, duplicate taps and precision use actual attempts', () => {
  const s = advance(joined(4), 1000), target = s.since + noteTime(0, 0), c: Command = { kind: 'note', index: 0, value: cueFor(s, 'a', 0) }
  assert.equal(cmd(s, 'a', c, target - 181), s)
  const n = cmd(s, 'a', c, target); assert.equal(n.choices['a:perfect'], 1); assert.equal(cmd(n, 'a', c, target + 20), n)
  const late = cmd(s, 'a', c, target + 200); assert.equal(late.choices['a:perfect'], undefined); assert.equal(late.choices['a:notes'], 17)
  const wrong = cmd(s, 'a', { ...c, value: (c.value + 1) % 3 }, target); assert.equal(wrong.choices['a:notes'], 1)
})
test('complete perfect human show reaches maximum and draw; misses score zero', () => {
  let s = advance(joined(4), 1000)
  while (s.phase !== 'result') {
    for (let i = 0; i < 4; i++) for (const p of s.players) s = cmd(s, p.id, { kind: 'note', index: i, value: cueFor(s, p.id, i) }, s.since + noteTime(s.round, i, s.phase === 'battle'))
    s = advance(s, s.since + (s.phase === 'training' ? 7000 : 12000)); assert.ok(validSnapshot(s))
  }
  assert.equal(s.winner, 'draw'); assert.equal(total(s.crews[0].final), 400)
  let missed = advance(joined(4), 1000)
  while (missed.phase !== 'result') missed = advance(missed, missed.since + (missed.phase === 'training' ? 7000 : 12000))
  assert.equal(total(missed.crews[0].final), 0); assert.equal(missed.winner, 'draw')
})
test('bot exhibition finishes deterministically without invented humans or guaranteed player wins', () => {
  function run() { let s = advance(joined(), 21000); while (s.phase !== 'result') s = advance(s, s.since + (s.phase === 'training' ? 7000 : 12000)); return s }
  assert.deepEqual(run(), run()); const s = run(); assert.equal(s.mode, 'BOT_EXHIBITION'); assert.ok(s.crews.some(c => total(c.final) > 0)); assert.ok(validSnapshot(s))
  assert.equal(advance(s, s.since + 24000).players.length, 0)
})
test('a departure cancels the show instead of manufacturing victory', () => {
  const s = cmd(advance(joined(4), 1000), 'a', { kind: 'leave' }, 2000)
  assert.equal(s.phase, 'result'); assert.equal(s.winner, null)
})
test('snapshots reject NaN, bot identity spoofing, overfull crews and malicious choice keys', () => {
  const s = advance(joined(4), 1000)
  for (const mutate of [(n: Arena) => { n.crews[0].live.rhythm = NaN }, (n: Arena) => { n.players[0].bot = true }, (n: Arena) => { n.players[0].genre = 'funk' }, (n: Arena) => { n.choices['__proto__bad'] = 2 }]) {
    const n = publicSnapshot(s); mutate(n); assert.equal(validSnapshot(n), false)
  }
  assert.equal(publicSnapshot(s).version, s.version)
})
test('high-density phone scale, portrait, landscape and enlarged UI fit safe dimensions', () => {
  for (const [w, h, d] of [[390,844,1],[844,390,1],[1080,2340,3],[2340,1080,3],[1440,900,1]]) for (const large of [false,true]) {
    const l = concertLayout(w,h,d,0,0,0,0,large); assert.ok((l.width + 16) * l.scale <= w + .01); assert.ok((l.height + 16) * l.scale <= h + .01)
    assert.ok(64*l.scale >= 64)
  }
  assert.equal(concertLayout(1080,2340,3).scale,1080/390)
})
test('crew and foreground labels have sufficient contrast on dark surfaces', () => {
  const lum = (rgb: readonly number[]) => rgb.map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0)
  for (const name of [...GENRES,'white','muted'] as const) assert.ok((lum(CONCERT_RGB[name])+.05)/(lum(CONCERT_RGB.panel)+.05)>=4.5,name)
})
test('two simulated participant sessions agree on bots, scores and result', () => {
  let now = 1000
  const sessions = [new ConcertSession('a', now), new ConcertSession('b', now)]
  const flush = () => { for(let tries=0;tries<30;tries++) { let any=false; for(const from of sessions) for(const p of from.drain()) { any=true; for(const to of sessions) if(to!==from) to.receive(p,from.id,now) } if(!any) return } throw Error('outbox loop') }
  for(const s of sessions)s.tick(now);flush()
  sessions[0].command({kind:'join',genre:'kpop'},now);flush(); sessions[1].command({kind:'join',genre:'funk'},now);flush()
  for(let i=0;i<125;i++){ now+=1000;for(const s of sessions)s.tick(now);flush() }
  assert.equal(sessions[0].state.phase,'result'); assert.deepEqual(sessions[0].state,sessions[1].state)
  assert.equal(sessions[0].state.players.filter(p=>p.bot).length,2)
})
test('bot-like transport senders cannot enter the peer election', () => {
  const s = new ConcertSession('a',1000); s.tick(1000);s.receive({kind:'hello',incarnation:1000},'bot:fake',1000);assert.equal(s.host,'a')
  assert.throws(()=>new ConcertSession('bot:fake',1000))
})
