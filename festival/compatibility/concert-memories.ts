/** Visit-only notebook. No persistence, screenshot or verified global ranking claim. */
import { GENRES, total, type Arena, type Genre, type Attributes } from './concert'
export type Keepsake={match:string;date:string;genre:Genre;score:number;attributes:Attributes;mode:Arena['mode'];kind:'ILLUSTRATED_KEEPSAKE'}
export class VisitMemories {
 readonly album:Keepsake[]=[]
 readonly wins=Object.fromEntries(GENRES.map(g=>[g,{human:0,exhibition:0}])) as Record<Genre,{human:number;exhibition:number}>
 private seen=new Set<string>()
 observe(s:Arena,id:string,now:number){
  if(s.phase!=='result'||this.seen.has(s.match)||!s.winner||s.winner==='draw'||!Number.isFinite(new Date(now).getTime()))return false
  this.seen.add(s.match);if(this.seen.size>128)this.seen.delete(this.seen.values().next().value!)
  this.wins[s.winner][s.mode==='HUMAN_MATCH'?'human':'exhibition']++
  const me=s.players.find(p=>p.id===id&&!p.bot),crew=s.crews.find(c=>c.genre===s.winner)
  if(!me||me.genre!==s.winner||!crew)return false
  this.album.unshift({match:s.match,date:new Date(now).toISOString().slice(0,10),genre:me.genre,score:total(crew.final),attributes:{...crew.final},mode:s.mode,kind:'ILLUSTRATED_KEEPSAKE'})
  this.album.length=Math.min(24,this.album.length);return true
 }
 ranking(){return GENRES.map(genre=>({genre,...this.wins[genre]})).sort((a,b)=>b.human-a.human||b.exhibition-a.exhibition)}
}
