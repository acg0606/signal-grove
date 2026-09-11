import { writeFile } from 'node:fs/promises'
import { WALK } from '../compatibility/festival-navigation'
import { buildStudioProps } from './studio-props.mjs'
async function main(){
 const r=buildStudioProps('garden',{shell:[.26,.65,.43],trim:[1,.80,.29],roof:[.48,.27,.15]},WALK)
 await writeFile(new URL('../assets/models/festival-garden.glb',import.meta.url),r.bytes)
 console.log('Garden: '+r.triangles+' triangles / '+r.bytes.length+' bytes / '+r.objects.length+' objects')
}
void main()
