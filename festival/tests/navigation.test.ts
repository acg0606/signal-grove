import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { WALK,rampSurface,cabinWalls,overlapsAvatar } from '../compatibility/festival-navigation'
import { VILLAGE } from '../compatibility/village-design'
import { STUDIO_OBSTACLES } from '../compatibility/studio-obstacles'
import { buildStudioProps } from '../scripts/studio-props.mjs'
import { GENRES } from '../src/rules/concert'

test('thick primitive walls leave the wide porch open and protect the rear on both sides',()=>{
 const walls=cabinWalls(0,0);assert.equal(walls.length,16)
 for(let z=-5;z<.8;z+=.1)for(const x of [-1,0,1])assert.equal(walls.some(b=>overlapsAvatar(b,x,z)),false)
 const curve=(v:number)=>Math.sign(v)*Math.abs(v)**(2/VILLAGE.footprintPower)
 for(let a=Math.PI/3+.01;a<5*Math.PI/3-.01;a+=.01){
  const x=curve(Math.sin(a))*VILLAGE.radiusX*.96,z=-curve(Math.cos(a))*VILLAGE.radiusZ*.96
  assert.ok(walls.some(b=>overlapsAvatar(b,x,z,.16)),'unprotected shell seam')
 }
})
test('generated furniture volumes match source GLBs and protect objects without blocking central approach',()=>{
 for(const g of GENRES){
  const bytes=readFileSync(new URL('../assets/models/studio-props-'+g+'.glb',import.meta.url))
  const model=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString())
  const expected=model.extras.props.filter((p:any)=>p.min[1]<1.8)
  assert.equal(STUDIO_OBSTACLES[g].length,expected.length)
  for(const [i,b] of STUDIO_OBSTACLES[g].entries()){
   const p=expected[i];assert.equal(b.name,p.name);assert.equal(b.sx,p.max[0]-p.min[0]);assert.equal(b.z,(p.min[2]+p.max[2])/2)
   const solid={...b,x:b.x*WALK.propsScaleX,sx:b.sx*WALK.propsScaleX}
   assert.ok(overlapsAvatar(solid,solid.x,solid.z))
   for(let z=-4;z<=.8;z+=.25)for(const x of [-1,0,1])assert.equal(overlapsAvatar(solid,x,z),false)
  }
 }
})
test('continuous stage ramp stays below 45 degrees, overlaps stage and retains a wide center passage',()=>{
 const r=WALK.ramp
 assert.ok(Math.atan2(r.rise,r.depth*1.5)*180/Math.PI<15)
 assert.ok(r.z+r.depth/2>39);assert.ok(r.z-r.depth/2<37)
 assert.ok(r.width*1.5>=9);assert.equal(WALK.gateWidth,r.width)
 assert.ok(Math.abs(rampSurface(r.z-r.depth/2))<.001,'flush avenue entry')
 assert.ok(Math.abs(.7-rampSurface(39))<.005,'stage transition within 5mm, not a 30cm step allowance')
 const a=Math.atan2(r.rise,r.depth),centerY=r.y-.06/Math.cos(a)
 assert.ok(Math.abs(centerY+(39-r.z)*Math.tan(a)+.06/Math.cos(a)-rampSurface(39))<1e-6)
})
test('garden is deterministic, texture-free, bounded and economical',()=>{
 const r=buildStudioProps('garden',{shell:[.26,.65,.43],trim:[1,.80,.29],roof:[.48,.27,.15]},WALK)
 assert.deepEqual(r.bytes,readFileSync(new URL('../assets/models/festival-garden.glb',import.meta.url)))
 assert.ok(r.triangles<3000);assert.ok(r.bytes.length<200000);assert.ok(r.gltf.meshes[0].primitives.length<=6)
 assert.equal(r.gltf.textures,undefined);assert.equal(r.objects.length,12)
 for(const p of r.objects){
  assert.ok(p.min[0]>=0&&p.max[0]*1.5<48);assert.ok(p.min[2]*1.5+8>=0&&p.max[2]*1.5+8<80)
  assert.ok(p.min[1]>=0&&p.max[1]<20)
 }
 for(const p of WALK.trees)assert.ok(p.x<10||p.x>22,'no tree in the festival avenue')
 for(const p of WALK.posters)assert.ok(Math.abs(p.x-16)-1.3>=3.2,'at least 9.6 world meters of central circulation')
})
