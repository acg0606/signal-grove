import { engine, Entity, Transform, UiCanvasInformation, AudioSource, inputSystem, InputAction, PointerEventType } from '@dcl/sdk/ecs'
import { Vector3, Color4 } from '@dcl/sdk/math'
import { MessageBus } from '@dcl/sdk/message-bus'
import { getPlayer } from '@dcl/sdk/src/players'
import ReactEcs, { ReactEcsRenderer, UiEntity, Label, Button } from '@dcl/sdk/react-ecs'
import { ConcertSession, CHANNEL } from './concert-session'
import { GENRE_NAMES, ATTRIBUTES, QUEUE_MS, INTERMISSION_MS, TRAINING_ROUNDS, RESULT_MS, cueFor, total, type Genre, type Command } from './concert'
import { concertLayout } from './concert-layout'
import { buildClub, refreshClub, color } from './concert-world'
import { NOTE_NAMES, noteTime, tempo, EARLY_MS, LATE_MS } from './rhythm'

type View = 'none' | 'guide' | 'options' | 'play' | 'summary' | 'result'
const bus = new MessageBus(), ink = color('ink'), white = color('white'), muted = color('muted'), cyan = color('electronic')
const NOTE_ATLAS = 'assets/images/note-symbols.png'
let session: ConcertSession | null = null, clock = Date.now(), delta = 0
let view: View = 'none', entered = '', phaseKey = '', stageSeen = '', intro = true, changedAt = 0
let sound = false, soundPreferenceSet = false, reduced = false, large = false, feedback = '', scale = 1, scorePage = 0
let attempted = 0, expired = 0, flashLane = -1, flashUntil = 0, flashHit = false, lastMistake = -Infinity
let intent: { index: number; lane: number; phase: string } | null = null
let bed: Entity, errorVoice: Entity, resultVoice: Entity, voices: Entity[] = [], audioKey = '', resultKey = ''
const px = (n: number) => n * scale
const key = () => session ? `${session.state.match}/${session.state.phase}/${session.state.round}` : ''
const active = () => !!session && ['training', 'battle'].includes(session.state.phase) && session.state.players.some(p => p.id === session!.id)
function open(v: View) { view = v; changedAt = clock; if (v !== 'none') intro = false }
function flush() { if (session) for (const p of session.drain()) bus.emit(CHANNEL, p) }
function command(c: Command) { if (session) { session.command(c, Date.now()); flush() } }
function choose(g: Genre) {
  if (!session) { feedback = 'Connecting your identity. Try the instrument again.'; return }
  const me = session.state.players.find(p => p.id === session!.id)
  if (me) {
    if (me.genre === g) open(session.state.phase === 'intermission' ? 'summary' : session.state.phase === 'result' ? 'result' : 'play')
    else feedback = 'You already joined a crew. Leave this session before switching.'
    return
  }
  if (session.state.phase !== 'lobby') { feedback = 'A show is running. Explore, then join the next one.'; return }
  if (!soundPreferenceSet) sound = true
  audioKey = ''; intro = false
  command({ kind: 'join', genre: g }); open('play')
}
function stage() {
  if (!session) return
  const s = session.state, me = s.players.find(p => p.id === session!.id)
  if (!me || s.phase === 'lobby' || s.phase === 'training') { feedback = 'Rehearse at a studio instrument first.'; return }
  if (s.phase === 'intermission') {
    // Scene interaction is local UX gating, not a cheat-proof location attestation.
    const p = getPlayer()?.position
    if (!p || Math.min((p.x-12)**2+(p.z-27)**2,(p.x-20)**2+(p.z-27)**2)>36) { feedback = 'Walk closer to a stage microphone.'; return }
    command({ kind: 'ready' }); feedback = 'Ready on stage. Waiting for the other performers.'; open('summary')
  } else if (s.phase === 'battle') open('play')
}
function playClip(entity: Entity, file: string, volume: number) {
  if (sound) AudioSource.createOrReplace(entity, { audioClipUrl: file, playing: true, loop: false, global: true, volume, currentTime: 0 })
}
function mistake() {
  if (clock - lastMistake < 180) return
  lastMistake = clock
  playClip(errorVoice, 'assets/sounds/mistake.wav', .5)
}
function tap(lane: number) {
  if (!session || !active()) return
  const s = session.state, age = Date.now() + session.offset - s.since
  const available = [0,1,2,3].filter(i => !(attempted & (1<<i)) && age >= noteTime(s.round,i,s.phase==='battle')-EARLY_MS && age <= noteTime(s.round,i,s.phase==='battle')+LATE_MS)
  available.sort((a,b)=>Math.abs(age-noteTime(s.round,a,s.phase==='battle'))-Math.abs(age-noteTime(s.round,b,s.phase==='battle')))
  if (!available.length) { feedback = 'Not yet — meet the white line.'; mistake(); return }
  const i = available[0], hit = lane === cueFor(s,session.id,i)
  attempted |= 1<<i; flashLane = lane; flashHit = hit; flashUntil = clock+220
  // Immediate local musical response; score remains coordinator-confirmed.
  if (hit) playClip(voices[lane], `assets/sounds/lead-${lane}.wav`, .75)
  else mistake()
  feedback = hit ? 'On beat — melody continues!' : 'Wrong note — catch the next one.'
  intent = {index:i,lane,phase:key()}; command({kind:'note',index:i,value:lane})
}
function line(value: string, height=28, size=18, c=white) {
  return <Label value={value} fontSize={px(size)} color={c} textAlign="middle-left" uiTransform={{width:'100%',height:px(height),flexShrink:0}} />
}
function button(value:string, action:()=>void, width:number|`${number}%`='100%', height=46, primary=false) {
  return <Button value={value} fontSize={px(17)} color={primary?ink:white} uiTransform={{width:typeof width==='number'?px(width):width,height:px(height),flexShrink:0}}
    uiBackground={{color:primary?cyan:Color4.create(.08,.045,.15,.94)}} onMouseDown={action} />
}
function noteIcon(lane:number,size:number) {
  const x=lane/3
  return <UiEntity uiTransform={{width:px(size),height:px(size),flexShrink:0}} uiBackground={{textureMode:'stretch',texture:{src:NOTE_ATLAS},uvs:[x,0,x,1,x+1/3,1,x+1/3,0]}} />
}
function instrument(height:number) {
  const s=session!.state, age=clock+session!.offset-s.since, field=height-76, enabled=active()
  return <UiEntity uiTransform={{width:'100%',height:px(height),flexDirection:'column',flexShrink:0}}>
    <UiEntity uiTransform={{width:'100%',height:px(field),positionType:'relative',flexShrink:0}}>
      {[0,1,2].map(l=><UiEntity key={l} uiTransform={{positionType:'absolute',position:{left:`${l*33.33+16}%`,top:0},width:px(1),height:'100%'}} uiBackground={{color:Color4.create(.8,.85,1,.22)}} />)}
      <UiEntity uiTransform={{positionType:'absolute',position:{left:'4%',top:px(field-22)},width:'92%',height:px(3)}} uiBackground={{color:white}} />
      {[0,1,2,3].map(i=>{
        const wait=noteTime(s.round,i,s.phase==='battle')-age,lane=cueFor(s,session!.id,i)
        const y=Math.min(field-52,Math.max(0,field-58-wait/1700*(field-58)))
        return enabled && wait<=1700 && wait>=-LATE_MS && !(attempted&(1<<i)) ?
          <UiEntity key={i} uiTransform={{positionType:'absolute',position:{left:`${lane*33.33}%`,top:px(y)},width:'33.33%',height:px(52),justifyContent:'center'}}>{noteIcon(lane,52)}</UiEntity>:null
      })}
    </UiEntity>
    <UiEntity uiTransform={{width:'100%',height:px(76),justifyContent:'space-between',flexShrink:0}}>
      {NOTE_NAMES.map((n,i)=><UiEntity key={n} uiTransform={{width:'32%',height:px(72),flexDirection:'column',alignItems:'center'}} uiBackground={{color:flashLane===i&&clock<flashUntil?Color4.create(flashHit?.12:.45,.15,.25,.9):Color4.create(.08,.045,.15,.75)}} onMouseDown={()=>tap(i)}>
        {noteIcon(i,44)}<Label value={`${n} · ${i+1}`} fontSize={px(18)} color={white} uiTransform={{width:'100%',height:px(24)}} />
      </UiEntity>)}
    </UiEntity>
  </UiEntity>
}
function ui() {
  const c=UiCanvasInformation.getOrNull(engine.RootEntity), inset=c?.interactableArea
  const l=concertLayout(c?.width??800,c?.height??600,c?.devicePixelRatio??1,inset?.left,inset?.right,inset?.top,inset?.bottom,large)
  scale=l.scale
  const s=session?.state, me=s?.players.find(p=>p.id===session?.id), crew=s?.crews.find(c=>c.genre===me?.genre)
  const age=s?clock+(session?.offset??0)-s.since:0
  const caption=feedback || (!s?'Connecting…':me&&s.phase==='intermission'?'Walk to the stage. Tap a microphone.':me&&active()?'Show continues while minimized.':me?'Your crew is preparing.':'Walk to an instrument to join a music crew.')
  const width=Math.min(l.width,420), panelHeight=Math.min(l.height,l.compact?330:444)
  if (view==='none') return <UiEntity uiTransform={{positionType:'absolute',position:{right:px(8),bottom:px(8)},width:px(Math.min(width,360)),height:px(intro?134:100),padding:px(8),flexDirection:'column'}} uiBackground={{color:Color4.create(.025,.018,.065,.80)}}>
    {intro&&line('AFFINITY ARENA · 0.8',28,19,cyan)}
    {line(caption,34,15)}
    <UiEntity uiTransform={{width:'100%',height:px(48),justifyContent:'space-between'}}>
      {button(me?'Open session':'How to play',()=>open(me?s?.phase==='intermission'?'summary':s?.phase==='result'?'result':'play':'guide'),'66%',46)}
      {button('Menu',()=>open('options'),'30%',46)}
    </UiEntity>
  </UiEntity>
  if(width<280||panelHeight<300) return <UiEntity uiTransform={{positionType:'absolute',position:{right:px(8),bottom:px(8)},width:'94%',height:px(150),flexDirection:'column'}} uiBackground={{color:ink}}>
    {line('Rotate your phone or close platform overlays.',50,16)}
    {button('Reset size',()=>{large=false},'100%',46)}{button('Minimize',()=>open('none'),'100%',46)}
  </UiEntity>
  const title=view==='guide'?'Your first show':view==='options'?'Session controls':view==='summary'?'Rehearsal complete':view==='result'?'Show results':me?GENRE_NAMES[me.genre]:'Your session'
  const a=.80+(!reduced?Math.min(1,Math.max(0,(clock-changedAt)/180))*.12:.12)
  return <UiEntity uiTransform={{positionType:'absolute',position:{right:px(8),bottom:px(8)},width:px(width),height:px(panelHeight),padding:px(12),flexDirection:'column'}} uiBackground={{color:Color4.create(.025,.018,.065,a)}}>
    <UiEntity uiTransform={{width:'100%',height:px(48),justifyContent:'space-between',flexShrink:0}}>
      <Label value={title} fontSize={px(20)} color={cyan} textAlign="middle-left" uiTransform={{width:'68%',height:px(44)}} />
      {button('Minimize',()=>open('none'),'30%',44)}
    </UiEntity>
    {view==='guide'?<UiEntity uiTransform={{width:'100%',flexDirection:'column'}}>
      {line('Walk. Play. Own the stage.',32,20)}
      {line('Tap a studio instrument to join its crew.\nRehearse for 21 seconds: hit the musical\nicons at the white line. Correct notes\nplay the lead; missed notes break it.',92,16)}
      {line('Review your attributes. Walk to a stage\nmicrophone and tap it when ready.\nLive performance counts twice.',70,16)}
      {button('Explore the studios',()=>{feedback='Find your style. Tap its instrument.';open('none')},'100%',46,true)}
    </UiEntity>:view==='options'?<UiEntity uiTransform={{width:'100%',flexDirection:'column'}}>
      {button(sound?'Sound: on — mute':'Sound: off — enable',()=>{sound=!sound;soundPreferenceSet=true;audioKey=''},'100%',44)}
      {button(large?'Size: XL':'Larger controls',()=>{large=!large},'100%',44)}
      {button(reduced?'Motion: reduced':'Reduce motion',()=>{reduced=!reduced},'100%',44)}
      {button('How to play',()=>open('guide'),'100%',44)}
      {me&&s?.phase!=='result'&&button('Leave session',()=>{command({kind:'leave'});feedback='You left the session.';open('none')},'100%',44)}
    </UiEntity>:view==='summary'&&s?<UiEntity uiTransform={{width:'100%',flexDirection:'column'}}>
      {line(crew?`${GENRE_NAMES[crew.genre]} · ${total(crew.training).toFixed(0)} / 400`:'Waiting for your crew',28,19)}
      {crew&&ATTRIBUTES.map(k=>line(`${k.toUpperCase()}    ${crew.training[k].toFixed(0)} / 100`,24,17))}
      {line(me?.ready?'Ready. Waiting for other performers.':'Walk to the stage and tap a microphone.',32,15,muted)}
      {line(`Stage check-in closes in ${Math.max(0,Math.ceil((INTERMISSION_MS-age)/1000))}s`,24,14,muted)}
      {button('Walk to stage',()=>{feedback='Follow the catwalk. Tap a stage microphone.';open('none')},'100%',46,true)}
    </UiEntity>:view==='result'&&s?<UiEntity uiTransform={{width:'100%',flexDirection:'column'}}>
      {line(s.winner==='draw'?'Draw — both crews shine!':s.winner?`${GENRE_NAMES[s.winner]} wins!`:'Show cancelled — no winner',32,20)}
      {line(s.mode==='BOT_EXHIBITION'?'Exhibition · includes simulated musicians':'Human crews',24,14,muted)}
      {s.crews.filter((_,i)=>i===scorePage%s.crews.length).map(c=><UiEntity key={c.genre} uiTransform={{width:'100%',flexDirection:'column'}}>
        {line(`${GENRE_NAMES[c.genre]} · ${total(c.final).toFixed(1)} / 400`,28,18,color(c.genre))}
        {ATTRIBUTES.map(k=>line(`${k.toUpperCase()}    ${c.final[k].toFixed(1)}`,22,16))}
      </UiEntity>)}
      {line('Final = (studio + 2 × live) ÷ 3',26,16)}
      {button('Other crew',()=>{scorePage++},'100%',44)}
    </UiEntity>:s&&me?<UiEntity uiTransform={{width:'100%',flexDirection:'column'}}>
      {s.phase==='lobby'?<UiEntity uiTransform={{width:'100%',flexDirection:'column'}}>
        {line(`Rehearsal in ${Math.max(0,Math.ceil(((s.queueAt??clock)+QUEUE_MS-clock-(session?.offset??0))/1000))}s`,36,22)}
        {line('Your crew is forming. Empty seats become\nclearly labeled simulated musicians.',60,17,muted)}
        {line(`${sound?'Sound on.':'Muted: enable sound from Menu.'}\nFollow the icons to the white strike line.\nTap the matching C, E or G pad.`,80,17)}
        {button('Explore while waiting',()=>open('none'),'100%',46)}
      </UiEntity>:active()?<UiEntity uiTransform={{width:'100%',flexDirection:'column'}}>
        {line(s.phase==='training'?`REHEARSAL ${s.round+1}/${TRAINING_ROUNDS} · ${tempo(s.round)} BPM`:`LIVE ${s.round+1}/5 · SCORE ×2`,28,18)}
        {instrument(panelHeight-24-48-28-28-22)}
        {line(feedback||'Meet the white line. Make the melody.',28,15)}
        {line(`${sound?'Sound on':'Muted · enable in Menu'} · ${s.mode==='BOT_EXHIBITION'?'Bot exhibition':'Human crews'}`,22,14,muted)}
      </UiEntity>:line('Use Open session for your latest results.',80,17)}
    </UiEntity>:<UiEntity uiTransform={{width:'100%',flexDirection:'column'}}>
      {line(session?.pending?'Joining your crew…':session?.notice||'Connecting…',80,17)}
      {button('Return to the club',()=>open('none'),'100%',46)}
    </UiEntity>}
  </UiEntity>
}
function tick() {
  if (!session) return
  const s=session.state, me=s.players.find(p=>p.id===session!.id), phase=key()
  if (me&&entered!==`${s.match}/${me.genre}`) { entered=`${s.match}/${me.genre}`; feedback='Get ready — your rehearsal is next.'; open('play') }
  if (!me&&entered) {entered='';open('none')}
  if (phase!==phaseKey) {
    const nextStage=`${s.match}/${s.phase}`, stageChanged=nextStage!==stageSeen
    phaseKey=phase;attempted=0;expired=0;intent=null;audioKey='';feedback='';scorePage=0
    if(stageChanged&&me){
      if(s.phase==='intermission')open('summary')
      else if(s.phase==='result')open('result')
      else if(s.phase==='training'||s.phase==='battle')open('play')
    }
    stageSeen=nextStage
  }
  if(intent&&!session.pending) {
    if(session.notice!=='Confirmed.'&&intent.phase===phase)feedback='Timing not confirmed. Keep following the notes.'
    intent=null
  }
  const age=clock+session.offset-s.since
  if(active())for(let i=0;i<4;i++)if(!(expired&(1<<i))&&age>noteTime(s.round,i,s.phase==='battle')+LATE_MS){
    expired|=1<<i;if(!(attempted&(1<<i))){mistake();feedback='Missed note — find the next beat.'}
  }
  const soundAge=age-(s.phase==='battle'?3000:0), nextAudio=`${phase}/${sound}`
  if(sound&&active()&&audioKey!==nextAudio&&soundAge>=0&&soundAge<7000){
    AudioSource.createOrReplace(bed,{audioClipUrl:`assets/sounds/bed-${s.round}.wav`,playing:true,loop:false,global:true,volume:.45,currentTime:soundAge/1000});audioKey=nextAudio
  }
  if(!sound||!active())for(const e of [bed,...voices,errorVoice])if(AudioSource.getOrNull(e)?.playing)AudioSource.getMutable(e).playing=false
  if(sound&&s.phase==='result'&&s.winner&&resultKey!==s.match){resultKey=s.match;playClip(resultVoice,'assets/sounds/resolve.wav',.4)}
  if(!sound&&AudioSource.getOrNull(resultVoice)?.playing)AudioSource.getMutable(resultVoice).playing=false
  if(session.notice&&/No confirmation|Not accepted|Connection changed/.test(session.notice))feedback=session.notice
  refreshClub(s,clock,reduced)
}
export function main() {
  buildClub(choose,stage)
  const voice=(file:string)=>{const e=engine.addEntity();Transform.create(e,{position:Vector3.create(16,2,26)});AudioSource.create(e,{audioClipUrl:file,playing:false,loop:false,global:true,volume:.5});return e}
  bed=voice('assets/sounds/bed-0.wav');voices=[0,1,2].map(i=>voice(`assets/sounds/lead-${i}.wav`));errorVoice=voice('assets/sounds/mistake.wav');resultVoice=voice('assets/sounds/resolve.wav')
  bus.on(CHANNEL,(packet:unknown,sender:string)=>{if(session&&sender&&sender!=='self'){session.receive(packet,sender.toLowerCase(),Date.now());flush()}})
  engine.addSystem(dt=>{
    for(const [i,action] of [InputAction.IA_ACTION_3,InputAction.IA_ACTION_4,InputAction.IA_ACTION_5].entries())if(inputSystem.isTriggered(action,PointerEventType.PET_DOWN))tap(i)
    delta+=dt;if(delta<.05)return;delta=0;clock=Date.now()
    const id=getPlayer()?.userId?.toLowerCase()
    if(!id){session=null;for(const e of [bed,...voices,errorVoice,resultVoice])if(AudioSource.getOrNull(e)?.playing)AudioSource.getMutable(e).playing=false;return}
    if(!session||session.id!==id){session=new ConcertSession(id,clock);entered='';open('none')}
    session.tick(clock);flush();tick()
  })
  ReactEcsRenderer.setUiRenderer(ui,{virtualWidth:0,virtualHeight:0,screenInset:'interactable'})
}
