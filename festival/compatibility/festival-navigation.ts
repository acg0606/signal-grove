import { VILLAGE } from './village-design'
/** Authoring units: world X/Z = 1.5x and world Z origin = 8. */
export const WALK = { avatarRadius:.30, headroom:2.2, propsScaleX:.94, wallThickness:.12,
  ramp:{x:16,z:36.8,y:.36,width:6,depth:4.6,rise:.72}, gateWidth:6,
  trees:[{x:5,z:.9},{x:27,z:.9},{x:5,z:12.5},{x:27,z:12.5},{x:5,z:23.5},{x:27,z:23.5},{x:3,z:33},{x:29,z:33}],
  posters:[{x:11.5,z:4},{x:11.5,z:15},{x:11.5,z:26},{x:20.5,z:4},{x:20.5,z:15},{x:20.5,z:26}]
} as const
/** Upper face of the rotated 12cm ramp in authoring units, before X/Z expansion. */
export function rampSurface(z:number){
 const r=WALK.ramp,angle=Math.atan2(r.rise,r.depth)
 return r.y+(z-r.z)*Math.tan(angle)
}
export type Solid = {x:number;y:number;z:number;sx:number;sy:number;sz:number;yaw?:number;name:string}
/** Thick primitives match the rounded-square shell and leave its actual porch open. */
export function cabinWalls(x:number,z:number):Solid[]{
 const result:Solid[]=[],n=24,curve=(v:number)=>Math.sign(v)*Math.abs(v)**(2/VILLAGE.footprintPower)
 const p=(a:number)=>({x:x+curve(Math.sin(a))*VILLAGE.radiusX*.96,z:z-curve(Math.cos(a))*VILLAGE.radiusZ*.96})
 for(let i=0;i<n;i++){
  const a=i*2*Math.PI/n,b=(i+1)*2*Math.PI/n,mid=(a+b)/2
  if(mid<VILLAGE.doorwayHalfAngle||mid>2*Math.PI-VILLAGE.doorwayHalfAngle)continue
  const u=p(a),v=p(b),dx=v.x-u.x,dz=v.z-u.z
  result.push({name:'cabin wall',x:(u.x+v.x)/2,y:VILLAGE.eave/2,z:(u.z+v.z)/2,sx:Math.hypot(dx,dz)+.08,sy:VILLAGE.eave,sz:WALK.wallThickness,yaw:-Math.atan2(dz,dx)*180/Math.PI})
 }
 return result
}
/** Conservative 2D clearance model for regression tests; not a native physics simulation. */
export function overlapsAvatar(b:Solid,x:number,z:number,r=WALK.avatarRadius){
 const a=(b.yaw??0)*Math.PI/180,dx=x-b.x,dz=z-b.z
 const lx=dx*Math.cos(a)-dz*Math.sin(a),lz=dx*Math.sin(a)+dz*Math.cos(a)
 const qx=Math.max(0,Math.abs(lx)-b.sx/2),qz=Math.max(0,Math.abs(lz)-b.sz/2)
 return qx*qx+qz*qz<r*r
}
