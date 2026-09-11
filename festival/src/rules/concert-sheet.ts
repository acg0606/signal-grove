/** A personal, world-space score. Ink is authoritative; misses fall off the page. */
import { cueFor, isPerformer, type Arena, type Genre, GENRES } from './concert'
import { noteTime, LATE_MS } from './rhythm'
export const VENUE = { width: 48, depth: 80, stageZ: 71, stagePlayZ: 69.5, gateZ: 66.2, stageXs: [18, 30] } as const
export function studioPosition(g: Genre) { const i = GENRES.indexOf(g); return { x: i < 3 ? 7.5 : 40.5, y: .6, z: 18.5 + (i % 3) * 16.5 } }
export function performancePosition(s: Arena, id: string) {
 const me=s.players.find(p=>p.id===id)
 if(!me || !isPerformer(s,id))return null
 if(s.phase==='training')return {...studioPosition(me.genre),z:studioPosition(me.genre).z+1}
 if(s.phase==='battle'||s.phase==='presentation')return {x:VENUE.stageXs[s.finalists.indexOf(me.genre)===1?1:0],y:1,z:VENUE.stagePlayZ}
 return null
}
export function nearPerformance(s:Arena,id:string,p:{x:number;z:number}|undefined) {
 const target=performancePosition(s,id);return !!target&&!!p&&Math.abs(target.x-p.x)<=6&&p.z<=target.z+2&&p.z>=target.z-7
}
export function sheetNote(s:Arena,id:string,index:number,age:number,attempted=0,reduced=false) {
 const lane=cueFor(s,id,index), target=noteTime(s.round,index,s.phase==='battle'),wait=target-age
 const mask=s.choices[`${id}:notes`]??0, hit=!!(mask&(1<<(index+4))), wrong=!!(mask&(1<<index))&&!hit
 if(hit)return {state:'ink' as const,lane,x:-3.35+index*.58,y:lane*.32-.32,visible:true}
 const expired=age>target+LATE_MS
 if(wrong||expired){const t=Math.max(0,age-target-(wrong?0:LATE_MS))/700;return {state:'miss' as const,lane,x:-.7,y:lane*.32-.32-(reduced?0:Math.min(1,t)*1.2),visible:!reduced&&t<1}}
 return {state:(attempted&(1<<index))?'pending' as const:'incoming' as const,lane,x:-.7+wait/2400*4.1,y:lane*.32-.32,visible:wait<=2400&&wait>=-LATE_MS}
}
