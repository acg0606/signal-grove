import { engine, Entity, Transform, UiCanvasInformation, AudioSource, inputSystem, InputAction, PointerEventType } from '@dcl/sdk/ecs'
import { Vector3, Color4 } from '@dcl/sdk/math'
import { getPlayer } from '@dcl/sdk/src/players'
import ReactEcs, { ReactEcsRenderer, UiEntity, Label, Button } from '@dcl/sdk/react-ecs'
import { AuthorityClient as ConcertSession } from '../src/client'
import { connectClient, flushClient, refreshNotebook, syncClock } from '../src/client-network'
import { GENRE_NAMES, ATTRIBUTES, QUEUE_MS, INTERMISSION_MS, TRAINING_ROUNDS, RESULT_MS, BATTLE_ROUNDS, phaseSeconds, phaseTitle, isPerformer, cueFor, total, type Genre, type Command } from './concert'
import { concertLayout } from './concert-layout'
import { buildClub, refreshClub, refreshResidents, color, ATLAS, crewUV } from './concert-world'
import { HUD_TYPE, hudLineHeight, wrapHudText, paginateRows } from './studio-life'
import { nearPerformance, VENUE } from './concert-sheet'
import { ServerNotebook as VisitMemories } from '../src/notebook'
import { NOTE_NAMES, noteTime, tempo, EARLY_MS, LATE_MS } from './rhythm'

type View = 'none' | 'guide' | 'options' | 'accessibility' | 'play' | 'summary' | 'result' | 'album' | 'standings' | 'queue'
const ink = color('ink'), white = color('white'), muted = color('muted'), cyan = color('electronic')
const NOTE_ATLAS = 'assets/images/note-symbols.png'
let session: ConcertSession | null = null, clock = Date.now(), delta = 0
let view: View = 'none', entered = '', phaseKey = '', stageSeen = '', intro = true, changedAt = 0
let sound = false, soundPreferenceSet = false, reduced = false, large = false, feedback = '', scale = 1, scorePage = 0
let attempted = 0, expired = 0, flashLane = -1, flashUntil = 0, flashHit = false, lastMistake = -Infinity
let intent: { index: number; lane: number; phase: string } | null = null
let memories = new VisitMemories(), albumPage = 0, announced = ''
let disconnect = () => {}, networkAt = -Infinity, notebookAt = -Infinity, genrePage = 0
let queueKey = ''
let panelPage=0, checkInAt=-Infinity
let announcer: Entity
let bed: Entity, errorVoice: Entity, resultVoice: Entity, voices: Entity[] = [], audioKey = '', resultKey = ''
const px = (n: number) => n * scale
const key = () => session ? `${session.state.match}/${session.state.phase}/${session.state.round}` : ''
const active = () => !!session?.ready && ['training', 'battle'].includes(session.state.phase) && isPerformer(session.state,session.id)
function open(v: View) { view = v; panelPage=0; changedAt = clock; if (v !== 'none') intro = false; if(v==='album'||v==='standings')refreshNotebook() }
function flush() { if (session) flushClient(session) }
function command(c: Command) { if (session) { session.command(c, Date.now()); flush() } }
function choose(g: Genre) {
  if (!session) { feedback = 'Connecting your identity. Try the studio panel again.'; return }
  if (!session.ready) { feedback = session.notice; return }
  const me = session.state.players.find(p => p.id === session!.id)
  if (session.enrollment.genre) { open('queue'); return }
  if (me && !me.withdrawn && session.state.phase !== 'result' && (!session.state.finalists.length || session.state.finalists.includes(me.genre))) {
    if (me.genre === g) open(session.state.phase === 'intermission' ? 'summary' : 'play')
    else feedback = 'You already joined a crew. Leave this session before switching.'
    return
  }
  if (!soundPreferenceSet) sound = true
  audioKey = ''; intro = false
  command({ kind: 'join', genre: g }); feedback = 'Waiting for studio enrollment confirmation.'; open('play')
}
function stage() {
  if (!session) return
  const s = session.state, me = s.players.find(p => p.id === session!.id)
  if (!me || !s.finalists.includes(me.genre) || me.withdrawn || s.phase === 'lobby' || s.phase === 'training') { feedback = 'Rehearse at a studio panel first.'; return }
  if (s.phase === 'intermission') {
    // Scene interaction is local UX gating, not a cheat-proof location attestation.
    const p = getPlayer()?.position
    const target=VENUE.stageXs[s.finalists.indexOf(me.genre)]
    if (!p || p.z<VENUE.gateZ+.3 || Math.hypot(p.x-target,p.z-VENUE.stagePlayZ)>6) { feedback = 'Walk up the ramp to your crew side.'; return }
    if(me.ready)return
    command({ kind: 'ready' }); feedback = session.state.players.find(p=>p.id===session!.id)?.ready?'Checked in. Watch your floor monitor.':'Confirming stage check-in...'; open('none')
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
  if (!nearPerformance(session.state, session.id, getPlayer()?.position)) { feedback = 'Stand in front of your crew panel to play.'; return }
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
function line(value: string, height=34, size:number=HUD_TYPE.body, c=white) {
  return <Label value={value} fontSize={px(size)} color={c} textAlign="middle-left" uiTransform={{width:'100%',height:px(height),flexShrink:0}} />
}
function button(value:string, action:()=>void, width:number|`${number}%`='100%', height=60, primary=false) {
  return <Button value={value} fontSize={px(HUD_TYPE.action)} color={primary?ink:white} uiTransform={{width:typeof width==='number'?px(width):width,height:px(height),flexShrink:0}}
    uiBackground={{color:primary?cyan:Color4.create(.08,.045,.15,.94)}} onMouseDown={action} />
}
function noteIcon(lane:number,size:number) {
  const x=lane/3
  return <UiEntity uiTransform={{width:px(size),height:px(size),flexShrink:0}} uiBackground={{textureMode:'stretch',texture:{src:NOTE_ATLAS},uvs:[x,0,x,1,x+1/3,1,x+1/3,0]}} />
}
function instrument() {
  return <UiEntity uiTransform={{width:'100%',height:px(84),justifyContent:'space-between',flexShrink:0}}>
    {NOTE_NAMES.map((note,i)=><UiEntity key={note} uiTransform={{width:'32%',height:px(80),flexDirection:'column',alignItems:'center'}} uiBackground={{color:flashLane===i&&clock<flashUntil?Color4.create(flashHit?.12:.45,.15,.25,.95):Color4.create(.08,.045,.15,.9)}} onMouseDown={()=>tap(i)}>
      {noteIcon(i,36)}
      <Label value={`${note} · ${i+1}`} fontSize={px(HUD_TYPE.note)} color={white} textAlign="middle-center" uiTransform={{width:'100%',height:px(44),flexShrink:0}} />
    </UiEntity>)}
  </UiEntity>
}
function contentUi() {
  const c=UiCanvasInformation.getOrNull(engine.RootEntity), inset=c?.interactableArea
  const l=concertLayout(c?.width??800,c?.height??600,c?.devicePixelRatio??1,inset?.left,inset?.right,inset?.top,inset?.bottom,large)
  scale=l.scale
  const s=session?.state, me=s?.players.find(p=>p.id===session?.id), crew=s?.crews.find(c=>c.genre===me?.genre), q=session?.enrollment
  const width=Math.min(l.width,460), panelHeight=Math.min(l.height-44,480)
  const viewportWidth=((c?.width??800)-(inset?.left??0)-(inset?.right??0))/scale
  const viewportHeight=((c?.height??600)-(inset?.top??0)-(inset?.bottom??0))/scale
  const playWidth=viewportWidth*(l.width>600?.5:.9)
  const caption=!session?.ready?'Connecting. Please wait.':q?.genre?`Queue ${q.position} / ${GENRE_NAMES[q.genre]}`:s?.phase==='intermission'&&me&&!me.withdrawn&&s.finalists.includes(me.genre)?me.ready?'Checked in. Watch your monitor.':`Stage open: take the ramp. ${s.finalists.indexOf(me.genre)===0?'Left':'Right'} crew side.`:!me?'Tap a studio panel to join.':active()?'Follow your crew notes.':'Your crew is preparing.'
  const miniText=wrapHudText(caption,Math.min(width,390)-16,HUD_TYPE.body),miniHeight=miniText.split('\n').length*hudLineHeight(HUD_TYPE.body)
  if(view==='none') return <UiEntity uiTransform={{positionType:'absolute',position:{left:px(8),bottom:px(8)},width:px(Math.min(width,390)),height:px(76+miniHeight+(intro?28:0)),padding:px(8),flexDirection:'column'}} uiBackground={{color:Color4.create(.025,.018,.065,.88)}}>
    {intro&&line('FESTIVAL BETA',28,HUD_TYPE.metadata,cyan)}
    {line(miniText,miniHeight,HUD_TYPE.body)}
    <UiEntity uiTransform={{width:'100%',height:px(60),justifyContent:'space-between'}}>
      {button(q?.genre?'Your queue':me?'Open session':'How to play',()=>open(q?.genre?'queue':me?s?.phase==='intermission'?'summary':s?.phase==='result'?'result':'play':'guide'),'68%',60)}
      {button('Menu',()=>open('options'),'28%',60)}
    </UiEntity>
  </UiEntity>
  if(view==='play'&&active()&&(playWidth<280||viewportHeight<328))return <UiEntity uiTransform={{positionType:'absolute',position:{left:px(8),bottom:px(8)},width:'94%',height:px(144),padding:px(8),flexDirection:'column'}} uiBackground={{color:ink}}>{line('Rotate or close overlays\nto reveal the rhythm pads.',68,HUD_TYPE.metadata)}{button('Hide',()=>open('none'),'100%',60)}</UiEntity>
  const playText=wrapHudText(feedback||'C / E / G on the line.',playWidth-16,HUD_TYPE.metadata),playTextHeight=playText.split('\n').length*hudLineHeight(HUD_TYPE.metadata)
  if(view==='play'&&active()) return <UiEntity uiTransform={{positionType:'absolute',position:{left:l.width>600?'25%':'5%',bottom:px(12)},width:px(playWidth),height:px(160+playTextHeight),padding:px(8),flexDirection:'column'}} uiBackground={{color:Color4.create(.025,.018,.065,.88)}}>
    <UiEntity uiTransform={{width:'100%',height:px(60),justifyContent:'space-between'}}>
      <Label value={s?.phase==='training'?`TRAIN ${s.round+1}/3`:`LIVE ${(s?.round??0)+1}/${BATTLE_ROUNDS} x2`} fontSize={px(HUD_TYPE.action)} color={white} uiTransform={{width:'64%',height:px(60)}} />
      {button('Hide',()=>open('none'),'32%',60)}
    </UiEntity>
    {instrument()}
    {line(playText,playTextHeight,HUD_TYPE.metadata)}
  </UiEntity>
  if(width<280||panelHeight<260) return <UiEntity uiTransform={{positionType:'absolute',position:{left:px(8),bottom:px(8)},width:'94%',height:px(204),padding:px(8),flexDirection:'column'}} uiBackground={{color:ink}}>
    {line('Rotate your phone or close\nplatform overlays.',68,HUD_TYPE.metadata)}
    {button('Reset size',()=>{large=false},'100%',60)}{button('Hide',()=>open('none'),'100%',60)}
  </UiEntity>
  const title=view==='queue'?'Your next show':view==='guide'?'Your first show':view==='options'?'Session menu':view==='accessibility'?'Comfort settings':view==='summary'?'Rehearsal result':view==='album'?'ENCORE album':view==='standings'?'Genre standings':view==='result'?'Show results':me?GENRE_NAMES[me.genre]:'Your session'
  const rows:{element:ReturnType<typeof line>;height:number}[]=[]
  const text=(value:string,legacySize=18,c=white)=>{
    const size=legacySize<=16?HUD_TYPE.metadata:legacySize>=24?HUD_TYPE.heading:HUD_TYPE.body
    const lines=wrapHudText(value,width-24,size).split('\n')
    // Two-line chunks permit pagination without shrinking type or hiding disclosures.
    for(let i=0;i<lines.length;i+=2){const part=lines.slice(i,i+2);const height=part.length*hudLineHeight(size);rows.push({element:line(part.join('\n'),height,size,c),height:height+6})}
  }
  const action=(label:string,fn:()=>void,primary=false)=>rows.push({element:button(label,fn,'100%',60,primary),height:66})
  if(view==='options'){
    action('Sound & display',()=>open('accessibility'))
    action('How to play',()=>open('guide'))
    action('ENCORE album',()=>open('album'))
    action('Genre standings',()=>open('standings'))
  }else if(view==='accessibility'){
    action(sound?'Sound: on / mute':'Sound: off / enable',()=>{sound=!sound;soundPreferenceSet=true;audioKey=''})
    action(large?'Larger text: on':'Larger text: off',()=>{large=!large})
    action(reduced?'Motion: reduced':'Reduce motion',()=>{reduced=!reduced})
    if(me&&s?.phase!=='result')action('Leave session',()=>{command({kind:'leave'});feedback='You left the session.';open('none')})
    else action('Back to menu',()=>open('options'))
  }else if(view==='queue'){
    text(q?.genre?GENRE_NAMES[q.genre]:'Checking enrollment...',24,cyan)
    text(q?.genre?`Queue position ${q.position} / ${q.total} waiting`:'No queue entry confirmed.')
    text('Stay near your studio. Join when a crew seat is free.')
    text(session?.ready?'Your current show stays untouched.':'Reconnecting. Queue may be stale.',16,muted)
    action('Watch while waiting',()=>open('none'))
    if(q?.genre)action('Leave queue',()=>{command({kind:'leave'});feedback='Waiting for queue cancellation.'})
  }else if(view==='guide'){
    text('Walk. Play. Own the stage.',24,cyan)
    text('30s to choose a studio. Tap its big front panel to join.')
    text('Train for 30s. Read the staff right to left. Tap C, E or G at the white line.')
    text('Hits stay on the page. Misses fall. Your timing builds crew attributes.')
    text('The top two crews qualify. Follow the lights and check in on stage.')
    text('Play a 30s live final using your floor monitor. Live performance counts twice.')
    text('Other players watch or queue. The festival repeats. NPC hosts never score.',16,muted)
    action('Explore the studios',()=>{feedback='Find your style. Tap its studio panel.';open('none')},true)
  }else if(view==='album'){
    text(memories.loaded?(session?.ready?'Saved covers / latest 8':'Last saved covers / reconnecting'):memories.status,16,muted)
    if(memories.album.length){
      const cover=memories.album[albumPage%memories.album.length]
      text(GENRE_NAMES[cover.genre],24,cyan)
      rows.push({element:<UiEntity uiTransform={{width:'100%',height:px(48),alignItems:'center',justifyContent:'center'}}><UiEntity uiTransform={{width:px(48),height:px(48)}} uiBackground={{textureMode:'stretch',texture:{src:ATLAS},uvs:crewUV(cover.genre)}} /></UiEntity>,height:54})
      text(cover.date+' / '+cover.score.toFixed(1)+' / 400')
      text(cover.mode==='BOT_EXHIBITION'?'Exhibition: simulated opponents':'Human-crew win',16,muted)
      text('Illustrated keepsake, not a photograph.',16,muted)
      action('Next keepsake',()=>{albumPage++;panelPage=0})
    }else{
      text(memories.loaded?'Win a show to collect your first cover. Only your own wins enter this album.':'No saved results confirmed yet.')
      if(!memories.loaded)action('Refresh saved covers',()=>refreshNotebook())
    }
  }else if(view==='standings'){
    text(session?.ready?'Pilot season / completed shows':'Last confirmed / reconnecting',16,muted)
    if(memories.loaded){
      const r=memories.standings[genrePage%6]
      if(r){text(GENRE_NAMES[r.genre],24,color(r.genre));text(`${r.humanWins} wins / ${r.humanShows} human shows`);text(`Average: ${r.averageScore.toFixed(1)} / 400`);text(`Draws: ${r.humanDraws??0}\nExhibition wins: ${r.exhibitionWins}`)}
      text('Bot shows never count as human wins. Crews share the result.',16,muted)
      action('Next genre',()=>{genrePage++;panelPage=0})
    }else{text(memories.status);action('Refresh standings',()=>refreshNotebook())}
  }else if(view==='summary'&&s){
    action(me&&s.finalists.includes(me.genre)?'Walk to stage':'Watch the finalists',()=>{feedback='Follow the lights to your crew side.';open('none')},true)
    text(crew?GENRE_NAMES[crew.genre]+' / '+total(crew.training).toFixed(0)+' / 400':'Waiting for your crew',24,cyan)
    if(crew)for(const k of ATTRIBUTES)text(k.toUpperCase()+'  '+crew.training[k].toFixed(0)+' / 100',18)
    text(me&&!s.finalists.includes(me.genre)?'Watch the final. Try again next cycle.':me?.ready?'Checked in. Watch the countdown.':'Qualified! Follow the lights to stage.',18)
  }else if(view==='result'&&s){
    text(s.winner==='draw'?'Draw / both crews shine!':s.winner?GENRE_NAMES[s.winner]+' wins!':'Show cancelled / no winner',24,cyan)
    text(s.mode==='BOT_EXHIBITION'?'Exhibition: simulated musicians':'Human crews',16,muted)
    const scored=s.crews[scorePage%s.crews.length]
    if(scored){text(GENRE_NAMES[scored.genre]+' / '+total(scored.final).toFixed(1)+' / 400',20,color(scored.genre));for(const k of ATTRIBUTES)text(k.toUpperCase()+'  '+scored.final[k].toFixed(1))}
    text('Final = (studio + 2 x live) / 3',16,muted)
    action('Other crew',()=>{scorePage++;panelPage=0})
    action('Play again',()=>{feedback='Walk back to a studio. Tap its panel.';open('none')},true)
  }else if(s&&me){
    text(GENRE_NAMES[me.genre],24,cyan)
    text(s.phase==='lobby'?'Your crew is forming. Watch the countdown.':s.phase==='presentation'?'Welcome to the live final. Read your floor monitor.':'Your crew is preparing.')
    text('Empty seats may use simulated musicians. NPC hosts do not play.',16,muted)
    action('Explore while waiting',()=>open('none'))
  }else{
    text(session?.pending?'Joining your crew...':session?.notice||'Connecting...')
    action('Return to the club',()=>open('none'))
  }
  const bodyHeight=panelHeight-100
  const needsPages=rows.reduce((sum,r)=>sum+r.height,0)>bodyHeight
  const pages=paginateRows(rows.map(r=>r.height),bodyHeight-(needsPages?66:0))
  panelPage=Math.min(panelPage,pages.length-1)
  const a=reduced?.94:.88+Math.min(1,Math.max(0,(clock-changedAt)/180))*.06
  return <UiEntity uiTransform={{positionType:'absolute',position:{left:px(8),bottom:px(8)},width:px(width),height:px(panelHeight),padding:px(12),flexDirection:'column'}} uiBackground={{color:Color4.create(.025,.018,.065,a)}}>
    <UiEntity uiTransform={{width:'100%',height:px(76),justifyContent:'space-between',flexShrink:0}}>
      <Label value={wrapHudText(title,(width-24)*.70,HUD_TYPE.heading)} fontSize={px(HUD_TYPE.heading)} color={cyan} textAlign="middle-left" uiTransform={{width:'70%',height:px(76)}} />
      {button('Hide',()=>open('none'),'27%',60)}
    </UiEntity>
    <UiEntity uiTransform={{width:'100%',height:px(bodyHeight-(needsPages?66:0)),flexDirection:'column',flexShrink:0}}>
      {pages[panelPage].map(i=><UiEntity key={i} uiTransform={{width:'100%',height:px(rows[i].height),flexShrink:0}}>{rows[i].element}</UiEntity>)}
    </UiEntity>
    {needsPages&&<UiEntity uiTransform={{width:'100%',height:px(66),justifyContent:'space-between',flexShrink:0}}>
      {button(panelPage===0?'Menu':'Back',()=>{if(panelPage>0)panelPage--;else open('options')},'31%',60)}
      {button(panelPage<pages.length-1?`Next ${panelPage+2}/${pages.length}`:'First page',()=>{panelPage=(panelPage+1)%pages.length},'65%',60)}
    </UiEntity>}
  </UiEntity>
}
function ui() {
  const content=contentUi(),s=session?.state
  const expanded=view!=='none',c=UiCanvasInformation.getOrNull(engine.RootEntity)
  const clockWidth=Math.min(420,((c?.width??800)-(c?.interactableArea?.left??0)-(c?.interactableArea?.right??0))/scale-16)
  const detail=s&&session?.ready?s.finalists.length?s.finalists.map(g=>GENRE_NAMES[g]).join(' vs '):'30s choose / train / live':'Waiting for server confirmation.'
  const clockText=wrapHudText(detail,clockWidth-12,HUD_TYPE.metadata),clockDetailHeight=clockText.split('\n').length*hudLineHeight(HUD_TYPE.metadata)
  const shortPhase=s?({lobby:'CHOOSE STUDIO',training:'REHEARSAL',intermission:'GO TO STAGE',presentation:'SHOW INTRO',battle:'LIVE FINAL',result:'RESULTS'}[s.phase]):''
  return <UiEntity uiTransform={{width:'100%',height:'100%'}}>
    <UiEntity uiTransform={{positionType:'absolute',position:{left:px(8),top:px(8)},width:px(clockWidth),height:px(44+(expanded?0:clockDetailHeight)),padding:px(6),flexDirection:'column'}} uiBackground={{color:ink}}>
      {line(session?.ready&&s?shortPhase+' / '+phaseSeconds(s,clock+session.offset)+'s':'CONNECTING...',32,HUD_TYPE.action,cyan)}
      {!expanded&&line(clockText,clockDetailHeight,HUD_TYPE.metadata)}
    </UiEntity>
    {content}
  </UiEntity>
}
function tick() {
  if (!session) return
  const s=session.state, me=s.players.find(p=>p.id===session!.id), phase=key()
  const queuedGenre=session.enrollment.genre??''
  if(queuedGenre!==queueKey){queueKey=queuedGenre;if(queuedGenre){feedback='Your place in the queue is confirmed.';open('queue')}else if(view==='queue'){feedback='Queue updated.';open('none')}}
  if (me&&entered!==`${s.match}/${me.genre}`) { entered=`${s.match}/${me.genre}`; feedback='Get ready — your rehearsal is next.'; open('play') }
  if (!me&&entered) {entered='';open('none')}
  if (phase!==phaseKey) {
    const nextStage=`${s.match}/${s.phase}`, stageChanged=nextStage!==stageSeen
    phaseKey=phase;attempted=0;expired=0;intent=null;audioKey='';feedback='';scorePage=0
    if(stageChanged&&me){
      // Keep the route visible; the result sheet remains one tap away.
      if(s.phase==='intermission')open('none')
      else if(s.phase==='result')open('result')
      else if(s.phase==='training'||s.phase==='battle'||s.phase==='presentation')open(isPerformer(s,session.id)?'play':'none')
    }
    stageSeen=nextStage
  }
  if(session.ready&&s.phase==='intermission'&&me&&!me.withdrawn&&!me.ready&&!session.pending&&clock-checkInAt>=1000){
    const side=s.finalists.indexOf(me.genre),p=getPlayer()?.position
    if(side>=0&&p&&p.z>=VENUE.gateZ+.3&&Math.hypot(p.x-VENUE.stageXs[side],p.z-VENUE.stagePlayZ)<=6){checkInAt=clock;stage()}
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
  if(session.notice&&/No confirmation|Not accepted|Connection lost/.test(session.notice))feedback=session.notice
  memories.observe(s,session.id,clock)
  const announcement=s.phase==='presentation'?'host-'+[...s.finalists].sort().join('-'):s.phase==='result'&&s.winner&&s.winner!=='draw'?'winner-'+s.winner:''
  if(sound&&announcement&&announced!==s.match+'/'+announcement){announced=s.match+'/'+announcement;playClip(announcer,'assets/sounds/'+announcement+'.wav',.7)}
  if((!sound||!announcement)&&AudioSource.getOrNull(announcer)?.playing)AudioSource.getMutable(announcer).playing=false
  refreshClub(s,clock+session.offset,reduced,session.id,attempted,memories,getPlayer()?.position)
  refreshResidents(clock,getPlayer()?.position,reduced,s.phase==='training'||s.phase==='battle')
}
export function main() {
  buildClub(choose,stage)
  // Follow the local avatar: clients without global-audio support still hear the performance.
  const voice=(file:string)=>{const e=engine.addEntity();Transform.create(e,{parent:engine.PlayerEntity,position:Vector3.create(0,1,0)});AudioSource.create(e,{audioClipUrl:file,playing:false,loop:false,global:true,volume:.5});return e}
  announcer=voice('assets/sounds/winner-kpop.wav')
  bed=voice('assets/sounds/bed-0.wav');voices=[0,1,2].map(i=>voice(`assets/sounds/lead-${i}.wav`));errorVoice=voice('assets/sounds/mistake.wav');resultVoice=voice('assets/sounds/resolve.wav')
  engine.addSystem(dt=>{
    for(const [i,action] of [InputAction.IA_ACTION_3,InputAction.IA_ACTION_4,InputAction.IA_ACTION_5].entries())if(inputSystem.isTriggered(action,PointerEventType.PET_DOWN))tap(i)
    delta+=dt;if(delta<.05)return;delta=0;clock=Date.now()
    const id=getPlayer()?.userId?.toLowerCase()
    if(!id||!/^0x[0-9a-f]{40}$/.test(id)){disconnect();session=null;for(const e of [bed,...voices,errorVoice,resultVoice,announcer])if(AudioSource.getOrNull(e)?.playing)AudioSource.getMutable(e).playing=false;return}
    if(!session||session.id!==id){disconnect();session=new ConcertSession(id,clock);memories=new VisitMemories();disconnect=connectClient(session,memories);albumPage=0;entered='';queueKey='';notebookAt=-Infinity;open('none')}
    if(clock-networkAt>=1500){networkAt=clock;syncClock(session,clock)}
    if(session.ready&&clock-notebookAt>=5000){notebookAt=clock;refreshNotebook()}
    session.tick(clock);flush();tick()
  })
  ReactEcsRenderer.setUiRenderer(ui,{virtualWidth:0,virtualHeight:0,screenInset:'interactable'})
}
