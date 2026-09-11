// Original, deterministic glTF architecture. No downloaded model or image textures.
export function buildCabin(theme, config) {
  const materials = [theme.shell, theme.roof, theme.trim].map((rgb,i)=>({
    name:['painted acoustic shell','festival roof','edge piping'][i],
    pbrMetallicRoughness:{baseColorFactor:[...rgb,1],metallicFactor:i===2?.12:0,roughnessFactor:i===1?.72:.83},
    doubleSided:true, emissiveFactor:rgb.map(x=>x*.16)
  }))
  const groups = materials.map(()=>({p:[],n:[]}))
  function tri(a,b,c,m) {
    const u=b.map((v,i)=>v-a[i]),v=c.map((q,i)=>q-a[i])
    let n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
    const len=Math.hypot(...n);if(len<1e-8)return
    n=n.map(x=>x/len);groups[m].p.push(...a,...b,...c);groups[m].n.push(...n,...n,...n)
  }
  function quad(a,b,c,d,m){tri(a,b,c,m);tri(a,c,d,m)}
  const segments=48, rx=config.radiusX, rz=config.radiusZ, eave=config.eave
  // Rounded-square footprint keeps the existing wide music sheet inside the shell.
  const curve=v=>Math.sign(v)*Math.abs(v)**(2/config.footprintPower)
  const point=(a,r,y)=>[curve(Math.sin(a))*rx*r,y,-curve(Math.cos(a))*rz*r]
  // Wide, genuinely open porch; no invisible wall in the player's path.
  for(let i=0;i<segments;i++) {
    const a=i*2*Math.PI/segments,b=(i+1)*2*Math.PI/segments,mid=(a+b)/2
    if(mid<config.doorwayHalfAngle||mid>2*Math.PI-config.doorwayHalfAngle)continue
    quad(point(a,.96,.12),point(b,.96,.12),point(b,.96,eave),point(a,.96,eave),0)
    // Structural ribs and sill: geometry, not high-cost point lights.
    if(i%4===0)quad(point(a,.968,.12),point(a+.016,.968,.12),point(a+.016,.968,eave),point(a,.968,eave),2)
    for(const y of [.3,2.3,4.8])quad(point(a,.97,y),point(b,.97,y),point(b,.97,y+.075),point(a,.97,y+.075),2)
  }
  let profile
  if(theme.shape==='cone')profile=[[1.03,0],[.87,.34],[.58,1.08],[.29,1.79],[.015,2.45]]
  else if(theme.shape==='terrace')profile=[[1.02,0],[1.02,.12],[.84,.12],[.84,.68],[.63,.68],[.63,1.21],[.39,1.21],[.39,1.7],[.01,2.12]]
  else if(theme.shape==='vinyl')profile=[[1.02,0],[1.02,.22],[.83,.58],[.55,.77],[.21,.82],[.01,.82]]
  else profile=Array.from({length:9},(_,i)=>[Math.max(.005,Math.cos(i/8*Math.PI/2)),Math.sin(i/8*Math.PI/2)*(theme.shape==='igloo'?2.25:2.65)])
  for(let row=0;row<profile.length-1;row++)for(let i=0;i<segments;i++) {
    const a=i*2*Math.PI/segments,b=(i+1)*2*Math.PI/segments
    const [r0,y0]=profile[row],[r1,y1]=profile[row+1]
    const m=theme.shape==='igloo'&&((i+row*2)%8===0)?2:1
    quad(point(a,r0,eave+y0),point(a,r1,eave+y1),point(b,r1,eave+y1),point(b,r0,eave+y0),m)
    // Roof panel joins make the faceted shells and thatch-like cones readable.
    if(i%8===0)quad(point(a,r0+.004,eave+y0+.014),point(a,r1+.004,eave+y1+.014),point(a+.016,r1+.004,eave+y1+.014),point(a+.016,r0+.004,eave+y0+.014),2)
    if(theme.shape==='igloo'||theme.shape==='terrace')quad(point(a,r0+.003,eave+y0+.015),point(b,r0+.003,eave+y0+.015),point(b,r0+.003,eave+y0+.045),point(a,r0+.003,eave+y0+.045),2)
  }
  // Rounded raised deck, flush enough to step onto; physics uses the scene floor.
  for(let i=0;i<segments;i++){const a=i*2*Math.PI/segments,b=(i+1)*2*Math.PI/segments;tri([0,.08,0],point(a,1,.08),point(b,1,.08),0)}
  const chunks=[],bufferViews=[],accessors=[],primitives=[];let offset=0
  for(let m=0;m<groups.length;m++) {
    const group=groups[m],attributes={}
    for(const [semantic,values] of [['POSITION',group.p],['NORMAL',group.n]]) {
      const bytes=Buffer.from(new Float32Array(values).buffer),view=bufferViews.length
      bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes.length,target:34962});chunks.push(bytes);offset+=bytes.length
      const accessor={bufferView:view,componentType:5126,count:values.length/3,type:'VEC3'}
      if(semantic==='POSITION'){accessor.min=[0,1,2].map(k=>Math.min(...values.filter((_,i)=>i%3===k)));accessor.max=[0,1,2].map(k=>Math.max(...values.filter((_,i)=>i%3===k)))}
      attributes[semantic]=accessors.length;accessors.push(accessor)
    }
    primitives.push({attributes,material:m,mode:4})
  }
  const gltf={asset:{version:'2.0',generator:'Affinity Arena original music-village geometry v0.12'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0,name:theme.title}],meshes:[{primitives}],materials,buffers:[{byteLength:offset}],bufferViews,accessors}
  const json=Buffer.from(JSON.stringify(gltf)),pad=Buffer.alloc((4-json.length%4)%4,32),body=Buffer.concat(chunks)
  const header=Buffer.alloc(12);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(12+8+json.length+pad.length+8+body.length,8)
  const jh=Buffer.alloc(8);jh.writeUInt32LE(json.length+pad.length);jh.writeUInt32LE(0x4e4f534a,4)
  const bh=Buffer.alloc(8);bh.writeUInt32LE(body.length);bh.writeUInt32LE(0x004e4942,4)
  return {bytes:Buffer.concat([header,jh,json,pad,bh,body]),gltf,triangles:groups.reduce((n,g)=>n+g.p.length/9,0)}
}
