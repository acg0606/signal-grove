// Original native 3D props, merged by material. No downloads, raster textures or brand assets.
export function buildStudioProps(genre, theme, layout) {
  const colors=[theme.shell,theme.trim,[.035,.028,.07],[.97,.96,.92],[.28,.34,.4],theme.roof]
  const groups=colors.map(()=>({p:[],n:[]})), objects=[]
  function tri(a,b,c,m){const u=b.map((v,i)=>v-a[i]),v=c.map((w,i)=>w-a[i]);let n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];const l=Math.hypot(...n);if(l<1e-9)return;n=n.map(x=>x/l);groups[m].p.push(...a,...b,...c);groups[m].n.push(...n,...n,...n)}
  function quad(a,b,c,d,m){tri(a,b,c,m);tri(a,c,d,m)}
  function box(x,y,z,sx,sy,sz,m=0){const p=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(p=>[x+p[0]*sx/2,y+p[1]*sy/2,z+p[2]*sz/2]);for(const f of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]])quad(...f.map(i=>p[i]),m)}
  function tube(a,b,r,m=4,n=12){const delta=b.map((x,i)=>x-a[i]),len=Math.hypot(...delta),d=delta.map(x=>x/len);const aux=Math.abs(d[1])>.9?[1,0,0]:[0,1,0];const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];let u=cross(d,aux);u=u.map(x=>x/Math.hypot(...cross(d,aux)));const v=cross(d,u);const p=(c,i)=>c.map((x,k)=>x+r*(u[k]*Math.cos(i*2*Math.PI/n)+v[k]*Math.sin(i*2*Math.PI/n)));for(let i=0;i<n;i++){quad(p(a,i),p(a,i+1),p(b,i+1),p(b,i),m);tri(a,p(a,i+1),p(a,i),m);tri(b,p(b,i),p(b,i+1),m)}}
  function oval(x,y,z,rx,ry,rz,m=0){const p=(a,b)=>[x+rx*Math.cos(a)*Math.sin(b),y+ry*Math.cos(b),z+rz*Math.sin(a)*Math.sin(b)];for(let j=0;j<8;j++)for(let i=0;i<16;i++)quad(p(i*Math.PI/8,j*Math.PI/8),p((i+1)*Math.PI/8,j*Math.PI/8),p((i+1)*Math.PI/8,(j+1)*Math.PI/8),p(i*Math.PI/8,(j+1)*Math.PI/8),m)}
  function ring(x,y,z,r,thickness,m=1){for(let i=0;i<24;i++){const a=i*Math.PI/12,b=(i+1)*Math.PI/12;tube([x+r*Math.cos(a),y+r*Math.sin(a),z],[x+r*Math.cos(b),y+r*Math.sin(b),z],thickness,m,6)}}
  function disc(x,y,z,r,m=2){tube([x,y,z-.045],[x,y,z+.045],r,m,24)}
  function star(x,y,z,r,m=1){const points=Array.from({length:10},(_,i)=>{const a=i*Math.PI/5+Math.PI/2,s=i%2?.44:1;return [x+Math.cos(a)*r*s,y+Math.sin(a)*r*s,z]});for(let i=0;i<10;i++){tri([x,y,z-.07],points[(i+1)%10].map((v,k)=>k===2?v-.07:v),points[i].map((v,k)=>k===2?v-.07:v),m);tri([x,y,z+.07],points[i].map((v,k)=>k===2?v+.07:v),points[(i+1)%10].map((v,k)=>k===2?v+.07:v),m);quad(points[i].map((v,k)=>k===2?v-.07:v),points[i].map((v,k)=>k===2?v+.07:v),points[(i+1)%10].map((v,k)=>k===2?v+.07:v),points[(i+1)%10].map((v,k)=>k===2?v-.07:v),m)}}
  function prop(name,fn){const starts=groups.map(g=>g.p.length);fn();const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];groups.forEach((g,m)=>{for(let i=starts[m];i<g.p.length;i++){const k=i%3;min[k]=Math.min(min[k],g.p[i]);max[k]=Math.max(max[k],g.p[i])}});objects.push({name,min,max})}
  function bench(x,z){box(x,.52,z,1.55,.22,.72,5);box(x,.23,z,.9,.4,.5,4);box(x,.86,z+.29,1.55,.55,.14,0);for(const dx of [-.78,.78])box(x+dx,.76,z,.12,.5,.78,1)}
  function records(x,z){box(x,.4,z,1.25,.65,.5,4);for(let i=0;i<7;i++){box(x-.51+i*.17,.65,z,.10,.75,.48,i%3===0?1:5);box(x-.51+i*.17,.8,z-.247,.08,.25,.01,3)}}
  function sampler(x,z){box(x,1.05,z,1.5,.16,.8,2);for(const dx of [-.6,.6])box(x+dx,.56,z,.08,1,.08,4);for(let r=0;r<3;r++)for(let c=0;c<4;c++)box(x-.5+c*.33,1.15,z-.22+r*.2,.24,.025,.14,(r+c)%2?1:5);box(x,1.15,z+.3,1.2,.03,.10,3)}
  function drum(x,z,r,h){tube([x,.16,z],[x,h,z],r,5,16);tube([x,h,z],[x,h+.06,z],r*1.05,3,16);for(let i=0;i<8;i++){const a=i*Math.PI/4;tube([x+Math.cos(a)*r,.25,z+Math.sin(a)*r],[x+Math.cos(a)*r,h-.06,z+Math.sin(a)*r],.018,1,6)}}
  function mic(x,z){tube([x,.13,z],[x,1.65,z],.035);tube([x-.3,.12,z],[x+.3,.12,z],.03);oval(x,1.73,z,.10,.20,.10,4);ring(x,1.68,z-.22,.18,.015,2)}
  if(genre==='garden'){
    function leaf(x,y,z,rx,ry,rz,m){const p=(a,b)=>[x+rx*Math.cos(a)*Math.sin(b),y+ry*Math.cos(b),z+rz*Math.sin(a)*Math.sin(b)];for(let j=0;j<4;j++)for(let i=0;i<8;i++)quad(p(i*Math.PI/4,j*Math.PI/4),p((i+1)*Math.PI/4,j*Math.PI/4),p((i+1)*Math.PI/4,(j+1)*Math.PI/4),p(i*Math.PI/4,(j+1)*Math.PI/4),m)}
    layout.trees.forEach((p,i)=>prop('rhythm garden tree '+i,()=>{
      box(p.x,.11,p.z,.9,.22,.9,4);tube([p.x,.2,p.z],[p.x,3.3,p.z],.13,5,8)
      tube([p.x,2.1,p.z],[p.x+.38,3.2,p.z],.07,5,6)
      leaf(p.x,3.4,p.z,.78,1.05,.78,0);leaf(p.x-.35,3.0,p.z,.6,.65,.64,0);leaf(p.x+.4,3.15,p.z,.55,.72,.6,i%3===0?1:0)
    }))
    for(const [i,p] of [[6,16,22],[25,18,34],[12,17,44]].entries())prop('soft cloud sculpture '+i,()=>{
      leaf(p[0],p[1],p[2],2.1,.6,1,3);leaf(p[0]-1.6,p[1]-.15,p[2],1.25,.45,.85,3);leaf(p[0]+1.4,p[1]+.1,p[2],1.3,.65,.85,3)
    })
    prop('festival sunshine ornament',()=>{leaf(25,17,44,1.6,1.6,.5,1);for(let i=0;i<12;i++){const a=i*Math.PI/6;tube([25+1.9*Math.cos(a),17+1.9*Math.sin(a),44],[25+2.35*Math.cos(a),17+2.35*Math.sin(a),44],.07,1,6)}})
  }else if(genre==='kpop'){
    prop('starlight vanity',()=>{box(-3.7,1.1,1.25,1.5,.13,.75,3);for(const x of [-4.2,-3.2])box(x,.57,1.25,.07,1.03,.07,1);disc(-3.7,2.08,1.53,.55,4);ring(-3.7,2.08,1.47,.6,.045,1);for(let i=0;i<8;i++){const a=i*Math.PI/4;oval(-3.7+.6*Math.cos(a),2.08+.6*Math.sin(a),1.43,.065,.065,.065,3)}})
    prop('fan-light display',()=>{box(3.55,.7,1.6,1.4,.17,.8,0);for(let i=0;i<3;i++){const x=3.1+i*.42;box(x,1.04,1.5,.06,.6,.06,3);star(x,1.5,1.5,.27,i%2?5:1)}box(3.55,.35,1.6,.95,.6,.5,5)})
    prop('album shelves',()=>{for(let y=1.8;y<3;y+=.45){box(4.15,y,.25,.22,.09,1.25,1);for(let k=0;k<3;k++)box(4.06,y+.19,-.17+k*.39,.11,.32,.28,k%2?5:3)}})
    prop('ribbon bench',()=>bench(-3.55,-1.25))
  }else if(genre==='funk'){
    prop('double subwoofer stack',()=>{for(let j=0;j<2;j++){const y=.68+j*1.12;box(-3.8,y,1.35,1.4,1.05,.8,2);disc(-3.8,y,.91,.45,1);disc(-3.8,y,.85,.33,2);disc(-3.8,y,.79,.13,4)}box(-3.8,2.37,1.35,1.45,.12,.88,1)})
    prop('beat-pad console',()=>sampler(3.5,1.45))
    prop('portable boombox',()=>{box(-3.5,.52,-1.4,1.5,.78,.5,5);for(const dx of [-.48,.48]){disc(-3.5+dx,.52,-1.68,.25,2);disc(-3.5+dx,.52,-1.74,.12,3)}box(-3.5,.59,-1.68,.34,.3,.05,2);tube([-3.8,1.03,-1.4],[-3.2,1.03,-1.4],.04,4);for(const x of [-3.8,-3.2])tube([x,.8,-1.4],[x,1.03,-1.4],.04,4)})
    prop('frequency sculpture',()=>{for(let i=0;i<9;i++){const h=.35+.9*Math.abs(Math.sin(i*.9));box(4.24,.4+h/2,-1+i*.3,.1,h,.16,i%2?1:3)}})
  }else if(genre==='latin'){
    prop('timbales and cowbell',()=>{for(const dx of [-.36,.36]){tube([-3.5+dx,.15,1.25],[-3.5+dx,1.05,1.25],.03,4);tube([-3.5+dx,1,1.25],[-3.5+dx,1.42,1.25],.31,4,20);tube([-3.5+dx,1.42,1.25],[-3.5+dx,1.45,1.25],.32,3,20)}box(-3.5,1.59,1.25,.28,.14,.2,2);tube([-3.9,1.49,1.15],[-3.3,1.52,1.5],.015,1,6)})
    prop('nylon-string guitar',()=>{oval(3.6,.72,1.55,.42,.42,.12,0);oval(3.6,1.15,1.55,.32,.32,.10,0);box(3.6,1.75,1.55,.14,1.05,.10,5);box(3.6,2.31,1.55,.25,.3,.12,0);disc(3.6,1.1,1.42,.13,2);for(let i=0;i<6;i++)tube([3.55+i*.02,.58,1.405],[3.55+i*.02,2.37,1.48],.004,3,4);for(let i=0;i<5;i++)box(3.6,1.4+i*.16,1.486,.14,.012,.015,4)})
    prop('sunburst sculpture',()=>{ring(-3.9,2.6,2.15,.49,.05,1);for(let i=0;i<12;i++){const a=i*Math.PI/6;tube([-3.9+.61*Math.cos(a),2.6+.61*Math.sin(a),2.15],[-3.9+.80*Math.cos(a),2.6+.80*Math.sin(a),2.15],.025,1,6)}})
    prop('listening bench',()=>bench(-3.55,-1.25))
  }else if(genre==='afrobeats'){
    prop('percussion station',()=>{drum(-3.7,1.35,.34,1.2);drum(-3.15,1.65,.28,1.05);drum(-4.05,.72,.24,.78)})
    prop('pad sampler',()=>sampler(3.5,1.45))
    prop('interlocking groove rings',()=>{ring(-4.0,2.65,1.8,.47,.055,1);ring(-3.55,2.65,1.8,.47,.055,5);ring(-3.77,3.03,1.8,.47,.055,3)})
    prop('record shelf',()=>records(3.55,-1.25))
  }else if(genre==='hiphop'){
    prop('vinyl turntable booth',()=>{box(-3.6,1.05,1.25,1.65,.18,.9,5);box(-3.6,.52,1.25,1.4,1,.65,2);for(const dx of [-.47,.47]){tube([-3.6+dx,1.16,1.25],[-3.6+dx,1.18,1.25],.33,2,24);tube([-3.6+dx,1.18,1.25],[-3.6+dx,1.2,1.25],.10,1,16);tube([-3.3+dx,1.23,1.55],[-3.5+dx,1.23,1.3],.012,3,6)}for(let i=0;i<4;i++)box(-3.6,1.16,1+i*.16,.17,.04,.06,4)})
    prop('record crates',()=>{records(3.6,1.6);records(3.6,-1.2)})
    prop('microphone and pop filter',()=>mic(3.2,.2))
    prop('cassette sculpture',()=>{box(-3.85,2.65,1.9,1.45,.78,.17,0);for(const dx of [-.38,.38]){disc(-3.85+dx,2.7,1.79,.18,2);disc(-3.85+dx,2.7,1.73,.08,3)}box(-3.85,2.37,1.8,.8,.14,.06,4)})
  }else if(genre==='electronic'){
    prop('modular synthesizer',()=>{box(-3.7,1.75,1.65,1.55,1.6,.35,2);for(let i=0;i<4;i++)box(-4.27+i*.38,1.75,1.44,.32,1.47,.03,4);for(let r=0;r<4;r++)for(let c=0;c<4;c++)disc(-4.27+c*.38,1.23+r*.32,1.38,.05,(r+c)%2?1:3);box(-3.7,.88,1.4,1.65,.17,.8,5);for(let i=0;i<14;i++)box(-4.42+i*.11,.99,1.3,.095,.04,.4,i%3===0?2:3)})
    prop('patch-cable rack',()=>{for(let j=0;j<3;j++){const a=[-4.2+j*.32,2.2,1.30],b=[-3.5+j*.28,1.3,1.30],mid=[(a[0]+b[0])/2,1.15+j*.13,1.15];tube(a,mid,.018,j%2?1:5,6);tube(mid,b,.018,j%2?1:5,6)}})
    prop('orbital sequencer',()=>{ring(3.6,2.1,1.6,.7,.04,1);for(let i=0;i<8;i++){const a=i*Math.PI/4;oval(3.6+.7*Math.cos(a),2.1+.7*Math.sin(a),1.6,.08,.08,.08,i%2?3:5)}box(3.6,.57,1.6,.12,1,.12,4);box(3.6,.12,1.6,.8,.12,.8,5)})
    prop('prism plinths',()=>{for(let i=0;i<3;i++){const x=3.2+i*.4,h=.45+i*.22;box(x,h/2+.1,-1.3,.3,h,.5,i%2?1:0);star(x,h+.32,-1.3,.19,3)}})
  }
  // One mesh and six material groups per studio, independent of prop count.
  const chunks=[],bufferViews=[],accessors=[],primitives=[];let offset=0
  for(let m=0;m<groups.length;m++){
    if(!groups[m].p.length)continue
    const attributes={}
    for(const [semantic,values] of [['POSITION',groups[m].p],['NORMAL',groups[m].n]]){
      const bytes=Buffer.from(new Float32Array(values).buffer),view=bufferViews.length
      bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes.length,target:34962});chunks.push(bytes);offset+=bytes.length
      const a={bufferView:view,componentType:5126,count:values.length/3,type:'VEC3'}
      if(semantic==='POSITION'){a.min=[Infinity,Infinity,Infinity];a.max=[-Infinity,-Infinity,-Infinity];values.forEach((v,i)=>{a.min[i%3]=Math.min(a.min[i%3],v);a.max[i%3]=Math.max(a.max[i%3],v)})}
      attributes[semantic]=accessors.length;accessors.push(a)
    }
    primitives.push({attributes,material:m,mode:4})
  }
  const gltf={asset:{version:'2.0',generator:'Affinity Arena original Studio Life v0.13'},scene:0,scenes:[{nodes:[0]}],nodes:[{name:`${genre} original studio collection`,mesh:0}],meshes:[{primitives}],materials:colors.map((rgb,i)=>({name:['paint','accent','ink','ivory','metal','roof'][i],pbrMetallicRoughness:{baseColorFactor:[...rgb,1],roughnessFactor:i===4?.35:.76,metallicFactor:i===4?.65:.06},emissiveFactor:rgb.map(v=>v*(i===1?.12:.03)),doubleSided:true})),buffers:[{byteLength:offset}],bufferViews,accessors,extras:{original:true,genre,props:objects}}
  const json=Buffer.from(JSON.stringify(gltf)),pad=Buffer.alloc((4-json.length%4)%4,32),body=Buffer.concat(chunks)
  const header=Buffer.alloc(12);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+pad.length+body.length,8)
  const jh=Buffer.alloc(8);jh.writeUInt32LE(json.length+pad.length);jh.writeUInt32LE(0x4e4f534a,4)
  const bh=Buffer.alloc(8);bh.writeUInt32LE(body.length);bh.writeUInt32LE(0x004e4942,4)
  return {bytes:Buffer.concat([header,jh,json,pad,bh,body]),gltf,triangles:groups.reduce((sum,g)=>sum+g.p.length/9,0),objects}
}
