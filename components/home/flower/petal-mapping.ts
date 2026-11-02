export interface PetalPatch {
  from:number;to:number;
  fromRange:[number,number];toRange:[number,number];
}
/** Partition the circumference at both arrangements' petal boundaries.
 * Every petal contributes its entire width, and receives the same share as
 * its neighbors. Centering the sectors avoids a directional bias at the seam.
 */
export function petalCorrespondence(fromCount:number,toCount:number):PetalPatch[]{
  if(!Number.isInteger(fromCount)||!Number.isInteger(toCount)||fromCount<1||toCount<1)throw Error('Invalid petal count.');
  const boundaries=[0,1];
  for(const count of [fromCount,toCount])for(let i=0;i<count;i++)boundaries.push((i+.5)/count);
  const cuts=boundaries.sort((a,b)=>a-b).filter((v,i,a)=>!i||v-a[i-1]>1e-10);
  const result:PetalPatch[]=[];
  for(let i=1;i<cuts.length;i++){
    const lo=cuts[i-1],hi=cuts[i],mid=(lo+hi)/2;
    const segment=(count:number)=>{
      const unwrapped=Math.floor(mid*count+.5);
      const range:[number,number]=[lo,hi].map(v=>Math.max(0,Math.min(1,v*count+.5-unwrapped))) as [number,number];
      return {index:unwrapped%count,range};
    };
    const from=segment(fromCount),to=segment(toCount);
    result.push({from:from.index,to:to.index,fromRange:from.range,toRange:to.range});
  }
  // Zero radians cuts through the middle of a petal in both arrangements.
  // Rejoin those halves; the arbitrary circular seam must never split a petal.
  const first=result[0],last=result.at(-1)!;
  if(result.length>1&&first.from===last.from&&first.to===last.to){
    first.fromRange=[last.fromRange[0],first.fromRange[1]];
    first.toRange=[last.toRange[0],first.toRange[1]];
    result.pop();
  }
  return result;
}
