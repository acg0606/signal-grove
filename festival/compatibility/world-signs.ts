/** TextShape uses fontSize 10 for a one-meter text height, unlike HUD pixels.
 * Bounds are a conservative layout estimate, not native font metrics.
 */
export const WORLD_TYPE = { landmark:9, heading:7, action:5, detail:3.5, note:2.8 } as const
export const WORLD_TEXT_X = 1/1.5
export function worldSignLayout(text:string,width:number,height:number,preferred:number){
 const lines=text.split('\n'),columns=Math.max(1,...lines.map(line=>line.length))
 const availableWidth=width*1.5-.24,availableHeight=height-.12
 const fontSize=Math.floor(Math.min(preferred,availableWidth/(columns*.065),availableHeight/(lines.length*.13))*100)/100
 return {fontSize,width:availableWidth,height:availableHeight,fontAutoSize:false,textWrapping:true}
}
export function shortWorldPhase(phase:string){
 return ({lobby:'CHOOSE STUDIO',training:'REHEARSAL',intermission:'GO TO STAGE',presentation:'SHOW INTRO',battle:'LIVE FINAL',result:'RESULTS'} as Record<string,string>)[phase]??'FESTIVAL'
}
