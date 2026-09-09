/** Production scene/controller integration with an in-memory SDK adapter.
 * This is NOT a native screenshot, physical device test or real multiplayer test.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { fileURLToPath } from 'node:url'
import { newArena, validSnapshot, type Arena } from '../src/arena'
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
export const Material={setBasicMaterial:()=>h.writes++,setPbrMaterial:()=>h.writes++};
export const MeshRenderer={setBox:()=>{},setSphere:()=>{}}, MeshCollider={setBox:()=>{}};
export const engine={RootEntity:0,addEntity:()=>++h.entity,addSystem:fn=>h.systems.push(fn)};
export const inputSystem={isTriggered:()=>false},InputAction={IA_ACTION_3:3,IA_ACTION_4:4,IA_ACTION_5:5},PointerEventType={PET_DOWN:0};
export const Color4={create:(r,g,b,a)=>({r,g,b,a})},Vector3={create:(x,y,z)=>({x,y,z})};
export const getPlayer=()=>({userId:'real-user-adapter'});
export class MessageBus { on(channel,receive){h.receive=receive} emit(channel,packet){h.packets.push({channel,packet})} }
export const UiEntity='UiEntity',Label='Label',Button='Button';
export const ReactEcsRenderer={setUiRenderer:fn=>h.render=fn};
export default {createElement:(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity).filter(Boolean)})};
`
const bundle = build({entryPoints:[fileURLToPath(new URL('../src/arena-scene.tsx',import.meta.url))],bundle:true,write:false,format:'cjs',platform:'node',jsxFactory:'ReactEcs.createElement',plugins:[{
  name:'test-sdk-adapter',setup(b: any){
    b.onResolve({filter:/^@dcl\/sdk/},()=>({path:'sdk-adapter',namespace:'adapter'}))
    b.onLoad({filter:/.*/,namespace:'adapter'},()=>({contents:adapter,loader:'js'}))
  }
}]})

async function scene(width=1440,height=900) {
  const h:any={entity:0,writes:0,systems:[],packets:[],canvas:{width,height},time:1000}
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

test('production lobby joins, readies, prevents solo start and leaves through real callbacks',async()=>{
  const h=await scene()
  assert.match(h.text(),/0\/4 joined/)
  h.click('K-pop')
  assert.match(h.text(),/1\/2 · Your crew/)
  h.click('Ready to rehearse')
  assert.match(h.text(),/1\/4 ready/)
  assert.match(h.text(),/Waiting for 3 more fans/)
  h.tick(20000)
  assert.match(h.text(),/Find your crew/)
  h.click('Leave crew')
  assert.match(h.text(),/0\/4 joined/)
})
test('production warm-up can play, finish and exit without creating teammates',async()=>{
  const h=await scene()
  h.click('Warm-up');h.click('Start 7-second warm-up')
  assert.match(h.text(),/SOLO PRACTICE/)
  h.tick(1950);h.click('C  /  1')
  assert.match(h.text(),/ON THE MARK/)
  h.tick(5100)
  assert.match(h.text(),/1\/4 on beat/)
  h.click('Next groove')
  assert.match(h.text(),/90 BPM/)
  h.click('Crews')
  assert.match(h.text(),/0\/4 joined/)
  assert.equal(h.packets.some((p:any)=>p.packet.kind==='command'),false)
})
test('guide, reduced motion and stage-only view remain reversible',async()=>{
  const h=await scene()
  h.click('How to play');h.click('Reduce motion')
  assert.match(h.text(),/Motion: reduced/)
  h.click('View the stage')
  assert.match(h.text(),/Back to crew controls/)
  h.click('Back to crew controls')
  assert.match(h.text(),/The crowd is your crew/)
})
test('idle production scene performs no repeated mutable stage writes',async()=>{
  const h=await scene()
  h.writes=0
  for(let i=0;i<600;i++)h.tick()
  assert.equal(h.writes,0)
  h.click('K-pop')
  assert.ok(h.writes>0,'real crew change must still update the stage')
})
test('production root and fixed-height columns fit supported compact and portrait layouts',async()=>{
  for(const [width,height] of [[390,844],[844,390],[1440,900]]){
    const h=await scene(width,height)
    function measured(n:any):number {
      const t=n.props.uiTransform||{}
      if(typeof t.height==='number')return t.height
      const children=n.children.map(measured)
      return t.flexDirection==='column'?children.reduce((a:number,b:number)=>a+b,0):Math.max(0,...children)
    }
    function check() {
      const root=h.render(),t=root.props.uiTransform
      const used=root.children.map(measured).reduce((a:number,b:number)=>a+b,0)+20
      assert.ok(used<=t.height, width+'x'+height+' content '+used+' > '+t.height)
      assert.ok(t.height<=height-16)
    }
    check();h.click('Warm-up');check();h.click('Start 7-second warm-up');check();h.tick(7500);check();h.click('How to play');check()
  }
})

test('production phase UI handles controlled snapshots, card gates and result layouts',async()=>{
  // Synthetic snapshots exercise the real receiver/controller. This is not four-client QA.
  for(const [width,height] of [[390,844],[844,390],[1440,900]]) {
    const h=await scene(width,height)
    h.click('Warm-up');h.click('Start 7-second warm-up')
    const base: Arena={...newArena(h.time,'a:1000'),version:1,phase:'training',
      players:[{id:'real-user-adapter',genre:'kpop',ready:true},{id:'b',genre:'kpop',ready:true},{id:'a',genre:'funk',ready:true},{id:'c',genre:'funk',ready:true}],
      crews:[{genre:'kpop',hp:100,energy:1,shield:0,hits:0,harmony:0},{genre:'funk',hp:100,energy:4,shield:0,hits:0,harmony:0}]}
    function show(phase:Arena['phase'],age:number,winner:Arena['winner']=null) {
      const state={...base,phase,winner,since:h.time-age,version:++base.version}
      assert.ok(validSnapshot(state))
      h.receive({kind:'hello',incarnation:1000},'a')
      h.receive({kind:'state',state,time:h.time},'a');h.tick(0)
      function measured(n:any):number { const t=n.props.uiTransform||{};if(typeof t.height==='number')return t.height;const sizes=n.children.map(measured);return t.flexDirection==='column'?sizes.reduce((a:number,b:number)=>a+b,0):Math.max(0,...sizes) }
      const root=h.render(),used=root.children.map(measured).reduce((a:number,b:number)=>a+b,0)+20
      assert.ok(used<=root.props.uiTransform.height,`${phase} ${width}x${height}: ${used}`)
    }
    show('training',100)
    assert.match(h.text(),/Get ready/);assert.doesNotMatch(h.text(),/SOLO PRACTICE/)
    show('training',2100);assert.match(h.text(),/Rehearsal 1/)
    show('battle',100);assert.match(h.text(),/Choose your card/)
    h.packets=[];h.click('RIFF  |  cost 2')
    assert.equal(h.packets.some((p:any)=>p.packet.kind==='command'),false,'unaffordable card stays disabled')
    show('battle',3500);assert.match(h.text(),/Cards locked/);assert.doesNotMatch(h.text(),/RIFF/)
    show('battle',5000);assert.match(h.text(),/Duel 1/)
    show('result',100,'kpop');assert.match(h.text(),/K-pop wins!/)
    show('result',100,'draw');assert.match(h.text(),/A draw/)
    show('result',100);assert.match(h.text(),/Match cancelled/)
  }
})
