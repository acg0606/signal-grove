/** Production scene/controller integration with an in-memory SDK adapter.
 * This is NOT a native screenshot, physical device test or real multiplayer test.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { fileURLToPath } from 'node:url'
import { newArena, validSnapshot, type Arena } from '../src/concert'
const require = createRequire(import.meta.url)
const { build } = createRequire(require.resolve('tsx/package.json'))('esbuild')

const adapter = `
const h = globalThis.harness;
function component() { const values = new Map(); return {
 create:(e,v)=>{values.set(e,v);if(v?.audioClipUrl)h.audio.push({...v})}, createOrReplace:(e,v)=>{values.set(e,v);if(v?.audioClipUrl)h.audio.push({...v})},
 has:e=>values.has(e), get:e=>values.get(e), getOrNull:e=>values.get(e)||null,
 getMutable:e=>{h.writes++;return values.get(e)}
}; }
export const Transform=component(), TextShape=component(), AudioSource=component();
export const UiCanvasInformation={getOrNull:()=>h.canvas};
export const Material={Texture:{Common:x=>x},setBasicMaterial:()=>h.writes++,setPbrMaterial:()=>h.writes++};
export const MeshRenderer={setBox:()=>{},setSphere:()=>{},setPlane:()=>{}}, MeshCollider={setBox:()=>{}};
export const engine={RootEntity:0,addEntity:()=>++h.entity,addSystem:fn=>h.systems.push(fn)};
export const pointerEventsSystem={onPointerDown:(opts,fn)=>h.interactions.push({opts,fn})};
export const inputSystem={isTriggered:()=>false},InputAction={IA_POINTER:0,IA_ACTION_3:3,IA_ACTION_4:4,IA_ACTION_5:5},PointerEventType={PET_DOWN:0};
export const Color4={create:(r,g,b,a)=>({r,g,b,a})},Vector3={create:(x,y,z)=>({x,y,z})};
export const Quaternion={fromEulerDegrees:(x,y,z)=>({x,y,z,w:1})};
export const movePlayerTo=async p=>{h.moves.push(p);return {success:true}};
export const getPlayer=()=>({userId:'real-user-adapter',position:h.position});
export class MessageBus { on(channel,receive){h.receive=receive} emit(channel,packet){h.packets.push({channel,packet})} }
export const UiEntity='UiEntity',Label='Label',Button='Button';
export const ReactEcsRenderer={setUiRenderer:fn=>h.render=fn};
export default {createElement:(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity).filter(Boolean)})};
`
const bundle = build({entryPoints:[fileURLToPath(new URL('../src/concert-scene.tsx',import.meta.url))],bundle:true,write:false,format:'cjs',platform:'node',jsxFactory:'ReactEcs.createElement',plugins:[{
  name:'test-sdk-adapter',setup(b: any){
    b.onResolve({filter:/^(@dcl\/sdk|~system\/RestrictedActions)/},()=>({path:'sdk-adapter',namespace:'adapter'}))
    b.onLoad({filter:/.*/,namespace:'adapter'},()=>({contents:adapter,loader:'js'}))
  }
}]})

async function scene(width=1440,height=900,dpr=1) {
  const h:any={entity:0,writes:0,systems:[],packets:[],moves:[],audio:[],interactions:[],position:{x:5,y:1,z:6},canvas:{width,height,devicePixelRatio:dpr},time:1000}
  class Clock extends Date { static now(){return h.time} }
  const module={exports:{} as any}
  runInNewContext((await bundle).outputFiles[0].text,{module,exports:module.exports,harness:h,Date:Clock,console:{log(){}},setTimeout,clearTimeout})
  module.exports.main()
  h.tick=(ms=50)=>{h.time+=ms;for(const fn of h.systems)fn(ms/1000)}
  h.tick()
  h.nodes=()=>{const result:any[]=[];const visit=(n:any)=>{if(!n)return;result.push(n);n.children?.forEach(visit)};visit(h.render());return result}
  h.text=()=>h.nodes().map((n:any)=>n.props.value||'').join('\n')
  h.click=(value:string)=>{const button=h.nodes().find((n:any)=>n.type==='Button'&&(n.props.value===value||n.props.value.startsWith(value+'\n')));assert.ok(button,'Missing button: '+value);button.props.onMouseDown();h.tick()}
  h.interact=(title:string)=>{const target=h.interactions.find((i:any)=>i.opts.opts.hoverText.startsWith(title));assert.ok(target,title);target.fn();h.tick()}
  h.pad=(lane:number)=>{const nodes=h.nodes();const label=nodes.find((n:any)=>n.type==='Label'&&n.props.value===['C · 1','E · 2','G · 3'][lane]);assert.ok(label,'pad');const parent=nodes.find((n:any)=>n.children.includes(label));parent.props.onMouseDown();h.tick()}
  return h
}
test('arrival leaves world visible and introduces walk-up instruments without crew grid',async()=>{
 const h=await scene();assert.match(h.text(),/0.8/);assert.match(h.text(),/Walk to an instrument/);assert.doesNotMatch(h.text(),/C · 1|K-pop studio/);
 assert.equal(h.audio.filter((a:any)=>a.playing).length,0);assert.equal(h.moves.length,0);
 h.click('How to play');assert.match(h.text(),/21 seconds/);h.click('Minimize');assert.doesNotMatch(h.text(),/Your first show/);
 assert.equal(h.interactions.filter((i:any)=>i.opts.opts.hoverText.startsWith('Play')).length,7);
});
test('world instrument starts short rehearsal; summary and physical microphone gate the live show',async()=>{
 const h=await scene();h.interact('Play K-pop');assert.match(h.text(),/Rehearsal in 10s/);
 h.tick(10000);assert.match(h.text(),/REHEARSAL 1\/3/);assert.match(h.text(),/C · 1/);
 for(let i=0;i<3;i++)h.tick(7000);assert.match(h.text(),/Rehearsal complete/);assert.match(h.text(),/PRECISION/);
 h.click('Walk to stage');assert.doesNotMatch(h.text(),/C · 1/);assert.equal(h.moves.length,0);
 h.tick(20000);h.interact('Ready for');assert.match(h.text(),/Walk closer/);
 h.position={x:12,y:1,z:26};h.interact('Ready for');assert.match(h.text(),/LIVE 1\/5/);
 for(let i=0;i<5;i++)h.tick(12000);assert.match(h.text(),/Show results/);assert.match(h.text(),/Exhibition/);assert.match(h.text(),/Final =/);
 h.click('Other crew');h.click('Minimize');h.tick(24000);assert.doesNotMatch(h.text(),/C · 1/);
});
test('minimized rhythm remains minimized across rounds and can reopen',async()=>{
 const h=await scene();h.interact('Play Electronic');h.tick(10000);h.click('Minimize');h.tick(7000);
 assert.doesNotMatch(h.text(),/C · 1/);assert.match(h.text(),/continues while minimized/);h.click('Open session');assert.match(h.text(),/REHEARSAL 2\/3/);
});
test('menus are reversible and session exit cancels participation',async()=>{
 const h=await scene();h.click('Menu');h.click('Larger controls');h.click('Size: XL');h.click('Reduce motion');h.click('Sound: off — enable');h.click('Sound: on — mute');h.click('Minimize');
 h.interact('Play K-pop');h.click('Minimize');h.click('Menu');h.click('Leave session');h.tick(30000);assert.doesNotMatch(h.text(),/REHEARSAL/);
});
test('correct notes play lead samples; wrong and missed notes play mistake without a lead',async()=>{
 const h=await scene();h.interact('Play K-pop');h.tick(10000);
 const state=()=>[...h.packets].reverse().find((p:any)=>p.packet.kind==='state').packet.state;
 let s=state();const id='real-user-adapter',member=s.players.filter((p:any)=>p.genre==='kpop').findIndex((p:any)=>p.id===id);
 const expected=(s.seed%3+s.round+member)%3;
 h.tick(s.since+2000-h.time);h.pad(expected);
 assert.ok(h.audio.some((a:any)=>a.playing&&a.audioClipUrl==='assets/sounds/lead-'+expected+'.wav'));
 let leadCount=h.audio.filter((a:any)=>a.playing&&a.audioClipUrl.includes('/lead-')).length;
 h.tick(s.since+2750-h.time);h.pad((expected+2)%3);
 assert.ok(h.audio.some((a:any)=>a.playing&&a.audioClipUrl.includes('mistake')));
 assert.equal(h.audio.filter((a:any)=>a.playing&&a.audioClipUrl.includes('/lead-')).length,leadCount);
 h.tick(2000);assert.match(h.text(),/Missed note/);
 assert.ok(h.nodes().some((n:any)=>n.props.uiBackground?.texture?.src==='assets/images/note-symbols.png'));
});
test('native layout model fits portrait, landscape and high-density UI in every view',async()=>{
 for(const [w,h,d] of [[390,844,1],[844,390,1],[1080,2340,3],[2340,1080,3],[1440,900,1]]){
  const app=await scene(w,h,d);
  const check=()=>{
   const measure=(n:any):number=>{const t=n.props.uiTransform||{};if(t.positionType==='absolute')return 0;if(typeof t.height==='number')return t.height;return t.flexDirection==='column'?n.children.reduce((a:number,c:any)=>a+measure(c),0):Math.max(0,...n.children.map(measure))};
   for(const n of app.nodes()){const t=n.props.uiTransform||{};if(t.flexDirection==='column'&&typeof t.height==='number'){const used=n.children.reduce((a:number,c:any)=>a+measure(c),0)+(typeof t.padding==='number'?2*t.padding:0);assert.ok(used<=t.height+.1,w+'x'+h+' '+used+' > '+t.height+' '+n.children.map((c:any)=>c.props.value||c.type).join('/'))}}
  };
  check();app.click('How to play');check();app.click('Minimize');app.click('Menu');check();app.click('Larger controls');check();app.click('Minimize');
  app.interact('Play K-pop');check();app.tick(10000);check();for(let i=0;i<3;i++)app.tick(7000);check();
  app.click('Walk to stage');check();app.position={x:12,y:1,z:26};app.interact('Ready for');check();for(let i=0;i<5;i++)app.tick(12000);check();app.click('Other crew');check();
  assert.ok(app.entity<850);
 }
});
