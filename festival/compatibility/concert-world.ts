import { engine, Entity, Transform, MeshRenderer, MeshCollider, ColliderLayer, Material, TextShape, LightSource, GltfContainer, AvatarShape, AvatarAttach, AvatarAnchorPointType, pointerEventsSystem, InputAction } from '@dcl/sdk/ecs'
import { Color4, Vector3, Quaternion } from '@dcl/sdk/math'
import { GENRES, GENRE_NAMES, ATTRIBUTES, type Genre, type Arena, total, phaseSeconds, phaseTitle, isPerformer } from './concert'
import { CONCERT_RGB } from './concert-layout'
import { studioPosition, sheetNote, VENUE } from './concert-sheet'
import { VisitMemories } from './concert-memories'
import { CABINS, VILLAGE, canopyPulse } from './village-design'
import { STUDIO_LIFE, RESIDENT_BUDGET, nearbyStudios } from './studio-life'
import { WALK, rampSurface, cabinWalls, type Solid } from './festival-navigation'
import { STUDIO_OBSTACLES } from './studio-obstacles'
import { WORLD_TYPE, WORLD_TEXT_X, worldSignLayout, shortWorldPhase } from './world-signs'
export { studioPosition } from './concert-sheet'
// Author the established venue in its original units, then expand its footprint.
function localStudio(g:Genre){const p=studioPosition(g);return {...p,x:p.x/1.5,z:(p.z-8)/1.5}}
export const ATLAS = 'assets/images/crew-atlas-v07.png'
export const color = (g: keyof typeof CONCERT_RGB) => Color4.create(...CONCERT_RGB[g], 1)
export function crewUV(g: Genre) {
  const i = GENRES.indexOf(g), x = (i % 3) / 3, y = i < 3 ? .5 : 0
  return [x, y, x, y + .5, x + 1 / 3, y + .5, x + 1 / 3, y]
}
const ink = color('ink'), white = color('white')
const villageColor = (rgb:readonly [number,number,number])=>Color4.create(...rgb,1)
const lanterns:Entity[]=[]
let clubRoot:Entity, residentCheck=-Infinity
let leavingStage=false
const residents=new Map<Genre,{entities:Entity[];lastEmote:number;motion:boolean}>()
function solidVolume(b:Solid,pointer=true){
 const e=engine.addEntity()
 Transform.create(e,{position:Vector3.create(b.x,b.y,b.z),scale:Vector3.create(b.sx,b.sy,b.sz),rotation:Quaternion.fromEulerDegrees(0,b.yaw??0,0)})
 MeshCollider.setBox(e,pointer?ColliderLayer.CL_PHYSICS|ColliderLayer.CL_POINTER:ColliderLayer.CL_PHYSICS)
 return e
}
export function box(x: number, y: number, z: number, sx: number, sy: number, sz: number, c = ink, solid = false, rotation = 0) {
  const e = engine.addEntity()
  Transform.create(e, { position: Vector3.create(x, y, z), scale: Vector3.create(sx, sy, sz), rotation: Quaternion.fromEulerDegrees(0, 0, rotation) })
  MeshRenderer.setBox(e); if (solid) MeshCollider.setBox(e)
  Material.setBasicMaterial(e, { diffuseColor: c, castShadows: false }); return e
}
function sphere(x: number, y: number, z: number, sx: number, sy: number, sz: number, c: Color4) {
  const e = engine.addEntity(); Transform.create(e, { position: Vector3.create(x, y, z), scale: Vector3.create(sx, sy, sz) })
  MeshRenderer.setSphere(e); Material.setBasicMaterial(e, { diffuseColor: c, castShadows: false }); return e
}
function sign(x: number, y: number, z: number, value: string, size: number, c = white) {
  const e = engine.addEntity(); Transform.create(e, { position: Vector3.create(x, y, z), scale:Vector3.create(WORLD_TEXT_X,1,1) })
  TextShape.create(e, { text: value, fontSize: size, textColor: c, outlineWidth: .06, outlineColor: ink }); return e
}
function emblem(x: number, y: number, z: number, size: number, g: Genre) {
  const e = engine.addEntity(); Transform.create(e, { position: Vector3.create(x, y, z), scale: Vector3.create(size, size, 1) })
  const uv = crewUV(g); MeshRenderer.setPlane(e, [...uv, ...uv])
  Material.setBasicMaterial(e, { texture: Material.Texture.Common({ src: ATLAS }), diffuseColor: white, castShadows: false }); return e
}
function speaker(x: number, y: number, z: number, c: Color4, size = 1) {
  box(x, y + 1.1 * size, z, size, 2.2 * size, .8 * size, color('panel'),true)
  for (const dy of [.55, 1.4]) {
    sphere(x, y + dy * size, z - .42 * size, .73 * size, .73 * size, .08, c)
    sphere(x, y + dy * size, z - .47 * size, .52 * size, .52 * size, .1, ink)
  }
  box(x, y + 2.02 * size, z - .43 * size, .8 * size, .08, .04, c)
}
function keyboard(x: number, z: number, c: Color4) {
  const e = box(x, 1.2, z, 2.3, .2, .75, c)
  for (let k = 0; k < 12; k++) box(x - 1.04 + k * .19, 1.32, z - .12, .16, .04, .4, k % 3 === 0 ? ink : white)
  for (const dx of [-.8, .8]) box(x + dx, .65, z, .09, 1.1, .1, white)
  return e
}
function drum(x: number, z: number, c: Color4) {
  const e = sphere(x, .85, z, .9, 1.3, .9, c); sphere(x, 1.45, z, .95, .1, .95, white); return e
}

type Sheet={x:number;y:number;z:number;label:Entity;notes:Entity[];letters:Entity[];wasActive:boolean;marks:string[];monitor?:boolean}
const sheets:Sheet[]=[],fans:Entity[]=[],fanBadges:Entity[]=[],stageLights:Entity[]=[],arrows:Entity[]=[],trophy:Entity[]=[],bars:Entity[]=[]
const gold=Color4.create(1,.72,.18,1)
let stageGuide:Entity,gate:Entity,festivalClock:Entity,board:Entity,cover:Entity,coverIcon:Entity,rankBoard:Entity,flash:Entity,lastFrame=-1,lastEmote='',lastPhase='',lastBoard='',lastRank='',lastCover=''
const signBounds=new Map<Entity,{w:number;h:number;size:number}>()
function banner(x:number,y:number,z:number,w:number,h:number,value:string,size:number,c=white) {
 box(x,y,z,w+.12,h+.12,.13,c);box(x,y,z-.09,w,h,.08,ink)
 const e=sign(x,y,z-.15,value,size,c)
 Object.assign(TextShape.getMutable(e),worldSignLayout(value,w,h,size))
 signBounds.set(e,{w,h,size});return e
}
function interact(e:Entity,title:string,action:()=>void){MeshCollider.setBox(e,ColliderLayer.CL_POINTER);pointerEventsSystem.onPointerDown({entity:e,opts:{button:InputAction.IA_POINTER,hoverText:title,maxDistance:8}},action)}
function musicSheet(x:number,y:number,z:number,title:string,c:Color4,action:()=>void,monitor=false) {
 const existing=new Set([...engine.getEntitiesWith(Transform)].map(([e])=>e))
 const back=box(x,y+.35,z,8,2.65,.13,color('panel'));interact(back,title,action)
 MeshCollider.setBox(back,ColliderLayer.CL_PHYSICS|ColliderLayer.CL_POINTER)
 for(let i=0;i<5;i++)box(x,y+i*.32,z-.09,7.65,.018,.025,Color4.create(.6,.65,.8,1))
 for(const dx of [-.7,-3.35,-2.77,-2.19,-1.61])box(x+dx,y-.32,z-.09,.45,.018,.025,white)
 box(x-.7,y+.3,z-.12,.035,1.95,.02,white)
 const displayTitle=monitor?'FLOOR MONITOR':title.startsWith('Ready for')?'LIVE CREW':title.replace(/^Play /,'').replace(/ studio$/,'').toUpperCase()
 banner(x,y+1.85,z,7.8,.78,displayTitle,WORLD_TYPE.heading,c)
 const label=sign(x,y-.79,z-.12,'C E G / HIT THE LINE',WORLD_TYPE.detail)
 const notes:Entity[]=[],letters:Entity[]=[]
 for(let i=0;i<4;i++){
  const e=engine.addEntity();Transform.create(e,{position:Vector3.create(x,y,z-.15),scale:Vector3.create(0,0,0)});MeshRenderer.setPlane(e)
  Material.setBasicMaterial(e,{texture:Material.Texture.Common({src:'assets/images/note-symbols.png'}),diffuseColor:white,castShadows:false});notes.push(e)
  letters.push(sign(x,y,z-.17,'',WORLD_TYPE.note))
 }
 if(monitor){
  const parts=[...engine.getEntitiesWith(Transform)].filter(([e])=>!existing.has(e))
  const pivot=engine.addEntity();Transform.create(pivot,{position:Vector3.create(x,y,z),rotation:Quaternion.fromEulerDegrees(0,180,0),scale:Vector3.create(.58,.58,.58)})
  for(const [e] of parts){const t=Transform.getMutable(e);t.position=Vector3.create(t.position.x-x,t.position.y-y,t.position.z-z);t.parent=pivot}
 }
 sheets.push({x:monitor?0:x,y:monitor?0:y,z:monitor?0:z,label,notes,letters,wasActive:false,marks:[],monitor})
}
const BASE='urn:decentraland:off-chain:base-avatars:'
function avatar(id:string,x:number,z:number,hair:string,jacket:string,female=false,y=.1) {
 const e=engine.addEntity();Transform.create(e,{position:Vector3.create(x,y,z),rotation:Quaternion.fromEulerDegrees(0,180,0),scale:Vector3.create(1/1.5,1,1/1.5)})
 AvatarShape.create(e,{id,name:'',bodyShape:BASE+(female?'BaseFemale':'BaseMale'),wearables:[hair,jacket,female?'f_jeans':'distressed_black_Jeans','sneakers'].map(w=>BASE+w),emotes:[],skinColor:{r:.42+(fans.length%3)*.16,g:.26+(fans.length%3)*.14,b:.2+(fans.length%3)*.12},hairColor:{r:.08,g:.04,b:.07},eyeColor:{r:.18,g:.11,b:.06}})
 return e
}
function headphones(id:string) {
 const head=engine.addEntity();Transform.create(head);AvatarAttach.create(head,{avatarId:id,anchorPointId:AvatarAnchorPointType.AAPT_HEAD})
 for(const [x,y,sx,sy] of [[-.16,0,.10,.19],[.16,0,.10,.19],[0,.16,.37,.05]]){
  const e=box(x,y,0,sx,sy,.13,color('electronic'));Transform.getMutable(e).parent=head
 }
}
function cabin(g:Genre,x:number,z:number) {
 const theme=CABINS[g],c=color(g),trim=villageColor(theme.trim)
 const shell=engine.addEntity();Transform.create(shell,{position:Vector3.create(x,0,z)})
 // The glTF contains a real wide opening; decorative roofs cannot steal join taps.
 GltfContainer.create(shell,{src:`assets/models/cabin-${g}.glb`,visibleMeshesCollisionMask:0,invisibleMeshesCollisionMask:0})
 cabinWalls(x,z).forEach(b=>solidVolume(b))
 banner(x,5.15,z-3.55,8.4,1.35,GENRE_NAMES[g].toUpperCase(),WORLD_TYPE.heading,c)
 banner(x,4.12,z-3.57,7.3,.6,theme.title,WORLD_TYPE.detail)
 emblem(x,5.9,z-3.15,1.25,g)
 for(const dx of [-3.85,3.85]) {
  box(x+dx,2.3,z-2.6,.10,4.45,.10,trim)
  const light=sphere(x+dx,4.6,z-2.6,.32,.4,.32,trim);lanterns.push(light)
 }
 // Detailed merged collections replace the old overlapping porch placeholders.
 const props=engine.addEntity();Transform.create(props,{position:Vector3.create(x,0,z),scale:Vector3.create(WALK.propsScaleX,1,1)})
 // Meshes stay non-colliding; bounded primitive volumes protect solid furniture.
 GltfContainer.create(props,{src:`assets/models/studio-props-${g}.glb`,visibleMeshesCollisionMask:0,invisibleMeshesCollisionMask:0})
 for(const b of STUDIO_OBSTACLES[g])solidVolume({...b,x:x+b.x*WALK.propsScaleX,z:z+b.z,sx:b.sx*WALK.propsScaleX},false)
 banner(x,1.85,z+3,6.9,.7,STUDIO_LIFE[g].motto,WORLD_TYPE.detail)
}

/** Only nearby original residents are instantiated. They cannot join, score or vote. */
export function refreshResidents(now:number,position:{x:number;z:number}|undefined,reduced:boolean,playing:boolean){
 if(now-residentCheck<RESIDENT_BUDGET.checkEveryMs)return;residentCheck=now
 const visible=nearbyStudios(position,[...residents.keys()])
 for(const [g,r] of residents)if(!visible.includes(g)){for(const e of r.entities)engine.removeEntity(e);residents.delete(g)}
 for(const g of visible){
  let r=residents.get(g)
  if(!r){
   const p=localStudio(g),life=STUDIO_LIFE[g],entities:Entity[]=[]
   for(let i=0;i<2;i++){
    const female=g==='kpop'&&i===0||g==='afrobeats'&&i===1
    const e=avatar(`affinity-resident-${g}-${i}`,p.x+(i?2:-2),p.z-.45,life.hair[i],life.jackets[i],female)
    const transform=Transform.getMutable(e);transform.parent=clubRoot;transform.rotation=Quaternion.fromEulerDegrees(0,i?210:150,0)
    const shape=AvatarShape.getMutable(e);shape.name=life.residents[i]+' · NPC';const skin=(GENRES.indexOf(g)+i)%3
    shape.skinColor=[{r:.35,g:.20,b:.14},{r:.64,g:.40,b:.28},{r:.84,g:.65,b:.52}][skin]
    entities.push(e)
   }
   r={entities,lastEmote:-Infinity,motion:false};residents.set(g,r)
  }
  // Stop a running emote when reduced motion is enabled, not only future triggers.
  if(reduced){if(r.motion)for(const e of r.entities){const a=AvatarShape.getMutable(e);a.expressionTriggerId='';a.expressionTriggerTimestamp=(a.expressionTriggerTimestamp??0)+1}r.motion=false;continue}
  if(now-r.lastEmote>=RESIDENT_BUDGET.emoteEveryMs){
   for(const e of r.entities){const a=AvatarShape.getMutable(e);a.expressionTriggerId=playing?STUDIO_LIFE[g].emote:'clap';a.expressionTriggerTimestamp=(a.expressionTriggerTimestamp??0)+1}
   r.motion=true;r.lastEmote=now
  }
 }
}
function festoon() {
 for(const z of [3,14,25]) {
  // One curved string per studio row, not a ceiling: keep the daylight open.
  for(let i=0;i<12;i++){
   const x=9.2+i*1.13,y=7.3-.58*Math.sin(i/11*Math.PI)
   const rope=box(x,y,z,1.15,.035,.035,villageColor(VILLAGE.boundary))
   Transform.getMutable(rope).rotation=Quaternion.fromEulerDegrees(0,0,-5*Math.cos(i/11*Math.PI))
   sphere(x,y-.17,z,.13,.20,.13,color(GENRES[i%6]))
  }
 }
}
export function buildClub(onStudio:(g:Genre)=>void=()=>{},onStage:()=>void=()=>{}) {
 const prior=new Set([...engine.getEntitiesWith(Transform)].map(([e])=>e))
 box(16,-.06,-2.6,31.8,.12,5.2,villageColor(VILLAGE.avenue),true)
 for(const x of [7,25])box(x,1.5,.15,14,3,.3,villageColor(VILLAGE.boundary),true)
 box(16,5,.15,4,1,.3,color('electronic'),true)
 // Essential reading is beside the entrance, never across the camera's walking lane.
 festivalClock=banner(11.5,2.2,-1,3.6,1.5,'CHOOSE STUDIO\n30s',WORLD_TYPE.action)
 solidVolume({name:'entrance clock stand',x:11.5,y:2.2,z:-1,sx:3.72,sy:1.62,sz:.13})
 box(11.5,.7,-1,.16,1.4,.16,color('electronic'),true)
 banner(16,4.4,-1,8,1,'ENTER THE FESTIVAL',WORLD_TYPE.heading,color('electronic'))
 box(16,-.06,24,31.8,.12,47.8,villageColor(VILLAGE.ground),true)
 box(16,.006,18,11.7,.012,35.5,villageColor(VILLAGE.avenue))
 for(const x of [.15,31.85])box(x,.65,24,.3,1.3,47.8,villageColor(VILLAGE.boundary),true)
 box(16,4.5,47.85,31.8,9,.3,villageColor(VILLAGE.boundary),true)
 for(const x of [10,22])box(x,.025,22,.12,.035,40,color('electronic'))
 festoon()
 const garden=engine.addEntity();Transform.create(garden)
 GltfContainer.create(garden,{src:'assets/models/festival-garden.glb',visibleMeshesCollisionMask:0,invisibleMeshesCollisionMask:0})
 for(const p of WALK.trees){
  solidVolume({name:'tree trunk',x:p.x,y:1.65,z:p.z,sx:.3,sy:3.3,sz:.3})
  solidVolume({name:'low planter',x:p.x,y:.11,z:p.z,sx:.9,sy:.22,sz:.9})
 }
 GENRES.forEach((g,i)=>{
  const p=WALK.posters[i],c=color(g),short=['K-POP','BRAZILIAN\nFUNK','LATIN','AFROBEATS','HIP-HOP','ELECTRONIC'][i]
  box(p.x,1.8,p.z,2.5,3.4,.16,c,true)
  box(p.x,1.85,p.z-.10,2.38,3.12,.06,ink)
  emblem(p.x,2.8,p.z-.15,1.05,g)
  sign(p.x,1.8,p.z-.16,short,WORLD_TYPE.detail,c)
  sign(p.x,.95,p.z-.16,'YOUR SOUND',2.8)
  box(p.x,.12,p.z,2.6,.24,.65,villageColor(VILLAGE.boundary),true)
 })
 banner(16,4.8,5.2,8.5,1.4,'AFFINITY ARENA',WORLD_TYPE.landmark,color('electronic'))
 banner(10.8,2,5.2,2.8,2.3,'1 CHOOSE\n2 TRAIN\n3 PERFORM',WORLD_TYPE.action)
 solidVolume({name:'festival directions stand',x:10.8,y:2,z:5.2,sx:2.92,sy:2.42,sz:.13})
 box(10.8,.4,5.2,.16,.8,.16,color('electronic'),true)
 GENRES.forEach((g,i)=>{
  const p=localStudio(g),c=color(g)
  cabin(g,p.x,p.z)
  musicSheet(p.x,2.8,p.z+3.05,'Play '+GENRE_NAMES[g]+' studio',c,()=>onStudio(g))
  emblem(p.x-3.45,4.65,p.z+2.88,.52,g)
  let instrument:Entity
  if(g==='afrobeats')instrument=drum(p.x,p.z+1.65,c)
  else if(g==='hiphop'){
   instrument=box(p.x,1.1,p.z+1.65,2.5,.2,.9,c)
   for(const dx of [-.65,.65])sphere(p.x+dx,1.22,p.z+1.65,.9,.035,.9,ink)
  }else instrument=keyboard(p.x,p.z+1.65,c)
  interact(instrument,'Play '+GENRE_NAMES[g]+' instrument',()=>onStudio(g))
  solidVolume({name:'studio instrument',x:p.x,y:.8,z:p.z+1.65,sx:g==='afrobeats'?.95:2.5,sy:1.6,sz:.95},false)
  const joinPanel=engine.addEntity()
  Transform.create(joinPanel,{position:Vector3.create(p.x,1.25,p.z-1.65),scale:Vector3.create(8.2,2.5,.14)})
  interact(joinPanel,'Join '+GENRE_NAMES[g]+' / tap anywhere',()=>onStudio(g))
  banner(p.x,3.2,p.z-2.65,5.7,1.08,'TAP TO JOIN',WORLD_TYPE.action,c)
 })
 box(16,.35,43,17,.7,8,villageColor(VILLAGE.stage),true);box(16,.72,43,16.7,.035,7.7,villageColor(VILLAGE.stage))
 // A single continuous slope replaces separated steps and the gap before the stage.
 const ramp=WALK.ramp,angle=Math.atan2(ramp.rise,ramp.depth)
 // At a fixed Z the rotated top face is centerY + .06/cos(angle).
 const slope=box(ramp.x,ramp.y-.06/Math.cos(angle),ramp.z,ramp.width,.12,Math.hypot(ramp.depth,ramp.rise),villageColor(VILLAGE.avenue),true)
 Transform.getMutable(slope).rotation=Quaternion.fromEulerDegrees(-angle*180/Math.PI,0,0)
 // Upper face meets the stage within 5mm; lower end meets the avenue.
 for(const z of [33,35,37])for(const side of [-1,1]){
  const e=box(16+side*.28,Math.max(0,rampSurface(z))+.07,z,.12,.055,.8,color('panel'))
  Transform.getMutable(e).rotation=Quaternion.fromEulerDegrees(0,side*45,0);arrows.push(e)
 }
 for(const x of [8,24]){box(x,4.8,46.7,.2,8,.2,white);speaker(x,.7,44,color(x===8?'kpop':'electronic'),1.2)}
 for(const x of [12,20]){const e=sphere(x,6.8,41,.28,.2,.28,white);LightSource.create(e,{active:false,color:{r:x===12?1:.25,g:.65,b:1},intensity:800,range:8,shadow:false,type:{$case:'point',point:{}}});stageLights.push(e)}
 box(16,7.8,46.7,16,.2,.2,white)
 board=banner(16,6.35,47,14.8,2.8,'THE MAIN STAGE\nLIVE SCORE x2',WORLD_TYPE.heading,color('electronic'))
 for(const [i,x] of [12,20].entries())musicSheet(x,2.95,45.9,'Ready for the live show / '+(i===0?'LEFT CREW':'RIGHT CREW'),color(i===0?'kpop':'electronic'),onStage)
 for(const [i,x] of [10.5,21.5].entries())musicSheet(x,1.35,38.9,'FLOOR MONITOR / '+(i===0?'LEFT CREW':'RIGHT CREW'),gold,onStage,true)
 gate=box(16,1.5,(VENUE.gateZ-8)/1.5,WALK.gateWidth,3,.2,gold,true)
 for(const x of [9.5,22.5])box(x,1.8,38.8,7,2,.18,color('panel'),true)
 for(const x of [7.5,24.5])box(x,1.8,43,.18,2,8,color('panel'),true)
 for(const x of [12,20]){box(x,1.5,41,.08,1.5,.08,white);const mic=sphere(x,2.3,41,.4,.5,.4,color('electronic'));interact(mic,'Ready for the live show',onStage)}
 stageGuide=banner(16,3.55,38.2,8,1.4,'FINALISTS ONLY\nTRAIN FIRST',WORLD_TYPE.action)
 for(let i=0;i<14;i++)bars.push(box(9.5+i,7.9,46.3,.36,.4,.1,color(GENRES[i%6])))
 // Eight native NPC avatars, never counted as real participants.
 const styles=[['hair_anime_01','f_red_elegant_jacket'],['cool_hair','puffer_jacket'],['hair_punk','black_jacket'],['curly_hair','sport_jacket'],['hair_oldie','sleeveless_punk_shirt'],['slicked_hair','black_jacket']]
 GENRES.forEach((g,i)=>{
  const x=i<3?11.2:20.8,z=33.5+(i%3)*1.55,id='affinity-fan-'+g
  const fan=avatar(id,x,z,styles[i][0],styles[i][1],i===0)
  Transform.getMutable(fan).rotation=Quaternion.fromEulerDegrees(0,x<16?35:-35,0);fans.push(fan)
  if(g==='electronic')headphones(id)
  // Genre badge on a physical audience rail.
  box(x,2.45,z+.05,.62,.62,.08,color(g));fanBadges.push(emblem(x,2.45,z,.52,g))
 })
 avatar('affinity-host',16,44.8,'hair_stylish_hair','black_jacket',false,.75)
 avatar('affinity-photographer',23.7,38,'shoulder_hair','sport_jacket')
 box(23.7,1.5,37.75,.45,.3,.2,ink);sphere(23.7,1.5,37.6,.2,.2,.13,white)
 flash=sphere(23.7,1.65,37.5,0,0,0,white)
 banner(16,3.15,32.2,5.4,.65,'NPC FAN ZONE',WORLD_TYPE.detail)
 cover=banner(3.7,2.85,37,5.5,4.8,'ENCORE\nWIN YOUR COVER\nILLUSTRATED EDITION',WORLD_TYPE.detail,gold)
 coverIcon=emblem(3.7,2.9,36.78,1.3,'kpop')
 rankBoard=banner(28,3,37,5.5,4.8,'GENRE CHAMPIONS\nHuman | Exhibition',WORLD_TYPE.detail,color('electronic'))
 for(const x of [3.7,28])solidVolume({name:'public noticeboard',x,y:2.85,z:37,sx:5.62,sy:4.92,sz:.13})
 trophy.push(box(16,.96,43,1.1,.4,1.1,gold),box(16,1.7,43,.18,1.2,.18,gold),sphere(16,2.35,43,1.1,.7,1.1,gold))
 for(const dx of [-.67,.67])trophy.push(sphere(16+dx,2.4,43,.48,.65,.2,gold))
 trophy.forEach(e=>Transform.getMutable(e).scale=Vector3.create(0,0,0))
 const nodes=[...engine.getEntitiesWith(Transform)].filter(([e])=>!prior.has(e))
 const root=engine.addEntity();clubRoot=root;Transform.create(root,{position:Vector3.create(0,0,8),scale:Vector3.create(1.5,1,1.5)})
 for(const [e] of nodes){const t=Transform.getMutable(e);if(!t.parent)t.parent=root}
}
function setText(e:Entity,value:string){if(TextShape.get(e).text!==value){
 const text=TextShape.getMutable(e);text.text=value
 const bounds=signBounds.get(e);if(bounds)Object.assign(text,worldSignLayout(value,bounds.w,bounds.h,bounds.size))
}}
export function refreshClub(s:Arena,now:number,reduced:boolean,id='',attempted=0,memories?:VisitMemories & {loaded?:boolean},position?:{x:number;z:number}) {
 const age=now-s.since,me=s.players.find(p=>p.id===id),stage=s.phase==='presentation'||s.phase==='battle'
 const finalists=s.finalists.map(g=>s.crews.find(c=>c.genre===g)!)
 const eligible=!!me&&!me.withdrawn&&s.finalists.includes(me.genre)&&['intermission','presentation','battle','result'].includes(s.phase)
 setText(stageGuide,eligible?me?.ready?'CHECKED IN\nREAD YOUR MONITOR':`STAGE OPEN / ${s.finalists.indexOf(me!.genre)===0?'LEFT':'RIGHT'}\nTAKE THE RAMP`:'FINALISTS ONLY\nTRAIN FIRST')
 // Local egress only: it grants no check-in/scoring authority. Hysteresis avoids closing on the avatar.
 if(position&&position.x>=11.25&&position.x<=36.75&&position.z>VENUE.gateZ+1)leavingStage=true
 if(position&&position.z<VENUE.gateZ-1.1)leavingStage=false
 const gy=eligible||leavingStage?-4:1.5;if(Transform.get(gate).position.y!==gy)Transform.getMutable(gate).position.y=gy
 setText(festivalClock,shortWorldPhase(s.phase)+'\n'+phaseSeconds(s,now)+'s')
 // Detailed attributes remain in the session HUD; the public board reads at a distance.
 const scores=finalists.map(c=>GENRE_NAMES[c.genre]+'  '+total(s.phase==='battle'||s.phase==='result'?c.final:c.training).toFixed(0)+' / 400').join('\n')
 const title=s.phase==='lobby'?'THE MAIN STAGE\nLIVE SCORE x2':s.phase==='training'?'TRAIN IN YOUR STUDIO\nTOP TWO CREWS QUALIFY':s.phase==='intermission'?'FINALISTS: TAKE THE RAMP\n'+scores:s.phase==='presentation'?'MEET THE FINALISTS\n'+scores:s.phase==='battle'?'LIVE FINAL / '+phaseSeconds(s,now)+'s / x2\n'+scores:s.winner==='draw'?'DRAW / BOTH CREWS SHINE\n'+scores:s.winner?GENRE_NAMES[s.winner].toUpperCase()+' WINS!\n'+scores:'SHOW CANCELLED\nNO WINNER'
 if(title!==lastBoard){setText(board,title);lastBoard=title}
 const phase=s.match+'/'+s.phase
 if(phase!==lastPhase){
  lastPhase=phase
  const lit=s.phase==='intermission'||stage
  arrows.forEach(e=>Material.setBasicMaterial(e,{diffuseColor:lit?gold:color('panel'),castShadows:false}))
  stageLights.forEach(e=>LightSource.getMutable(e).active=lit||s.phase==='result')
  const win=s.phase==='result'&&s.winner&&s.winner!=='draw'
  trophy.forEach((e,i)=>Transform.getMutable(e).scale=win?[Vector3.create(1.1,.4,1.1),Vector3.create(.18,1.2,.18),Vector3.create(1.1,.7,1.1),Vector3.create(.48,.65,.2),Vector3.create(.48,.65,.2)][i]:Vector3.create(0,0,0))
  if(win){const uv=crewUV(s.winner as Genre);MeshRenderer.setPlane(coverIcon,[...uv,...uv])}
  fanBadges.forEach((e,i)=>{const uv=crewUV(win?s.winner as Genre:GENRES[i]);MeshRenderer.setPlane(e,[...uv,...uv])})
 }
 const edition=s.phase==='result'&&s.winner&&s.winner!=='draw'?'ENCORE\n'+GENRE_NAMES[s.winner].toUpperCase()+'\n\n\n'+total(s.crews.find(c=>c.genre===s.winner)!.final).toFixed(1)+' / 400\n'+new Date(now).toISOString().slice(0,10)+' / '+(s.mode==='BOT_EXHIBITION'?'EXHIBITION':'HUMAN CREWS')+'\nILLUSTRATED KEEPSAKE — NOT A PHOTO':'ENCORE\nTHE NEXT COVER IS YOURS\n\n\nWIN A SHOW. MAKE THE COVER.\nILLUSTRATED VICTORY EDITION'
 if(edition!==lastCover){setText(cover,edition);lastCover=edition}
 if(memories){const ranks=memories.loaded===false?'PILOT SEASON\nLoading server standings...\nNo results confirmed yet.':'PILOT SEASON\nHuman wins | Exhibition wins\n'+memories.ranking().map(r=>GENRE_NAMES[r.genre]+'   '+r.human+' | '+r.exhibition).join('\n')+'\nSERVER-CONFIRMED RESULTS';if(ranks!==lastRank){setText(rankBoard,ranks);lastRank=ranks}}
 const activeIndex=me&&isPerformer(s,id)?(s.phase==='training'?GENRES.indexOf(me.genre):s.phase==='battle'?6+s.finalists.indexOf(me.genre):-1):-1
 const frame=Math.floor(now/50);if(frame===lastFrame)return;lastFrame=frame
 sheets.forEach((sh,n)=>{
  const audienceMember=n>=6&&n<8&&s.phase==='battle'?s.players.find(p=>p.genre===s.finalists[n-6]&&!p.withdrawn):undefined
  const displayId=n===activeIndex||n>=8?id:audienceMember?.id??id
  const active=n===activeIndex || (n>=8 && n-2===activeIndex) || !!audienceMember
  setText(sh.label,active?(audienceMember&&displayId!==id?'CONFIRMED NOTES':'C E G / HIT THE LINE'):n>=6&&finalists[(n-6)%2]?(s.phase==='intermission'?'TAKE YOUR CREW SIDE':stage?'LIVE SCORE x2':'YOUR CREW PANEL'):'TAP TO JOIN / 30s TRAIN')
  if(!active&&!sh.wasActive)return
  sh.wasActive=active
  for(let i=0;i<4;i++){
   const note=sheetNote(s,displayId,i,age,displayId===id?attempted:0,reduced),e=sh.notes[i],label=sh.letters[i]
   const t=Transform.getMutable(e);t.scale=active&&note.visible?Vector3.create(.45,.45,1):Vector3.create(0,0,0)
   t.position=Vector3.create(sh.x+note.x,sh.y+note.y,sh.z-.15)
   const mark=note.lane+'/'+note.state
   if(sh.marks[i]!==mark){
    const u=note.lane/3,uv=[u,0,u,1,u+1/3,1,u+1/3,0];MeshRenderer.setPlane(e,[...uv,...uv])
    const noteColor=note.state==='ink'?color('afrobeats'):note.state==='miss'?Color4.create(1,.3,.35,1):white
    Material.setBasicMaterial(e,{texture:Material.Texture.Common({src:'assets/images/note-symbols.png'}),diffuseColor:noteColor,castShadows:false});sh.marks[i]=mark
    TextShape.getMutable(label).textColor=noteColor
   }
   Transform.getMutable(label).position=Vector3.create(sh.x+note.x,sh.y+note.y-.3,sh.z-.17)
   setText(label,active&&note.visible?['C','E','G'][note.lane]:'')
  }
 })
 const celebration=s.phase==='result'&&!!s.winner
 const pulse=canopyPulse(now,s.phase==='training'||stage||celebration,reduced)
 lanterns.forEach(e=>{if(Math.abs(Transform.get(e).scale.y-.4*pulse)>.0001)Transform.getMutable(e).scale=Vector3.create(.32*pulse,.4*pulse,.32*pulse)})
 bars.forEach((e,i)=>{const height=!reduced&&(s.phase==='battle'||celebration)?.3+.4*(1+Math.sin(now/600+i)):.35;if(Math.abs(Transform.get(e).scale.y-height)>.001)Transform.getMutable(e).scale.y=height})
 const emote=phase+'/'+Math.floor(age/6000)
 if(!reduced&&(stage||celebration)&&emote!==lastEmote){lastEmote=emote;fans.forEach((e,i)=>{const a=AvatarShape.getMutable(e);a.expressionTriggerId=celebration?'clap':i%2?'dance':'robot';a.expressionTriggerTimestamp=(a.expressionTriggerTimestamp??0)+1})}
 const flashSize=!reduced&&celebration&&age>2500&&age<2750?.42:0
 if(Transform.get(flash).scale.x!==flashSize)Transform.getMutable(flash).scale=Vector3.create(flashSize,flashSize,flashSize*.35)
}
