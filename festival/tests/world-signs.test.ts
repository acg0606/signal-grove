import test from 'node:test'
import assert from 'node:assert/strict'
import { WORLD_TYPE,worldSignLayout,shortWorldPhase } from '../compatibility/world-signs'

test('physical board layout budgets real English copy without oversized black margins or overflow',()=>{
 for(const [text,w,h,size,min] of [
  ['AFFINITY ARENA',8.5,1.4,WORLD_TYPE.landmark,9],
  ['ENTER THE FESTIVAL',8,1,WORLD_TYPE.heading,6.5],
  ['CHOOSE STUDIO\n30s',3.6,1.5,WORLD_TYPE.action,5],
  ['1 CHOOSE\n2 TRAIN\n3 PERFORM',2.8,2.3,WORLD_TYPE.action,5],
  ['BRAZILIAN FUNK',8.4,1.35,WORLD_TYPE.heading,7],
  ['FINALISTS ONLY\nTRAIN FIRST',8,1.4,WORLD_TYPE.action,4.9],
  ['LIVE FINAL / 30s / x2\nBrazilian Funk  400 / 400\nElectronic  400 / 400',14.8,2.8,WORLD_TYPE.heading,6.8],
 ] as [string,number,number,number,number][]){
  const r=worldSignLayout(text,w,h,size),lines=text.split('\n')
  assert.ok(r.fontSize>=min,text);assert.equal(r.textWrapping,true);assert.equal(r.fontAutoSize,false)
  assert.ok(Math.max(...lines.map(s=>s.length))*r.fontSize*.065<=r.width+.001)
  assert.ok(lines.length*r.fontSize*.13<=r.height+.001)
 }
 for(const phase of ['lobby','training','intermission','presentation','battle','result'])assert.ok(shortWorldPhase(phase).length<=13)
})
