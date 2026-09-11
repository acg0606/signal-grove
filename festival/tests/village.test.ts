import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CABINS, VILLAGE, canopyPulse } from '../compatibility/village-design'
import { studioPosition } from '../src/rules/concert-sheet'
import { buildCabin } from '../scripts/village-geometry.mjs'

for (const [genre, theme] of Object.entries(CABINS)) {
  test(`${genre}: reproducible valid bounded cabin with open porch`, () => {
    const result = buildCabin(theme, VILLAGE), bytes = result.bytes
    assert.equal(bytes.readUInt32LE(0), 0x46546c67)
    assert.equal(bytes.readUInt32LE(4), 2)
    assert.equal(bytes.readUInt32LE(8), bytes.length)
    assert.deepEqual(bytes, readFileSync(new URL(`../assets/models/cabin-${genre}.glb`, import.meta.url)))
    assert.ok(result.triangles < 2200)
    assert.ok(bytes.length < 160000)
    const p = studioPosition(genre as keyof typeof CABINS)
    const binStart = 12 + 8 + bytes.readUInt32LE(12) + 8
    for (const primitive of result.gltf.meshes[0].primitives) {
      const accessor = result.gltf.accessors[primitive.attributes.POSITION]
      const view = result.gltf.bufferViews[accessor.bufferView]
      for(let i=0;i<accessor.count;i++) {
        const offset=binStart+view.byteOffset+i*12
        const x=bytes.readFloatLE(offset),y=bytes.readFloatLE(offset+4),z=bytes.readFloatLE(offset+8)
        assert.ok(Number.isFinite(x+y+z))
        assert.ok(p.x+x*1.5>=0 && p.x+x*1.5<=48, 'X parcel boundary')
        assert.ok(p.z+z*1.5>=8 && p.z+z*1.5<=80, 'Z parcel boundary')
        assert.ok(y>=0 && y<8, 'height')
        if(y>.12 && y<4.8 && z<0) assert.ok(Math.abs(x)>3.8,'no wall vertex across entrance')
      }
      const normal = result.gltf.accessors[primitive.attributes.NORMAL]
      const nv=result.gltf.bufferViews[normal.bufferView]
      for(let i=0;i<normal.count;i++) {
        const at=binStart+nv.byteOffset+i*12
        assert.ok(Math.abs(Math.hypot(bytes.readFloatLE(at),bytes.readFloatLE(at+4),bytes.readFloatLE(at+8))-1)<.00001)
      }
    }
  })
}
test('cabins leave the existing eight-meter notation board inside the shell', () => {
  // The superellipse accommodates the board's entire thickness, not just its center.
  assert.ok((4/(VILLAGE.radiusX*.96))**VILLAGE.footprintPower+(3.115/(VILLAGE.radiusZ*.96))**VILLAGE.footprintPower<1)
})
test('festival identity is distinct, while animation respects reduced motion', () => {
  assert.equal(new Set(Object.values(CABINS).map(c=>c.title)).size,6)
  assert.equal(new Set(Object.values(CABINS).map(c=>c.shape)).size,5)
  for(let now=0;now<10000;now+=31) {
    assert.equal(canopyPulse(now,true,true),1)
    assert.equal(canopyPulse(now,false,false),1)
    assert.ok(canopyPulse(now,true,false)>=.94 && canopyPulse(now,true,false)<=1.06)
  }
})
test('Studio Life preserves daylit layout while the public fork has no borrowed publication target', () => {
  const scene=JSON.parse(readFileSync(new URL('../scene.json',import.meta.url),'utf8'))
  assert.equal(scene.skyboxConfig.fixedTime,VILLAGE.skyTime)
  assert.equal(scene.worldConfiguration,undefined)
  assert.equal(scene.source,undefined)
  assert.equal(scene.display.title,'Affinity Arena - Studio Life Preview')
  assert.equal(scene.scene.parcels.length,15)
})
