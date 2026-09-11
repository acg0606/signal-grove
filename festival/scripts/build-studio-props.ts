import { mkdir, writeFile } from 'node:fs/promises'
import { CABINS } from '../compatibility/village-design'
import { buildStudioProps } from './studio-props.mjs'
async function main(){
  const out=new URL('../assets/models/',import.meta.url);await mkdir(out,{recursive:true})
  for(const [genre,theme] of Object.entries(CABINS)){
    const r=buildStudioProps(genre,theme);await writeFile(new URL(`studio-props-${genre}.glb`,out),r.bytes)
    console.log(`${genre}: ${r.objects.length} collections / ${r.triangles} triangles / ${r.bytes.length} bytes`)
  }
}
void main()
