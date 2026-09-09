import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const audio=(name:string)=>readFileSync(new URL('../assets/sounds/'+name,import.meta.url))
test('all playable leads, mistake and percussion beds are bounded non-silent original PCM',()=>{
 for(const [file,seconds] of [...Array.from({length:6},(_,i)=>['bed-'+i+'.wav',7]),...Array.from({length:3},(_,i)=>['lead-'+i+'.wav',.55]),['mistake.wav',.19]] as [string,number][]){
  const b=audio(file);assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.readUInt32LE(24),22050);assert.equal(b.readUInt16LE(22),1);assert.equal(b.readUInt16LE(34),16)
  assert.ok(Math.abs((b.length-44)/44100-seconds)<.0001,file)
  let energy=0,peak=0;for(let i=44;i<b.length;i+=2){const s=b.readInt16LE(i)/32767;energy+=s*s;peak=Math.max(peak,Math.abs(s))}
  assert.ok(energy>1,file);assert.ok(peak<=.801,file)
 }
 assert.notDeepEqual(audio('lead-0.wav'),audio('lead-1.wav'));assert.notDeepEqual(audio('lead-1.wav'),audio('lead-2.wav'))
})
test('the musical note texture is an RGBA atlas with its authored vector source retained',()=>{
 const p=readFileSync(new URL('../assets/images/note-symbols.png',import.meta.url));assert.equal(p.readUInt32BE(16),384);assert.equal(p.readUInt32BE(20),128);assert.equal(p[25],6)
 const svg=readFileSync(new URL('../assets/images/note-symbols.svg',import.meta.url),'utf8');assert.match(svg,/Original geometric musical icon/)
})
