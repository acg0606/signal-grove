import test from 'node:test'
import assert from 'node:assert/strict'
import { ConcertAuthority } from '../src/authority'
import { AuthorityClient } from '../src/client'
import { GENRES, QUEUE_MS, TRAINING_MS, TRAINING_ROUNDS, INTERMISSION_MS, PRESENTATION_MS, TURN_MS, BATTLE_ROUNDS, RESULT_MS, cueFor, phaseSeconds, qualify, validSnapshot, isPerformer, type Command, type Genre } from '../src/rules/concert'
import { studioPosition, performancePosition, VENUE } from '../src/rules/concert-sheet'
import { noteTime } from '../src/rules/rhythm'
import { ResultLedger, type Store } from '../src/ledger'

const ids=Array.from({length:12},(_,i)=>'0x'+(i+1).toString(16).padStart(40,'0'))
const connected=new Set(ids)
function send(a:ConcertAuthority,i:number,command:Command,now=a.state.since,position=studioPosition(GENRES[Math.floor(i/2)])){
 const s=a.state
 return a.command(ids[i],{match:s.match,phase:s.phase,round:s.round,command},now,position)
}
function sixCrews(){
 const a=new ConcertAuthority(1000,'six-crews')
 ids.forEach((_,i)=>assert.equal(send(a,i,{kind:'join',genre:GENRES[Math.floor(i/2)]}),true))
 a.tick(1000+QUEUE_MS-1,connected);assert.equal(a.state.phase,'lobby');assert.equal(phaseSeconds(a.state,30999),1)
 a.tick(1000+QUEUE_MS,connected);assert.equal(a.state.phase,'training')
 return a
}
function train(a:ConcertAuthority,genres:Genre[]=['kpop','electronic']){
 for(let r=0;r<TRAINING_ROUNDS;r++){
  const since=a.state.since
  for(let n=0;n<4;n++)ids.forEach((id,i)=>{if(genres.includes(GENRES[Math.floor(i/2)]))
   assert.equal(send(a,i,{kind:'note',index:n,value:cueFor(a.state,id,n)},since+noteTime(r,n,false)),true)
  })
  a.tick(since+TRAINING_MS,connected)
 }
 return a
}
test('12 human players share one timed selection and six-crew qualification phase',()=>{
 const a=sixCrews()
 assert.equal(a.state.players.length,12);assert.equal(a.state.crews.length,6)
 assert.equal(validSnapshot(a.state),true);assert.equal(phaseSeconds(a.state,a.state.since),30)
 a.tick(a.state.since+TRAINING_MS,connected);assert.equal(phaseSeconds(a.state,a.state.since),20)
 a.tick(a.state.since+TRAINING_MS,connected);assert.equal(phaseSeconds(a.state,a.state.since),10)
})
test('only top two training crews qualify, independent of selection order',()=>{
 const a=train(sixCrews())
 assert.equal(a.state.phase,'intermission')
 assert.deepEqual(new Set(a.state.finalists),new Set(['kpop','electronic']))
 assert.equal(a.state.finalists.length,2);assert.equal(validSnapshot(a.state),true)
 assert.equal(isPerformer(a.state,ids[2]),false);assert.equal(isPerformer(a.state,ids[0]),true)
 assert.equal(send(a,2,{kind:'ready'},a.state.since,{x:18,y:1,z:69.5}),false)
})
test('ties are stable within a show and seeded rotation is not a fixed genre advantage',()=>{
 const a=sixCrews(), winners=new Set<string>()
 for(let seed=0;seed<6;seed++){const s={...a.state,seed};assert.deepEqual(qualify(s),qualify(s));winners.add(qualify(s)[0])}
 assert.equal(winners.size,6)
})
test('eliminated participants can queue again while watching without changing this final',()=>{
 const a=train(sixCrews()), before=JSON.stringify(a.state)
 assert.equal(send(a,2,{kind:'join',genre:'funk'}),true)
 assert.equal(JSON.stringify(a.state),before);assert.equal(a.enrollment(ids[2]).position,1)
 const c=new AuthorityClient(ids[2],a.state.since)
 c.receiveEnrollment(a.enrollment(ids[2]),a.state.since)
 assert.equal(c.receiveState(a.state,a.state.since,true,a.state.since),true)
 assert.equal(c.enrollment.genre,'funk')
})
test('stage access and scoring remain closed to eliminated crews at both front microphones',()=>{
 const a=train(sixCrews())
 a.tick(a.state.since+INTERMISSION_MS,connected);a.tick(a.state.since+PRESENTATION_MS,connected)
 assert.equal(performancePosition(a.state,ids[2]),null)
 for(const x of VENUE.stageXs)assert.equal(send(a,2,{kind:'note',index:0,value:cueFor(a.state,ids[2],0)},a.state.since+noteTime(0,0,true),{x,y:1,z:VENUE.stagePlayZ}),false)
})
test('ready confirmations do not shorten the walking interval and missing check-ins never freeze the cycle',()=>{
 const a=train(sixCrews()), since=a.state.since
 for(const i of [0,1,10,11]){
  const member=a.state.players.find(p=>p.id===ids[i])!
  assert.equal(send(a,i,{kind:'ready'},since,{x:VENUE.stageXs[a.state.finalists.indexOf(member.genre)],y:1,z:VENUE.stagePlayZ}),true)
 }
 assert.equal(a.state.phase,'intermission');a.tick(since+INTERMISSION_MS-1,connected);assert.equal(a.state.phase,'intermission')
 a.tick(since+INTERMISSION_MS,connected);assert.equal(a.state.phase,'presentation')
 const b=train(sixCrews());b.tick(b.state.since+INTERMISSION_MS,connected);assert.equal(b.state.phase,'presentation')
})
test('30-second live final, 2x weighting, finalist-only saved history and next cycle',async()=>{
 const a=train(sixCrews())
 a.tick(a.state.since+INTERMISSION_MS,connected);a.tick(a.state.since+PRESENTATION_MS,connected)
 for(let r=0;r<BATTLE_ROUNDS;r++){
  const since=a.state.since;assert.equal(phaseSeconds(a.state,since),30-r*10)
  for(let n=0;n<4;n++)for(const i of [0,1]){
   const p=performancePosition(a.state,ids[i])!
   assert.equal(send(a,i,{kind:'note',index:n,value:cueFor(a.state,ids[i],n)},since+noteTime(r,n,true),p),true)
  }
  a.tick(since+TURN_MS,connected)
 }
 assert.equal(a.state.phase,'result');assert.equal(a.state.winner,'kpop');assert.equal(validSnapshot(a.state),true)
 assert.equal(a.state.crews.find(c=>c.genre==='electronic')!.final.rhythm,33.33)
 const data=new Map<string,string>(), store:Store={get:async k=>data.get(k),set:async(k,v)=>{data.set(k,v);return true}}
 const ledger=new ResultLedger(store);await ledger.load();assert.equal(await ledger.record(a.state),'saved')
 const restored=new ResultLedger(store);assert.equal(await restored.load(),true)
 assert.equal(restored.standings().find(s=>s.genre==='kpop')!.humanWins,1)
 assert.equal(restored.standings().find(s=>s.genre==='electronic')!.humanShows,1)
 assert.equal(restored.standings().find(s=>s.genre==='funk')!.humanShows,0)
 assert.equal(restored.album(ids[0]).length,1);assert.equal(restored.album(ids[2]).length,0)
 const old=a.state.match;a.tick(a.state.since+RESULT_MS,connected)
 assert.equal(a.state.phase,'lobby');assert.notEqual(a.state.match,old);assert.equal(phaseSeconds(a.state,a.state.since),30)
})
test('full snapshot including 24 note fields fits the actual 9000-character transport budget',()=>{
 const a=sixCrews()
 for(let n=0;n<4;n++)ids.forEach((id,i)=>send(a,i,{kind:'note',index:n,value:cueFor(a.state,id,n)},a.state.since+noteTime(0,n,false)))
 const s=a.state;assert.equal(Object.keys(s.choices).length,24);assert.equal(validSnapshot(s),true)
 assert.ok(JSON.stringify(s).length<9000);const clients=ids.map(id=>new AuthorityClient(id,s.since))
 clients.forEach(c=>assert.equal(c.receiveState(s,s.since,true,s.since),true))
 assert.equal(new Set(clients.map(c=>JSON.stringify(c.state))).size,1)
})
test('every studio fits the larger venue and selection never exposes a stage scoring position',()=>{
 const a=sixCrews()
 for(const g of GENRES){const p=studioPosition(g);assert.ok(p.x>6&&p.x<VENUE.width-6&&p.z>8&&p.z<VENUE.gateZ-6)}
 const b=new ConcertAuthority(0,'empty');b.tick(QUEUE_MS,new Set())
 assert.equal(b.state.phase,'lobby');assert.equal(phaseSeconds(b.state,QUEUE_MS),30)
 assert.equal(performancePosition(b.state,ids[0]),null)
})
