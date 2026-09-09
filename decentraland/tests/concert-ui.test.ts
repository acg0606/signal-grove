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
 create:(e,v)=>values.set(e,v), createOrReplace:(e,v)=>values.set(e,v),
 has:e=>values.has(e), get:e=>values.get(e), getOrNull:e=>values.get(e)||null,
 getMutable:e=>{h.writes++;return values.get(e)}
}; }
export const Transform=component(), TextShape=component(), AudioSource=component();
export const UiCanvasInformation={getOrNull:()=>h.canvas};
export const Material={Texture:{Common:x=>x},setBasicMaterial:()=>h.writes++,setPbrMaterial:()=>h.writes++};
export const MeshRenderer={setBox:()=>{},setSphere:()=>{},setPlane:()=>{}}, MeshCollider={setBox:()=>{}};
export const engine={RootEntity:0,addEntity:()=>++h.entity,addSystem:fn=>h.systems.push(fn)};
export const inputSystem={isTriggered:()=>false},InputAction={IA_ACTION_3:3,IA_ACTION_4:4,IA_ACTION_5:5},PointerEventType={PET_DOWN:0};
export const Color4={create:(r,g,b,a)=>({r,g,b,a})},Vector3={create:(x,y,z)=>({x,y,z})};
export const Quaternion={fromEulerDegrees:(x,y,z)=>({x,y,z,w:1})};
export const movePlayerTo=async p=>{h.moves.push(p);return {success:true}};
export const getPlayer=()=>({userId:'real-user-adapter'});
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
  const h:any={entity:0,writes:0,systems:[],packets:[],moves:[],canvas:{width,height,devicePixelRatio:dpr},time:1000}
  class Clock extends Date { static now(){return h.time} }
  const module={exports:{} as any}
  runInNewContext((await bundle).outputFiles[0].text,{module,exports:module.exports,harness:h,Date:Clock,console:{log(){}},setTimeout,clearTimeout})
  module.exports.main()
  h.tick=(ms=50)=>{h.time+=ms;for(const fn of h.systems)fn(ms/1000)}
  h.tick()
  h.nodes=()=>{const result:any[]=[];const visit=(n:any)=>{if(!n)return;result.push(n);n.children?.forEach(visit)};visit(h.render());return result}
  h.text=()=>h.nodes().map((n:any)=>n.props.value||'').join('\n')
  h.click=(value:string)=>{const button=h.nodes().find((n:any)=>n.type==='Button'&&(n.props.value===value||n.props.value.startsWith(value+'\n')));assert.ok(button,'Missing button: '+value);button.props.onMouseDown();h.tick()}
  return h
}
test('v07 actual production callbacks open studio immediately, run bot exhibition and reset',async()=>{
 const h=await scene(); h.click('K-pop');
 assert.match(h.text(),/K-pop studio/); assert.match(h.text(),/start in 20s/); assert.match(h.text(),/C   1/);
 assert.equal(h.moves.length,1);
 h.tick(20000); assert.match(h.text(),/STUDIO 1\/6/); assert.match(h.text(),/BOTS/);
 for(let i=0;i<6;i++)h.tick(7000);
 assert.match(h.text(),/TO THE STAGE/); assert.equal(h.moves.length,2);
 for(let i=0;i<5;i++)h.tick(12000);
 assert.match(h.text(),/EXHIBITION/); assert.match(h.text(),/Final =/);
 h.tick(24000);assert.match(h.text(),/Choose your music/);
});
test('production UI toggles audio, size, guide, reduced motion and stage view reversibly',async()=>{
 const h=await scene();h.click('Sound on');assert.match(h.text(),/Mute/);
 h.click('Larger UI');assert.match(h.text(),/Size: XL/);
 h.click('How to play');h.click('Reduce motion');assert.match(h.text(),/Motion reduced/);
 h.click('Choose my studio');h.click('View club');h.click('Open music controls');assert.match(h.text(),/Choose your music/);
});
test('production UI cancels matchmaking and leaves no bots or forced show',async()=>{
 const h=await scene();h.click('K-pop');h.click('Leave queue');h.tick(30000);
 assert.match(h.text(),/Choose your music/);assert.doesNotMatch(h.text(),/STUDIO 1/);
});
test('phone landscape crew paging exposes all six genres without shrinking controls',async()=>{
 const h=await scene(2340,1080,3);assert.match(h.text(),/K-pop/);
 h.click('More crews');assert.match(h.text(),/Latin Urban/);
 h.click('More crews');assert.match(h.text(),/Electronic/);
 h.click('Electronic');assert.match(h.text(),/Electronic studio/);
 const pad=h.nodes().find((n:any)=>n.props.value==='C   1');assert.ok(pad.props.uiTransform.height>=160);
});
test('club construction stays below the entity budget and exposes version 0.7',async()=>{
 const h=await scene();assert.ok(h.entity<800,'bounded entity count '+h.entity);
 assert.match(h.text(),/0.7/);
});
test('all production column children fit their declared height at phone, desktop and high density',async()=>{
 for(const [w,h,d] of [[390,844,1],[844,390,1],[1080,2340,3],[2340,1080,3],[1440,900,1]]){
  const app=await scene(w,h,d);
  function check(){
   function measure(n:any):number{ const t=n.props.uiTransform||{}; if(t.positionType==='absolute')return 0; if(typeof t.height==='number')return t.height;
     return t.flexDirection==='column'?n.children.reduce((a:number,c:any)=>a+measure(c),0):Math.max(0,...n.children.map(measure)); }
   for(const n of app.nodes()){
    const t=n.props.uiTransform||{};
    if(t.flexDirection==='column'&&typeof t.height==='number'){
     const used=n.children.reduce((a:number,c:any)=>a+measure(c),0)+(typeof t.padding==='number'?2*t.padding:0);
     assert.ok(used<=t.height+.1, w+'x'+h+' column '+used+' > '+t.height+' '+n.children.map((c:any)=>c.props.value||c.type).join('/'));
    }
   }
  }
  check();app.click('Larger UI');check();assert.match(app.text(),/Size: XL/);app.click('Size: XL');check();app.click('K-pop');check();app.tick(20000);check();
  for(let i=0;i<6;i++)app.tick(7000);check();
  for(let i=0;i<5;i++)app.tick(12000);check();
  if(app.text().includes('Attributes')){app.click('Attributes');check();assert.match(app.text(),/PRECISION/);app.click('Attributes');check();app.click('Totals');check();}
 }
});
