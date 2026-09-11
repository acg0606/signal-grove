import { GENRES, type Genre } from './concert'
import { studioPosition } from './concert-sheet'

/** Original fictional residents; decorative NPCs never enter the authority roster. */
export const STUDIO_LIFE: Record<Genre, {title:string; motto:string; residents:readonly [string,string]; hair:readonly [string,string]; jackets:readonly [string,string]; emote:string; props:readonly string[]}> = {
  kpop: {title:'STARLIGHT SOCIAL',motto:'Find your crew. Shine together.',residents:['Nova','Mina'],hair:['hair_anime_01','shoulder_hair'],jackets:['f_red_elegant_jacket','sport_jacket'],emote:'dance',props:['starlight vanity','fan-light display','album shelves','ribbon bench']},
  funk: {title:'BASS WORKSHOP',motto:'Big bass. Tight timing.',residents:['Rio','Alex'],hair:['cool_hair','curly_hair'],jackets:['puffer_jacket','black_jacket'],emote:'dance',props:['double subwoofer stack','beat-pad console','portable boombox','frequency sculpture']},
  latin: {title:'SUNSET SESSIONS',motto:'Make room for every rhythm.',residents:['Sol','Luca'],hair:['shoulder_hair','slicked_hair'],jackets:['sport_jacket','black_jacket'],emote:'dance',props:['timbales and cowbell','nylon-string guitar','sunburst sculpture','listening bench']},
  afrobeats: {title:'GROOVE EXCHANGE',motto:'Many influences. One groove.',residents:['Ari','Zuri'],hair:['curly_hair','hair_anime_01'],jackets:['sport_jacket','f_red_elegant_jacket'],emote:'dance',props:['percussion station','pad sampler','interlocking groove rings','record shelf']},
  hiphop: {title:'THE LISTENING ROOM',motto:'Your voice. Your signature.',residents:['Jules','Remy'],hair:['hair_oldie','cool_hair'],jackets:['sleeveless_punk_shirt','puffer_jacket'],emote:'dance',props:['vinyl turntable booth','record crates','microphone and pop filter','cassette sculpture']},
  electronic: {title:'PRISM LAB',motto:'Shape the sound. Find the pulse.',residents:['Echo','Lux'],hair:['slicked_hair','shoulder_hair'],jackets:['black_jacket','sport_jacket'],emote:'robot',props:['modular synthesizer','patch-cable rack','orbital sequencer','prism plinths']}
}
export const RESIDENT_BUDGET = { loadRadius:14, unloadRadius:18, maxStudios:2, checkEveryMs:500, emoteEveryMs:7000 } as const
/** Hysteresis prevents wearable reloads at the edge; nearby studios win deterministically. */
export function nearbyStudios(position:{x:number;z:number}|undefined, previous:readonly Genre[]=[]):Genre[] {
  if(!position||!Number.isFinite(position.x+position.z))return []
  return GENRES.map(genre=>{const p=studioPosition(genre);return {genre,d:Math.hypot(p.x-position.x,p.z-position.z)}})
    .filter(({genre,d})=>d<=(previous.includes(genre)?RESIDENT_BUDGET.unloadRadius:RESIDENT_BUDGET.loadRadius))
    .sort((a,b)=>a.d-b.d||GENRES.indexOf(a.genre)-GENRES.indexOf(b.genre)).slice(0,RESIDENT_BUDGET.maxStudios).map(x=>x.genre)
}

export const HUD_TYPE = { metadata:20, body:24, action:24, heading:28, note:32 } as const
export const hudLineHeight = (size:number) => Math.ceil(size*1.35)
export function paginateRows(heights:readonly number[],available:number):number[][] {
  const pages:number[][]=[[]];let used=0
  heights.forEach((h,i)=>{if(h>available)throw Error('HUD row exceeds page capacity');if(used+h>available){pages.push([]);used=0}pages[pages.length-1].push(i);used+=h})
  return pages
}
/** Explicit wrapping for the ECS renderer, which does not expose OS font scaling. */
export function wrapHudText(text:string, width:number, fontSize:number):string {
  const count=Math.max(10,Math.floor(width/(fontSize*.58)))
  return text.split('\n').map(paragraph=>{
    let line='',lines:string[]=[]
    for(const word of paragraph.split(/\s+/)) {
      if(line.length&&line.length+word.length+1>count){lines.push(line);line=word}else line+=(line?' ':'')+word
    }
    lines.push(line);return lines.join('\n')
  }).join('\n')
}
