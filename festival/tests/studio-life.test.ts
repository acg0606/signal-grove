import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CABINS } from '../compatibility/village-design'
import { STUDIO_LIFE, nearbyStudios, HUD_TYPE, wrapHudText, paginateRows, RESIDENT_BUDGET } from '../compatibility/studio-life'
import { studioPosition } from '../src/rules/concert-sheet'
import { buildStudioProps } from '../scripts/studio-props.mjs'
import { GENRES } from '../src/rules/concert'
import { CONCERT_RGB } from '../compatibility/concert-layout'

for(const genre of GENRES)test(`${genre}: original detailed props fit side bays without blocking rehearsal`,()=>{
  const r=buildStudioProps(genre,CABINS[genre]),b=r.bytes
  assert.deepEqual(b,readFileSync(new URL(`../assets/models/studio-props-${genre}.glb`,import.meta.url)))
  assert.equal(b.readUInt32LE(0),0x46546c67);assert.equal(b.readUInt32LE(8),b.length)
  assert.equal(r.objects.length,4);assert.equal(r.gltf.meshes.length,1)
  assert.ok(r.gltf.meshes[0].primitives.length<=6);assert.ok(r.triangles<5000);assert.ok(b.length<360000)
  assert.equal(r.gltf.textures,undefined);assert.equal(r.gltf.images,undefined)
  assert.deepEqual(r.objects.map((o:any)=>o.name),[...STUDIO_LIFE[genre].props])
  for(const o of r.objects){assert.ok(o.min[0]>=-4.76&&o.max[0]<=4.76,o.name+' cabin boundary');assert.ok(o.max[0]<-2.45||o.min[0]>2.45,o.name+' clear middle');assert.ok(o.min[1]>=0&&o.max[1]<3.6,o.name+' height');assert.ok(o.min[2]>-2.1&&o.max[2]<2.8,o.name+' front/back clearance')}
  const dataStart=28+b.readUInt32LE(12)
  for(const primitive of r.gltf.meshes[0].primitives){const a=r.gltf.accessors[primitive.attributes.NORMAL],v=r.gltf.bufferViews[a.bufferView];for(let i=0;i<a.count;i++){const at=dataStart+v.byteOffset+i*12;assert.ok(Math.abs(Math.hypot(b.readFloatLE(at),b.readFloatLE(at+4),b.readFloatLE(at+8))-1)<1e-5)}}
})
test('twelve original NPCs are distinct and proximity budget never exceeds four visible residents',()=>{
  assert.equal(new Set(Object.values(STUDIO_LIFE).flatMap(x=>[...x.residents])).size,12)
  for(const g of GENRES){assert.ok(nearbyStudios(studioPosition(g)).includes(g));assert.equal(STUDIO_LIFE[g].residents.length,2)}
  for(let x=0;x<48;x+=2)for(let z=0;z<80;z+=2)assert.ok(nearbyStudios({x,z},GENRES).length<=RESIDENT_BUDGET.maxStudios)
  assert.deepEqual(nearbyStudios(undefined),[]);assert.deepEqual(nearbyStudios({x:NaN,z:0}),[])
  const p=studioPosition('kpop');assert.ok(nearbyStudios({x:p.x,z:p.z-16},['kpop']).includes('kpop'));assert.ok(!nearbyStudios({x:p.x,z:p.z-16}).includes('kpop'))
})
test('readable type, explicit wrap and pagination preserve every instruction',()=>{
  assert.ok(Math.min(...Object.values(HUD_TYPE))>=16)
  const words='Read your studio panel. Notes move right to left. Tap C, E or G at the white line.'
  assert.equal(wrapHudText(words,320,18).replaceAll('\n',' '),words)
  const heights=[32,58,54,58,32,54,54];const pages=paginateRows(heights,160)
  assert.deepEqual(pages.flat(),heights.map((_,i)=>i));pages.forEach(page=>assert.ok(page.reduce((s,i)=>s+heights[i],0)<=160))
  assert.throws(()=>paginateRows([200],160))
})
test('genre and body lettering retain minimum contrast on opaque notation surfaces',()=>{
  const luminance=(rgb:readonly number[])=>rgb.map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0)
  for(const role of [...GENRES,'white','muted'] as const){const ratio=(luminance(CONCERT_RGB[role])+.05)/(luminance(CONCERT_RGB.ink)+.05);assert.ok(ratio>=4.5,role+' '+ratio)}
})
