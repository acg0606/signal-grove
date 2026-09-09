import test from 'node:test'
import assert from 'node:assert/strict'
import { Warmup, ChangeGate, crewAvailability, lobbyHint, phaseCue } from '../src/arena-experience'
import { newArena, applyCommand, type Command } from '../src/arena'
import { noteTime } from '../src/rhythm'

test('solo warm-up teaches all six tempos without mutating the multiplayer arena', () => {
  const arena = newArena(0, 'live'), before = JSON.stringify(arena)
  for (let round = 0; round < 6; round++) {
    const drill = new Warmup(1000, round)
    for (let i = 0; i < 4; i++) drill.tap(drill.lane(i), 1000 + noteTime(round, i))
    assert.equal(drill.hits, 4)
    assert.equal(drill.done(7999), false)
    assert.equal(drill.done(8000), true)
  }
  assert.equal(JSON.stringify(arena), before)
  assert.equal(arena.players.length, 0)
  assert.equal(arena.crews.length, 0)
})
test('warm-up rejects invalid, too early, duplicate and post-round taps', () => {
  const drill = new Warmup(0)
  drill.tap(0, 100); drill.tap(9, 2000)
  assert.equal(drill.mask, 0)
  drill.tap(1, 2000) // wrong lane consumes this note
  drill.tap(0, 2000)
  assert.equal(drill.hits, 0)
  assert.match(drill.feedback, /Wait/)
  const before = drill.mask
  drill.tap(0, 8000)
  assert.equal(drill.mask, before)
})
test('crew labels disclose selected, ready, full and next-match state', () => {
  let s = newArena(0, 'test')
  const send = (id: string, command: Command) => { s = applyCommand(s, id, {match:s.match, phase:s.phase, round:s.round, command}, 0) }
  send('a', {kind:'join', genre:'kpop'}); send('b', {kind:'join', genre:'funk'})
  assert.equal(crewAvailability(s,'c','latin').reason,'Next match')
  assert.equal(crewAvailability(s,'a','kpop').reason,'Your crew')
  assert.equal(crewAvailability(s,'a','funk').enabled,false)
  send('a', {kind:'ready'})
  assert.equal(crewAvailability(s,'a','kpop').reason,'Ready')
  assert.match(lobbyHint(s,'a'), /2 more fans/)
  send('c', {kind:'join', genre:'kpop'})
  assert.equal(crewAvailability(s,'d','kpop').reason,'Crew full')
  assert.equal(crewAvailability(s,'d','funk',true).enabled,false)
})
test('phase transition cues match authoritative deadlines and never delay input', () => {
  const s = {...newArena(0,'test'),phase:'battle' as const}
  assert.match(phaseCue(s,3499).text,/Choose/)
  assert.match(phaseCue(s,3500).text,/locked/)
  assert.match(phaseCue(s,5000).text,/Duel/)
  assert.equal(phaseCue(s,12001).progress,1)
  assert.equal(phaseCue(s,-1).progress,0)
})
test('30 seconds of unchanged stage data cause one write per key, not per tick', () => {
  const gate = new ChangeGate()
  let writes = 0
  for(let frame=0;frame<600;frame++) for(let key=0;key<27;key++) if(gate.changed(`${key}`,0)) writes++
  assert.equal(writes,27)
  assert.equal(gate.changed('hp',100),true)
  assert.equal(gate.changed('hp',100),false)
  assert.equal(gate.changed('hp',87),true)
})
