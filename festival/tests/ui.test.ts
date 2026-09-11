/** Production scene/controller integration with an in-memory SDK adapter.
 * This is NOT a native screenshot, physical device test or real multiplayer test.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { fileURLToPath } from 'node:url'
import { ConcertAuthority } from '../src/authority'
import { GENRES, TRAINING_MS, INTERMISSION_MS, PRESENTATION_MS, TURN_MS } from '../src/rules/concert'
import { WALK,rampSurface,overlapsAvatar,type Solid } from '../compatibility/festival-navigation'
import { concertLayout } from '../compatibility/concert-layout'
const require = createRequire(import.meta.url)
const { build } = createRequire(require.resolve('tsx/package.json'))('esbuild')

const adapter = `
const h = globalThis.harness;
function component() { const values = new Map(); return {
 create:(e,v)=>{values.set(e,{position:{x:0,y:0,z:0},scale:{x:1,y:1,z:1},...v});if(v?.audioClipUrl)h.audio.push({...v})}, createOrReplace:(e,v)=>{values.set(e,{position:{x:0,y:0,z:0},scale:{x:1,y:1,z:1},...v});if(v?.audioClipUrl)h.audio.push({...v})},
 entries:()=>values.entries(), delete:e=>values.delete(e), has:e=>values.has(e), get:e=>values.get(e), getOrNull:e=>values.get(e)||null,
 getMutable:e=>{h.writes++;return values.get(e)}
}; }
export const Transform=component(), TextShape=component(), AudioSource=component(),AvatarShape=component(),AvatarAttach=component(),LightSource=component(),GltfContainer=component();
export const AvatarAnchorPointType={AAPT_HEAD:4};
h.components={Transform,TextShape,AvatarShape,GltfContainer,AudioSource};
export const UiCanvasInformation={getOrNull:()=>h.canvas};
export const Material={Texture:{Common:x=>x},setBasicMaterial:()=>h.writes++,setPbrMaterial:()=>h.writes++};
export const MeshRenderer={setBox:()=>{},setSphere:()=>{},setPlane:()=>{}}, MeshCollider={setBox:(e,layer)=>h.colliders.set(e,layer??3)}; export const ColliderLayer={CL_POINTER:1,CL_PHYSICS:2};
export const engine={RootEntity:0,PlayerEntity:1000000,getEntitiesWith:c=>c.entries(),addEntity:()=>++h.entity,removeEntity:e=>{for(const c of Object.values(h.components))c.delete?.(e);h.removed.push(e)},addSystem:fn=>h.systems.push(fn)};
export const pointerEventsSystem={onPointerDown:(opts,fn)=>h.interactions.push({opts,fn})};
export const inputSystem={isTriggered:()=>false},InputAction={IA_POINTER:0,IA_ACTION_3:3,IA_ACTION_4:4,IA_ACTION_5:5},PointerEventType={PET_DOWN:0};
export const Color4={create:(r,g,b,a)=>({r,g,b,a})},Vector3={create:(x,y,z)=>({x,y,z})};
export const Quaternion={fromEulerDegrees:(x,y,z)=>({x,y,z,w:1})};
export const movePlayerTo=async p=>{h.moves.push(p);return {success:true}};
export const getPlayer=()=>({userId:'0x1111111111111111111111111111111111111111',position:h.position});
export class MessageBus { on(channel,receive){h.receive=receive} emit(channel,packet){h.packets.push({channel,packet})} }
export const UiEntity='UiEntity',Label='Label',Button='Button';
export const ReactEcsRenderer={setUiRenderer:fn=>h.render=fn};
export default {createElement:(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity).filter(Boolean)})};
`

const networkAdapter = `
const h=globalThis.harness;
export function connectClient(client,notebook){h.client=client;h.notebook=notebook;client.receiveState(h.authority.state,h.time,true,h.time);return()=>{}}
export function flushClient(client){for(const p of client.drain()){const accepted=h.authority.command(client.id,JSON.parse(p.json),h.time,h.position);client.ack(p.request,accepted);client.receiveState(h.authority.state,h.time,true,h.time);client.receiveEnrollment(h.authority.enrollment(client.id),h.time)}}
export function refreshNotebook(){h.refreshes=(h.refreshes||0)+1}
export function syncClock(){}
`;

const bundle = build({entryPoints:[fileURLToPath(new URL('../compatibility/concert-scene.tsx',import.meta.url))],bundle:true,write:false,format:'cjs',platform:'node',jsxFactory:'ReactEcs.createElement',plugins:[{
  name:'test-sdk-adapter',setup(b: any){
    b.onResolve({filter:/client-network$/},()=>({path:'network-adapter',namespace:'network'}))
    b.onLoad({filter:/.*/,namespace:'network'},()=>({contents:networkAdapter,loader:'js'}))
    b.onResolve({filter:/^(@dcl\/sdk|~system\/RestrictedActions)/},()=>({path:'sdk-adapter',namespace:'adapter'}))
    b.onLoad({filter:/.*/,namespace:'adapter'},()=>({contents:adapter,loader:'js'}))
  }
}]})

async function scene(width=1440,height=900,dpr=1) {
  const h:any={entity:0,writes:0,removed:[],colliders:new Map(),systems:[],packets:[],moves:[],audio:[],interactions:[],position:{x:7.5,y:1,z:18},canvas:{width,height,devicePixelRatio:dpr},time:1000}
  h.authority=new ConcertAuthority(1000,'ui-test')
  class Clock extends Date { static now(){return h.time} }
  const module={exports:{} as any}
  runInNewContext((await bundle).outputFiles[0].text,{module,exports:module.exports,harness:h,Date:Clock,console:{log(){}},setTimeout,clearTimeout})
  module.exports.main()
  h.tick=(ms=50)=>{h.time+=ms;for(const fn of h.systems)fn(ms/1000)}
  h.tick()
  h.nodes=()=>{const result:any[]=[];const visit=(n:any)=>{if(!n)return;result.push(n);n.children?.forEach(visit)};visit(h.render());return result}
  h.text=()=>h.nodes().map((n:any)=>n.props.value||'').join('\n')
  h.allPages=(check=()=>{})=>{let collected='';for(let i=0;i<16;i++){check();collected+='\n'+h.text();const next=h.nodes().find((n:any)=>n.type==='Button'&&/^Next \d/.test(n.props.value));if(!next)break;next.props.onMouseDown();h.tick()}const first=h.nodes().find((n:any)=>n.type==='Button'&&n.props.value==='First page');if(first){first.props.onMouseDown();h.tick()}return collected}
  h.seek=(value:string)=>{for(let i=0;i<16;i++){if(h.nodes().some((n:any)=>n.type==='Button'&&n.props.value===value)){h.click(value);return}const next=h.nodes().find((n:any)=>n.type==='Button'&&/^Next \d/.test(n.props.value));assert.ok(next,'Missing paged button: '+value);next.props.onMouseDown();h.tick()}throw Error('Page loop')}
  h.click=(value:string)=>{const button=h.nodes().find((n:any)=>n.type==='Button'&&(n.props.value===value||n.props.value.startsWith(value+'\n')));assert.ok(button,'Missing button: '+value);button.props.onMouseDown();h.tick()}
  h.interact=(title:string)=>{const target=h.interactions.find((i:any)=>i.opts.opts.hoverText.startsWith(title));assert.ok(target,title);target.fn();h.tick()}
  h.pad=(lane:number)=>{const nodes=h.nodes();const label=nodes.find((n:any)=>n.type==='Label'&&n.props.value===['C · 1','E · 2','G · 3'][lane]);assert.ok(label,'pad');const parent=nodes.find((n:any)=>n.children.includes(label));parent.props.onMouseDown();h.tick()}
  return h
}

test('canvas layout never double-scales density; explicit large mode stays bounded',()=>{
 for(const [w,h] of [[390,844],[844,390],[780,360],[1440,900]])for(const large of [false,true]){
  const baseline=concertLayout(w,h,1,12,12,4,4,large)
  for(const dpr of [2,3,3.5])assert.deepEqual(concertLayout(w,h,dpr,12,12,4,4,large),baseline)
  assert.ok(baseline.scale>=1&&baseline.scale<=1.25)
 }
})

test('all seven local audio voices follow the player and start stopped',async()=>{
 const app=await scene(), sources=[...app.components.AudioSource.entries()] as any[]
 assert.equal(sources.length,7)
 for(const [entity,source] of sources){
  const transform=app.components.Transform.get(entity)
  assert.equal(transform.parent,1000000)
  assert.equal(transform.position.x,0);assert.equal(transform.position.y,1);assert.equal(transform.position.z,0)
  assert.equal(source.playing,false)
 }
})

test('server notebook loading and standings are reachable without an arrival overlay',async()=>{
 const h=await scene();assert.match(h.text(),/FESTIVAL BETA/);assert.doesNotMatch(h.text(),/Your ENCORE album/);
 h.click('Menu');h.click('ENCORE album');assert.match(h.text(),/No saved results/);assert.doesNotMatch(h.text(),/not saved between visits/);
 h.click('Refresh saved covers');assert.ok(h.refreshes>=2);h.click('Hide');h.click('Menu');h.click('Genre standings');assert.match(h.text(),/Connecting to your saved\s+covers/);
});
test('saved cover and crew standings fit supported viewport models and remain minimizable',async()=>{
 for(const [w,h,d] of [[390,844,1],[844,390,1],[1080,2340,3],[2340,1080,3],[1440,900,1]]){
  const app=await scene(w,h,d);
  const packet={scope:'LAB_PILOT',album:[{match:'authority:test:1000',date:'2026-09-10',genre:'kpop',kind:'ILLUSTRATED_KEEPSAKE',mode:'HUMAN_MATCH',attributes:{rhythm:100,precision:100,harmony:100,consistency:100}}],standings:GENRES.map(genre=>({genre,humanShows:1,humanWins:genre==='kpop'?1:0,averageScore:400,exhibitionWins:0}))};
  assert.equal(app.notebook.receive(packet),true);
  const check=()=>{
   const measure=(n:any):number=>{const t=n.props.uiTransform||{};if(t.positionType==='absolute')return 0;if(typeof t.height==='number')return t.height;return t.flexDirection==='column'?n.children.reduce((a:number,c:any)=>a+measure(c),0):Math.max(0,...n.children.map(measure))};
   for(const n of app.nodes()){const t=n.props.uiTransform||{};if(t.flexDirection==='column'&&typeof t.height==='number'){const used=n.children.reduce((a:number,c:any)=>a+measure(c),0)+(typeof t.padding==='number'?2*t.padding:0);assert.ok(used<=t.height+.1,w+'x'+h+' '+used+' > '+t.height)}}
  };
  app.click('Menu');check();app.seek('ENCORE album');check();const album=app.allPages(check);assert.match(album,/400.0 \/ 400/);assert.match(album,/not a\s+photograph/);
  app.click('Hide');app.click('Menu');app.seek('Genre standings');check();assert.match(app.allPages(check),/1 wins \/ 1 human shows/);app.seek('Next genre');check();assert.match(app.text(),/Brazilian Funk/);
  app.click('Hide');assert.doesNotMatch(app.text(),/Average:/);
 }
});

test('late arrival queue is confirmed, minimizable and cancellable at supported sizes',async()=>{
 for(const [w,h,d] of [[390,844,1],[844,390,1],[1080,2340,3],[2340,1080,3],[1440,900,1]]){
  const app=await scene(w,h,d), players=[2,3,4,5].map(n=>'0x'+String(n).repeat(40))
  for(let i=0;i<4;i++){
   const s=app.authority.state
   app.authority.command(players[i],{match:s.match,phase:s.phase,round:s.round,command:{kind:'join',genre:i<2?'kpop':'electronic'}},app.time,i<2?{x:7.5,z:18.5}:{x:40.5,z:51.5})
  }
  app.time=31000;app.authority.tick(app.time,new Set(players))
  app.client.receiveState(app.authority.state,app.time,true,app.time)
  app.interact('Play K-pop')
  assert.match(app.text(),/Your next\s+show/);assert.match(app.allPages(),/Queue position 1/)
  const measure=(n:any):number=>{const t=n.props.uiTransform||{};if(t.positionType==='absolute')return 0;if(typeof t.height==='number')return t.height;return t.flexDirection==='column'?n.children.reduce((a:number,c:any)=>a+measure(c),0):Math.max(0,...n.children.map(measure))}
  for(const n of app.nodes()){const t=n.props.uiTransform||{};if(t.flexDirection==='column'&&typeof t.height==='number'){const used=n.children.reduce((a:number,c:any)=>a+measure(c),0)+(typeof t.padding==='number'?2*t.padding:0);assert.ok(used<=t.height+.1,w+'x'+h+' queue '+used+' > '+t.height)}}
  app.click('Hide');assert.doesNotMatch(app.text(),/Your next show/);app.click('Your queue')
  app.seek('Leave queue');assert.equal(app.authority.enrollment(app.client.id).genre,null)
  assert.equal(app.authority.state.phase,'training');assert.equal(app.moves.length,0)
 }
});

test('clock and minimized controls stay left; broad studio hitboxes do not block walking',async()=>{
 const app=await scene(390,844,1)
 assert.match(app.text(),/CHOOSE STUDIO \/ 30s/);assert.match(app.text(),/30s choose/)
 const absolute=app.nodes().filter((n:any)=>n.props.uiTransform?.positionType==='absolute')
 assert.ok(absolute.length>=2);absolute.forEach((n:any)=>{assert.equal(n.props.uiTransform.position.right,undefined);assert.ok(n.props.uiTransform.position.left>=0)})
 const joins=app.interactions.filter((i:any)=>i.opts.opts.hoverText.startsWith('Join '))
 assert.equal(joins.length,6)
 for(const i of joins){assert.equal(app.colliders.get(i.opts.entity),1);assert.equal(app.components.Transform.get(i.opts.entity).scale.x,8.2)}
 app.interact('Join K-pop');assert.equal(app.authority.state.players[0].id,app.client.id)
})
test('two floor monitors face the performer while rear audience scoreboards remain',async()=>{
 const app=await scene(), entries=[...app.components.Transform.entries()] as any[]
 const monitors=entries.filter(([e,t])=>t.rotation?.y===180&&t.scale?.x===.58)
 assert.equal(monitors.length,2)
 for(const [entity,t] of monitors){
  assert.ok(t.parent);assert.ok(t.position.z<41);assert.equal(t.position.y,1.35)
  const children=entries.filter(([e,p])=>p.parent===entity)
  assert.ok(children.length>15)
  assert.ok(children.some(([e])=>app.components.TextShape.get(e)?.text.includes('FLOOR MONITOR')))
 }
 const labels=[...app.components.TextShape.entries()].map(([e,t]:any)=>t.text)
 assert.ok(labels.some((t:string)=>t.includes('ENTER THE FESTIVAL')))
 assert.ok(labels.some((t:string)=>t.includes('FINALISTS ONLY')))
 assert.equal(labels.filter((t:string)=>t==='LIVE CREW').length,2)
})

test('audience live board shows updated combined attributes rather than frozen rehearsal stats',async()=>{
 const app=await scene();app.interact('Join K-pop')
 const connected=new Set([app.client.id]);app.time=31000;app.authority.tick(app.time,connected)
 for(let i=0;i<3;i++){app.time=app.authority.state.since+TRAINING_MS;app.authority.tick(app.time,connected)}
 app.time=app.authority.state.since+INTERMISSION_MS;app.authority.tick(app.time,connected)
 app.time=app.authority.state.since+PRESENTATION_MS;app.authority.tick(app.time,connected)
 app.time=app.authority.state.since+TURN_MS;app.authority.tick(app.time,connected)
 const s=app.authority.state;assert.equal(s.phase,'battle')
 app.client.receiveState(s,app.time,true,app.time);app.tick()
 const board=[...app.components.TextShape.entries()].map(([e,t]:any)=>t.text).find((t:string)=>t.startsWith('LIVE FINAL /'))
 assert.ok(board)
 for(const g of s.finalists){const c=s.crews.find((c:any)=>c.genre===g);assert.ok(board.includes(c.final?Object.values(c.final).reduce((a:number,v:any)=>a+v,0).toFixed(0)+' / 400':''))}
 assert.equal(board.split('\n').length,3,'only headline and two crew totals on the distance board')
})

test('Studio Life keeps 20px minimum type and 60-unit actions across pages, density, XL and safe insets',async()=>{
 for(const [w,h,d] of [[390,844,1],[844,390,1],[1080,2340,3],[2340,1080,3],[1440,900,1],[780,360,1]])for(const xl of [false,true]){
  const app=await scene(w,h,d)
  app.canvas.interactableArea={left:12,right:12,top:4,bottom:4}
  app.click('Menu');app.click('Sound & display');if(xl)app.seek('Larger text: off');app.click('Hide')
  const check=()=>{
   const nodes=app.nodes(),fontNodes=nodes.filter((n:any)=>n.type==='Label'||n.type==='Button')
   // Density cancels in height / size ratios; actions are 24, body 24, metadata 20.
   for(const n of fontNodes){assert.ok(n.props.fontSize>=20);if(n.type==='Button'){assert.ok(n.props.fontSize>=24);assert.ok(n.props.uiTransform.height/n.props.fontSize>=2.4-.001)}}
   const measure=(n:any):number=>{const t=n.props.uiTransform||{};if(t.positionType==='absolute')return 0;if(typeof t.height==='number')return t.height;return t.flexDirection==='column'?n.children.reduce((a:number,c:any)=>a+measure(c),0):Math.max(0,...n.children.map(measure))}
   for(const n of nodes){const t=n.props.uiTransform||{};if(t.flexDirection==='column'&&typeof t.height==='number'){const used=n.children.reduce((a:number,c:any)=>a+measure(c),0)+(typeof t.padding==='number'?2*t.padding:0);assert.ok(used<=t.height+.1,w+'x'+h+' '+used+'>'+t.height)}}
   const abs=nodes.filter((n:any)=>n.props.uiTransform?.positionType==='absolute'),clock=abs.find((n:any)=>n.props.uiTransform.position.top!==undefined),panel=abs.find((n:any)=>n.props.uiTransform.position.bottom!==undefined)
   if(clock&&panel){const a=clock.props.uiTransform,b=panel.props.uiTransform;assert.ok(a.position.top+a.height+b.height+b.position.bottom<=h-8+.1,'clock overlaps content')}
  }
  check();app.click('Menu');check();app.seek('How to play');const guide=app.allPages(check);assert.match(guide,/NPC hosts never\s+score/);assert.match(guide,/Explore the studios/)
  app.click('Hide');app.interact('Join K-pop');app.allPages(check)
  app.time=31000;app.authority.tick(app.time,new Set([app.client.id]));app.client.receiveState(app.authority.state,app.time,true,app.time);app.tick();check();assert.match(app.text(),/C · 1/)
 }
})
test('decorative residents unload, respect reduced motion and never become roster members',async()=>{
 const app=await scene();const npcs=()=>[...app.components.AvatarShape.entries()].filter(([e,a]:any)=>a.id.startsWith('affinity-resident-'))
 assert.equal(npcs().length,2);assert.ok(npcs().every(([e,a]:any)=>a.name.endsWith('NPC')));assert.equal(app.authority.state.players.length,0)
 app.click('Menu');app.click('Sound & display');app.click('Reduce motion');app.tick(500)
 assert.ok(npcs().every(([e,a]:any)=>a.expressionTriggerId===''))
 app.position={x:24,z:76};app.tick(600);assert.equal(npcs().length,0);assert.ok(app.removed.length>=2)
 app.position={x:40.5,z:51.5};app.tick(600);assert.equal(npcs().length,2)
 assert.ok(npcs().every(([e,a]:any)=>a.id.includes('electronic')));assert.equal(app.authority.state.players.length,0)
 const models=[...app.components.GltfContainer.entries()].filter(([e,g]:any)=>g.src.includes('studio-props-'))
 assert.equal(models.length,6);models.forEach(([e,g]:any)=>{assert.equal(g.visibleMeshesCollisionMask,0);assert.equal(g.invisibleMeshesCollisionMask,0)})
})
test('small play viewport offers recovery without overlapping clock or shrinking note pads',async()=>{
 for(const [w,h] of [[780,300],[260,390]]){
  const app=await scene(w,h,1);app.interact('Join K-pop');app.time=31000;app.authority.tick(app.time,new Set([app.client.id]));app.client.receiveState(app.authority.state,app.time,true,app.time);app.tick()
  assert.match(app.text(),/Rotate or close overlays/);assert.doesNotMatch(app.text(),/C · 1/);app.click('Hide')
 }
})

test('production collider graph keeps spawn, all studio approaches and stage route connected',async()=>{
 const app=await scene(),transforms=app.components.Transform
 // Unwrap real production hierarchy into authoring-space oriented bounds.
 const volumes:Solid[]=[]
 for(const [e,mask] of app.colliders){
  if(!(mask&2))continue
  const t=transforms.get(e);let p={...t.position},sc={...t.scale},yaw=t.rotation?.y??0,parent=t.parent
  if(t.rotation?.x)continue // Sloped ramp checked independently, not treated as a vertical wall.
  while(parent){
   const q=transforms.get(parent),a=(q.rotation?.y??0)*Math.PI/180,x=p.x*q.scale.x,z=p.z*q.scale.z
   p={x:q.position.x+x*Math.cos(a)+z*Math.sin(a),y:q.position.y+p.y*q.scale.y,z:q.position.z-x*Math.sin(a)+z*Math.cos(a)}
   sc={x:sc.x*q.scale.x,y:sc.y*q.scale.y,z:sc.z*q.scale.z};yaw+=q.rotation?.y??0;parent=q.parent
  }
  volumes.push({name:String(e),x:p.x/1.5,y:p.y,z:(p.z-8)/1.5,sx:sc.x/1.5,sy:sc.y,sz:sc.z/1.5,yaw})
 }
 const blocked=(x:number,z:number)=>volumes.some(b=>{
  const floor=z>=39?.7:Math.abs(x-16)<WALK.ramp.width/2?Math.max(0,rampSurface(z)):0,top=b.y+b.sy/2,bottom=b.y-b.sy/2
  return top>floor+.30&&bottom<floor+2.2&&overlapsAvatar(b,x,z,.30)
 })
 // Gate closed for a spectator; does not prevent reaching the lobby or any studio.
 assert.equal(blocked(16,-3.33),false,'spawn')
 const flood=(start:number[],canCrossGate=false)=>{
  const seen=new Set<string>(),q=[start],key=(x:number,z:number)=>x+','+z
  for(let i=0;i<q.length;i++){const [ix,iz]=q[i];for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const nx=ix+dx,nz=iz+dz,k=key(nx,nz),x=nx/4,z=nz/4
   if(x<.5||x>31.5||z<-4.5||z>46||seen.has(k))continue
   if(blocked(x,z)&&!(canCrossGate&&Math.abs(x-16)<WALK.gateWidth/2-.3&&Math.abs(z-38.8)<.6))continue
   seen.add(k);q.push([nx,nz])
  }}return seen
 }
 const closed=flood([64,-13])
 for(const x of [5,27])for(const z of [7,18,29])assert.ok(closed.has((x*4)+','+(z*4)),'studio unreachable '+x+','+z)
 assert.equal(closed.has('64,164'),false,'stage remains gated for spectators')
 const open=flood([64,-13],true)
 assert.ok(open.has('48,164'));assert.ok(open.has('80,164'))
 assert.ok(open.has('64,176'),'stage egress route')
})

test('stage gate permits exit after the show without granting participant authority',async()=>{
 const app=await scene()
 const gate=()=>[...app.components.Transform.entries()].find(([e,t]:any)=>t.position.x===16&&Math.abs(t.position.z-38.8)<.001&&t.scale.x===WALK.gateWidth&&t.scale.y===3)[1]
 assert.equal(gate().position.y,1.5)
 app.position={x:24,y:1,z:70};app.tick();assert.equal(gate().position.y,-4)
 app.position.z=66.2;app.tick();assert.equal(gate().position.y,-4,'do not close on avatar')
 app.position.z=64.8;app.tick();assert.equal(gate().position.y,1.5)
 assert.equal(app.authority.state.players.length,0)
})

test('finalist walks onto own stage side to check in without a microphone click or automatic modal',async()=>{
 const app=await scene(390,844);app.interact('Join K-pop')
 const connected=new Set([app.client.id]);app.time=31000;app.authority.tick(app.time,connected)
 for(let i=0;i<3;i++){app.time=app.authority.state.since+TRAINING_MS;app.authority.tick(app.time,connected)}
 assert.equal(app.authority.state.phase,'intermission')
 app.client.receiveState(app.authority.state,app.time,true,app.time);app.tick()
 const me=()=>app.authority.state.players.find((p:any)=>p.id===app.client.id)
 assert.ok(app.authority.state.finalists.includes(me().genre));assert.equal(me().ready,false)
 assert.doesNotMatch(app.text(),/Rehearsal result/);assert.match(app.text(),/Stage open/)
 const side=app.authority.state.finalists.indexOf(me().genre),x=side===0?18:30
 app.position={x,z:65};app.tick(1100);assert.equal(me().ready,false,'no check-in outside the gate')
 app.position={x:side===0?30:18,z:69.5};app.tick(1100);assert.equal(me().ready,false,'other crew side does not qualify')
 app.position={x,z:69.5};app.tick(1100);assert.equal(me().ready,true)
 assert.match(app.text(),/Checked in/);assert.equal(app.moves.length,0,'no teleport')
 app.tick(1100);assert.equal(me().ready,true)
 const spectator=await scene();spectator.position={x,z:69.5};spectator.tick(1100)
 assert.equal(spectator.authority.state.players.length,0,'walking in never enrolls a spectator')
})

test('mobile type fits estimated line measures without dropping intro or guide text',async()=>{
 // Font-metric estimate, not a native raster/glyph or physical-device verification.
 for(const [w,h] of [[390,844],[844,390],[780,360]]){
  const app=await scene(w,h);app.canvas.interactableArea={left:12,right:12,top:4,bottom:4}
  const check=()=>{
   const visit=(n:any,parentWidth:number)=>{
    const t=n.props.uiTransform||{},width=typeof t.width==='number'?t.width:typeof t.width==='string'&&t.width.endsWith('%')?parseFloat(t.width)/100*parentWidth:parentWidth
    if(n.type==='Label'||n.type==='Button'){
     const lines=n.props.value.split('\n'),font=n.props.fontSize
     for(const value of lines)assert.ok(value.length*font*.58<=width+1,`estimated horizontal clipping: ${value} at ${w}x${h}`)
     assert.ok(lines.length*font*1.2<=t.height+1,`vertical clipping: ${n.props.value}`)
    }
    n.children?.forEach((child:any)=>visit(child,width-2*(typeof t.padding==='number'?t.padding:0)))
   };visit(app.render(),w-24)
  }
  check();assert.match(app.text().replace(/\s+/g,' '),/Tap a studio panel to join\./)
  app.click('How to play');const guide=app.allPages(check);assert.match(guide,/NPC hosts never\s+score/)
  app.click('Hide');app.click('Menu');app.allPages(check)
  app.seek('Sound & display');app.allPages(check)
 }
})

test('large architecture blocks walking and camera while join targets remain pointer-only',async()=>{
 const app=await scene()
 const cabins=[...app.components.GltfContainer.entries()].filter(([e,g]:any)=>g.src.includes('cabin-'))
 assert.equal(cabins.length,6);assert.ok(cabins.every(([e,g]:any)=>g.visibleMeshesCollisionMask===0))
 const walls=[...app.colliders].filter(([e,m]:any)=>app.components.Transform.get(e).scale.y===5.15)
 assert.equal(walls.length,96);assert.ok(walls.every(([e,m]:any)=>m===3))
 for(const i of app.interactions.filter((i:any)=>i.opts.opts.hoverText.startsWith('Join ')))assert.equal(app.colliders.get(i.opts.entity),1)
 const boards=[...app.components.TextShape.entries()].filter(([e,v]:any)=>v.text==='TAP TO JOIN')
 assert.ok(boards.every(([e]:any)=>app.components.Transform.get(e).position.y>3))
})

test('world signs use physical letter sizes, normal aspect and eye-level directions',async()=>{
 const app=await scene(),texts=[...app.components.TextShape.entries()] as any[]
 const find=(value:string)=>texts.find(([e,t])=>t.text===value)
 const title=find('AFFINITY ARENA'),join=find('TAP TO JOIN'),genre=find('BRAZILIAN FUNK')
 assert.equal(title[1].fontSize,9);assert.equal(join[1].fontSize,5);assert.equal(genre[1].fontSize,7)
 for(const [e] of texts)assert.equal(app.components.Transform.get(e).scale.x,1/1.5,'cancel horizontal venue stretch')
 const directions=find('1 CHOOSE\n2 TRAIN\n3 PERFORM'),clock=texts.find(([e,t])=>t.text.startsWith('CHOOSE STUDIO\n'))
 for(const item of [directions,clock]){
  assert.ok(item);const t=app.components.Transform.get(item[0]);assert.ok(t.position.y<=2.2)
  assert.ok(t.position.x<13,'outside the center avatar/camera line');assert.ok(item[1].fontSize>=4.8)
 }
 for(const [,t] of texts.filter(([,t])=>t.width)){
  const lines=t.text.split('\n')
  assert.ok(Math.max(...lines.map((s:string)=>s.length))*.065*t.fontSize<=t.width+.001)
  assert.ok(lines.length*.13*t.fontSize<=t.height+.001)
 }
 assert.ok(!texts.some(([,t])=>t.text.includes('01 STUDIO')),'no duplicate tiny overhead instructions')
})
