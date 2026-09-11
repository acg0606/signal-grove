import { mkdir, writeFile } from 'node:fs/promises'
import { CABINS, VILLAGE } from '../compatibility/village-design'
import { buildCabin } from './village-geometry.mjs'
async function main(){
  const output=new URL('../assets/models/',import.meta.url)
  await mkdir(output,{recursive:true})
  for(const [genre,theme] of Object.entries(CABINS)){
    const result=buildCabin(theme,VILLAGE)
    await writeFile(new URL(`cabin-${genre}.glb`,output),result.bytes)
    console.log(`${genre}: ${result.triangles} triangles / ${result.bytes.length} bytes`)
  }
}
void main()
