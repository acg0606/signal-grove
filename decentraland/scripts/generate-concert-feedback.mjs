// Original synthesis: percussion-only beds, playable lead notes and a soft mistake sound.
// No samples, lyrics or third-party melodies. Running this script only writes its named WAVs.
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const folder=fileURLToPath(new URL('../assets/sounds/',import.meta.url)), sr=22050
mkdirSync(folder,{recursive:true})
function wav(name,samples){
 const b=Buffer.alloc(44+samples.length*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(sr,24);b.writeUInt32LE(sr*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(samples.length*2,40)
 for(let i=0;i<samples.length;i++){const fade=Math.min(1,i/(sr*.005),(samples.length-1-i)/(sr*.025));b.writeInt16LE(Math.round(Math.max(-.8,Math.min(.8,samples[i]*fade))*32767),44+i*2)}
 writeFileSync(folder+name,b);console.log(name+' '+b.length+' bytes')
}
for(const [lane,f] of [523.251,659.255,783.991].entries()){
 const s=new Float64Array(Math.round(sr*.55));for(let i=0;i<s.length;i++){const t=i/sr; s[i]=Math.exp(-6*t)*(.34*Math.sin(2*Math.PI*f*t)+.08*Math.sin(4*Math.PI*f*t))}wav('lead-'+lane+'.wav',s)
}
{
 const s=new Float64Array(Math.round(sr*.19));for(let i=0;i<s.length;i++){const t=i/sr;s[i]=Math.exp(-20*t)*(.2*Math.sin(2*Math.PI*(145*t-160*t*t))+.07*Math.sin(2*Math.PI*173*t))}wav('mistake.wav',s)
}
const patterns=[[0,4,8,12],[0,3,6,10],[0,6,8,14],[0,3,8,11],[0,7,8,14],[0,4,8,12]]
for(let track=0;track<6;track++){
 const s=new Float64Array(sr*7),beat=60/[80,90,100,110,120,130][track];let rng=71+track
 // Align a downbeat at the first target (2 seconds), including pre-roll beats.
 for(let tick=-Math.floor(2/(beat/4));2+tick*beat/4<7;tick++){
  const start=Math.round((2+tick*beat/4)*sr),step=((tick%16)+16)%16
  for(let j=0;j<sr*.3&&start+j<s.length;j++){
   const t=j/sr; rng=(Math.imul(rng,1664525)+1013904223)>>>0;const noise=rng/2147483648-1
   if(patterns[track].includes(step))s[start+j]+=.28*Math.exp(-17*t)*Math.sin(2*Math.PI*(45*t+4*(1-Math.exp(-30*t))))
   if(step===4||step===12)s[start+j]+=.065*noise*Math.exp(-45*t)
   if(tick%2===0)s[start+j]+=.027*noise*Math.exp(-85*t)
  }
 }wav('bed-'+track+'.wav',s)
}
