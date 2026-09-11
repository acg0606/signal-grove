import { readFile,writeFile } from 'node:fs/promises'
import { GENRES } from '../src/rules/concert'
// Geometry-derived broad-phase volumes; exact mesh physics is intentionally avoided.
async function main(){
const bounds:Record<string,unknown[]>={}
for(const g of GENRES){
 const data=await readFile(new URL('../assets/models/studio-props-'+g+'.glb',import.meta.url))
 const gltf=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)).toString())
 bounds[g]=gltf.extras.props.filter((p:any)=>p.min[1]<1.8).map((p:any)=>({
  name:p.name,x:(p.min[0]+p.max[0])/2,y:(p.min[1]+p.max[1])/2,z:(p.min[2]+p.max[2])/2,
  sx:p.max[0]-p.min[0],sy:p.max[1]-p.min[1],sz:p.max[2]-p.min[2]
 }))
}
await writeFile(new URL('../compatibility/studio-obstacles.ts',import.meta.url),'// Generated from studio-props GLB bounds by scripts/build-navigation.ts.\nexport const STUDIO_OBSTACLES = '+JSON.stringify(bounds,null,2)+' as const\n')
console.log('Generated simple collision volumes for '+Object.values(bounds).flat().length+' grounded collections.')
}
void main()
