export type Point = { x: number; y: number; hx?: number; hy?: number; ix?: number; iy?: number };
export type Band = { id: string; name: string; points: Point[]; colors: string[]; width: number; glow: number; opacity: number; speed: number; amplitude: number; style: 'Silk' | 'Radiant' | 'Neon'; visible: boolean };
export type BackgroundGradient = { enabled: boolean; type: 'linear' | 'radial'; colors: string[]; angle: number };
export type Scene = { bands: Band[]; background: string; backgroundGradient?: BackgroundGradient; title: string };
export const defaultBackgroundGradient = (): BackgroundGradient => ({ enabled: true, type: 'linear', colors: ['#fce1dd', '#ddd8f1', '#d0edf0'], angle: 135 });
export const W = 1200, H = 800;
export const BAND_LIMIT = 12;
export const uid = () => Math.random().toString(36).slice(2, 10);
export const makeBand = (points: Point[], options: Partial<Band> = {}): Band => ({ id: uid(), name: 'Untitled band', points, colors: ['#ff91a8', '#c1a5f5', '#8bd9ed'], width: 150, glow: 18, opacity: 88, speed: 0.7, amplitude: 20, style: 'Silk', visible: true, ...options });
const p = (x: number, y: number): Point => ({ x, y });
export const presets = ['Daydream', 'Afterglow', 'Electric', 'Tidal', 'Solar', 'Blank canvas'];
export function preset(index: number): Scene {
  const base = [
    makeBand([p(-150, 230), p(220, 450), p(590, 370), p(960, 220), p(1350, 300)], { name: 'Peach current', colors: ['#f7bb93', '#ff798b', '#e8b3f5'], width: 205, glow: 23, amplitude: 16 }),
    makeBand([p(-150, 480), p(260, 555), p(630, 390), p(960, 390), p(1350, 270)], { name: 'Rose ribbon', colors: ['#ffbca5', '#f774af', '#cfb2ef'], width: 170, glow: 12, amplitude: 25 }),
    makeBand([p(-150, 310), p(240, 430), p(600, 470), p(950, 580), p(1350, 420)], { name: 'Blue hour', colors: ['#b8e2dd', '#c1d2ef', '#77d7ec'], width: 140, glow: 15, opacity: 72, amplitude: 19 }),
  ];
  base.forEach((band, i) => { band.id = `preset-band-${i}`; });
  if (index === 5) return { bands: [], background: '#f8f7f4', title: 'Untitled study' };
  const palettes = [[], ['#ff956b', '#f169a2', '#7959d8'], ['#9a59ff', '#ff63cb', '#5cf4ff'], ['#66bfc5', '#9ce7d3', '#789cea'], ['#ffbc41', '#ff795c', '#f5bf92']];
  if (index) base.forEach((b, i) => { b.colors = palettes[index].map((_, j) => palettes[index][(i + j) % 3]); b.style = index === 2 ? 'Neon' : index === 4 ? 'Radiant' : 'Silk'; b.glow = index === 2 ? 50 : 25; });
  return { bands: base, background: index === 2 ? '#10121d' : index === 1 ? '#251b33' : '#f8f7f4', title: presets[index] + ' study' };
}
export function samplePath(points: Point[], time = 0, amplitude = 0, speed = 0): Point[] {
  if (points.length < 2) return points;
  const result: Point[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1], prev = points[Math.max(0, i - 1)], next = points[Math.min(points.length - 1, i + 2)];
    const c1 = { x: a.x + (a.hx ?? (b.x - prev.x) / 6), y: a.y + (a.hy ?? (b.y - prev.y) / 6) };
    const c2 = { x: b.x + (b.ix ?? -(b.hx ?? (next.x - a.x) / 6)), y: b.y + (b.iy ?? -(b.hy ?? (next.y - a.y) / 6)) };
    const steps = Math.max(4, Math.min(200, Math.ceil(1800 / points.length), Math.ceil((Math.hypot(c1.x-a.x,c1.y-a.y)+Math.hypot(c2.x-c1.x,c2.y-c1.y)+Math.hypot(b.x-c2.x,b.y-c2.y))/5)));
    for (let j = 0; j <= steps; j++) {
      if (i && j === 0) continue;
      const t = j / steps, u = 1 - t;
      const x = u*u*u*a.x + 3*u*u*t*c1.x + 3*u*t*t*c2.x + t*t*t*b.x;
      let y = u*u*u*a.y + 3*u*u*t*c1.y + 3*u*t*t*c2.y + t*t*t*b.y;
      y += amplitude * Math.sin(x / 230 + time * speed) * Math.sin(time * speed * 0.45);
      result.push({ x, y });
    }
  }
  return result;
}
function rgb(hex: string) { return [1, 3, 5].map(n => parseInt(hex.slice(n, n+2), 16)); }
function colorAt(colors: string[], t: number) {
  const v = Math.max(0, Math.min(.9999, t)) * (colors.length - 1), i = Math.floor(v), f = v - i;
  const a = rgb(colors[i]), b = rgb(colors[Math.min(i+1, colors.length-1)]);
  return a.map((n,j) => Math.round(n + (b[j]-n)*f));
}
/** Uses CSS angles: 0° points up, 90° right, 180° down. */
export function backgroundEndpoints(angle: number) {
  const radians=angle*Math.PI/180,dx=Math.sin(radians),dy=-Math.cos(radians);
  const extent=(Math.abs(W*dx)+Math.abs(H*dy))/2;
  return [W/2-dx*extent,H/2-dy*extent,W/2+dx*extent,H/2+dy*extent] as const;
}
export function paintBackground(ctx:CanvasRenderingContext2D,scene:Scene){
  const setting=scene.backgroundGradient;
  if(setting?.enabled){
    const gradient=setting.type==='radial'
      ?ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,Math.hypot(W/2,H/2))
      :ctx.createLinearGradient(...backgroundEndpoints(setting.angle));
    setting.colors.forEach((color,i)=>gradient.addColorStop(i/(setting.colors.length-1),color));
    ctx.fillStyle=gradient;
  }else ctx.fillStyle=scene.background;
  ctx.fillRect(0,0,W,H);
}
function validBackgroundGradient(value:unknown):boolean{
  if(value===undefined)return true;
  if(!value||typeof value!=='object')return false;
  const g=value as BackgroundGradient;
  return typeof g.enabled==='boolean'&&['linear','radial'].includes(g.type)&&Number.isFinite(g.angle)&&g.angle>=0&&g.angle<=360&&Array.isArray(g.colors)&&g.colors.length>=2&&g.colors.length<=5&&g.colors.every(c=>typeof c==='string'&&/^#[0-9a-f]{6}$/i.test(c));
}
export function renderScene(ctx: CanvasRenderingContext2D, scene: Scene, time: number, width = W, height = H, underlay?: HTMLCanvasElement) {
  ctx.clearRect(0, 0, width, height); ctx.save(); ctx.scale(width/W,height/H);
  if (underlay) ctx.drawImage(underlay, 0, 0, W, H);
  else paintBackground(ctx,scene);
  for (const band of scene.bands) {
    if (!band.visible || band.points.length < 2) continue;
    const pts = samplePath(band.points, time, band.amplitude, band.speed);
    const edge = ribbonGeometry(band,time);
    const ridge=ridgePosition(band.style);
    ctx.save(); ctx.globalAlpha=band.opacity/100;
    if (band.glow > 0) {
      ctx.save(); ctx.filter=`blur(${band.glow * .65}px)`;
      ctx.globalAlpha *= band.style === 'Neon' ? .8 : .3;
      ctx.strokeStyle=band.colors[1] || band.colors[0]; ctx.lineWidth=band.width * .4; ctx.lineCap='round';
      ctx.beginPath(); pts.forEach((q,i)=> i ? ctx.lineTo(q.x,q.y) : ctx.moveTo(q.x,q.y)); ctx.stroke(); ctx.restore();
    }
    // Paint continuous strips along the whole curve, avoiding seams across its length.
    const profiles = band.style === 'Silk'
      ? [[0,0,0],[.12,.25,.3],[.42,.65,.15],[.72,.85,0],[.94,.7,.45],[.985,.95,.92],[1,.18,0]]
      : band.style === 'Radiant'
      ? [[0,0,0],[.22,.35,0],[.5,.95,.65],[.7,.7,0],[1,0,0]]
      : [[0,0,0],[.35,.25,0],[.48,1,.4],[.5,1,.98],[.53,1,.4],[.7,.2,0],[1,0,0]];
    const first=pts[0], last=pts[pts.length-1];
    const dx=last.x-first.x,dy=last.y-first.y;
    const gradientEnd=Math.hypot(dx,dy)>1?last:{x:first.x+W,y:first.y};
    const strips = Math.max(80, Math.ceil(band.width / 1.5));
    for(let strip=0;strip<strips;strip++) {
      const t=(strip+.5)/strips;
      let k=0;while(k<profiles.length-2 && profiles[k+1][0]<t)k++;
      const a=profiles[k],b=profiles[k+1],f=(t-a[0])/(b[0]-a[0]);
      const alpha=a[1]+(b[1]-a[1])*f,white=a[2]+(b[2]-a[2])*f;
      const g=ctx.createLinearGradient(first.x,first.y,gradientEnd.x,gradientEnd.y);
      for(let c=0;c<=8;c++) {
        const progress=c/8;
        const rgb=colorAt(band.colors,progress+.18*Math.sin(time*band.speed*.5+progress*3));
        g.addColorStop(progress,`rgba(${rgb.map(n=>Math.round(n+(255-n)*white)).join(',')},${alpha})`);
      }
      ctx.fillStyle=g;ctx.beginPath();
      const lo=strip/strips-ridge,hi=(strip+1.12)/strips-ridge;
      edge.forEach((q,i)=>{const x=q.x+q.nx*q.width*lo,y=q.y+q.ny*q.width*lo;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});
      for(let i=edge.length-1;i>=0;i--){const q=edge[i];ctx.lineTo(q.x+q.nx*q.width*hi,q.y+q.ny*q.width*hi);}
      ctx.closePath();ctx.fill();
    }
    // The editing path is the luminous ridge, including on asymmetric silk bands.
    ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
    ctx.strokeStyle=band.style==='Radiant'?'rgba(255,255,255,.35)':'rgba(255,255,255,.85)';
    ctx.lineWidth=band.style==='Neon'?1.8:1.2;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}
export function simplify(points: Point[], distance = 45): Point[] {
  const result=[points[0]];
  for(let i=1;i<points.length-1;i++) if(Math.hypot(points[i].x-result[result.length-1].x,points[i].y-result[result.length-1].y)>=Math.max(distance,1)) result.push(points[i]);
  if(points.length>1 && Math.hypot(points.at(-1)!.x-result.at(-1)!.x,points.at(-1)!.y-result.at(-1)!.y)>1) result.push(points[points.length-1]);
  return result;
}
/** Equal-distance sampling makes smoothing independent of pointer event density. */
function resampleStroke(points: Point[], spacing: number, maxPoints: number): Point[] {
  if(points.length<2)return points.map(({x,y})=>({x,y}));
  const distances=[0];
  for(let i=1;i<points.length;i++)distances.push(distances[i-1]+Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y));
  const total=distances.at(-1)!;
  if(total<.001)return [{x:points[0].x,y:points[0].y}];
  const count=Math.max(2,Math.min(maxPoints,Math.ceil(total/spacing)+1));
  const result:Point[]=[];let segment=1;
  for(let i=0;i<count;i++){
    const distance=total*i/(count-1);
    while(segment<points.length-1&&distances[segment]<distance)segment++;
    const a=points[segment-1],b=points[segment];
    const t=(distance-distances[segment-1])/(distances[segment]-distances[segment-1]||1);
    result.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
  }
  result[0]={x:points[0].x,y:points[0].y};
  result[result.length-1]={x:points.at(-1)!.x,y:points.at(-1)!.y};
  return result;
}

/** Remove hand jitter, retain broad wave shapes, and keep both endpoints fixed. */
export function smoothStroke(points: Point[], maxAnchors=64): Point[] {
  const clean:Point[]=[];
  for(const {x,y} of points){
    const last=clean.at(-1);
    if(!last||Math.hypot(x-last.x,y-last.y)>.001)clean.push({x,y});
  }
  if(clean.length<=2)return clean;
  const uniform=resampleStroke(clean,6,1600);
  let length=0;for(let i=1;i<uniform.length;i++)length+=Math.hypot(uniform[i].x-uniform[i-1].x,uniform[i].y-uniform[i-1].y);
  const step=length/(uniform.length-1)||1;
  const sigma=16/step, radius=Math.min(uniform.length-1,Math.ceil(sigma*3));
  // Reflect around the endpoints so smoothing does not pull them inward.
  const at=(index:number):Point=>{
    if(index<0){const p=uniform[-index],a=uniform[0];return {x:2*a.x-p.x,y:2*a.y-p.y};}
    if(index>=uniform.length){const p=uniform[2*(uniform.length-1)-index],a=uniform.at(-1)!;return {x:2*a.x-p.x,y:2*a.y-p.y};}
    return uniform[index];
  };
  const weights=Array.from({length:2*radius+1},(_,j)=>Math.exp(-.5*((j-radius)/sigma)**2));
  const total=weights.reduce((a,b)=>a+b,0);
  const filtered=uniform.map((p,i)=>{
    if(i===0||i===uniform.length-1)return {...p};
    let x=0,y=0;
    for(let j=-radius;j<=radius;j++){const q=at(i+j),weight=weights[j+radius];x+=q.x*weight;y+=q.y*weight;}
    return {x:x/total,y:y/total};
  });
  // Fit curvature rather than retaining an anchor every few pixels.
  let tolerance=4,anchors=fitStroke(filtered,tolerance);
  while(anchors.length>Math.max(2,maxAnchors)&&tolerance<64){tolerance*=1.5;anchors=fitStroke(filtered,tolerance);}
  return anchors;
}

/** Fit a small number of cubic segments within a canvas-pixel error tolerance. */
export function fitStroke(points: Point[], tolerance=4): Point[] {
  if(points.length<2)return points.map(p=>({...p}));
  const sub=(a:Point,b:Point)=>({x:a.x-b.x,y:a.y-b.y});
  const unit=(p:Point)=>{const d=Math.hypot(p.x,p.y)||1;return{x:p.x/d,y:p.y/d};};
  const dot=(a:Point,b:Point)=>a.x*b.x+a.y*b.y;
  type Curve=[Point,Point,Point,Point];
  const evaluate=(c:Curve,t:number)=>{const u=1-t;return{x:c[0].x*u*u*u+3*c[1].x*u*u*t+3*c[2].x*u*t*t+c[3].x*t*t*t,y:c[0].y*u*u*u+3*c[1].y*u*u*t+3*c[2].y*u*t*t+c[3].y*t*t*t};};
  const curves:Curve[]=[];
  function fit(data:Point[],left:Point,right:Point,depth:number){
    const first=data[0],last=data.at(-1)!;
    let ts=[0];for(let i=1;i<data.length;i++)ts.push(ts[i-1]+Math.hypot(data[i].x-data[i-1].x,data[i].y-data[i-1].y));
    const length=ts.at(-1)!||1;ts=ts.map(t=>t/length);
    let curve:Curve=[first,first,last,last],split=Math.floor(data.length/2);
    for(let iteration=0;iteration<5;iteration++){
      let c00=0,c01=0,c11=0,x0=0,x1=0;
      data.forEach((p,i)=>{
        const t=ts[i],u=1-t,b0=u*u*u,b1=3*t*u*u,b2=3*t*t*u,b3=t*t*t;
        const a={x:left.x*b1,y:left.y*b1},b={x:right.x*b2,y:right.y*b2};
        const residual={x:p.x-first.x*(b0+b1)-last.x*(b2+b3),y:p.y-first.y*(b0+b1)-last.y*(b2+b3)};
        c00+=dot(a,a);c01+=dot(a,b);c11+=dot(b,b);x0+=dot(a,residual);x1+=dot(b,residual);
      });
      const det=c00*c11-c01*c01;
      let al=det>1e-10?(x0*c11-x1*c01)/det:0,ar=det>1e-10?(c00*x1-c01*x0)/det:0;
      if(al<length*.001||ar<length*.001||al>length||ar>length){al=ar=Math.hypot(last.x-first.x,last.y-first.y)/3;}
      curve=[first,{x:first.x+left.x*al,y:first.y+left.y*al},{x:last.x+right.x*ar,y:last.y+right.y*ar},last];
      let error=0;
      for(let i=1;i<data.length-1;i++){const q=evaluate(curve,ts[i]),distance=(q.x-data[i].x)**2+(q.y-data[i].y)**2;if(distance>error){error=distance;split=i;}}
      if(error<=tolerance*tolerance||data.length===2||depth>=12){curves.push(curve);return;}
      // Refine chord-length parameters before adding another anchor.
      const next=ts.map((t,i)=>{
        if(i===0||i===data.length-1)return t;
        const u=1-t,q=evaluate(curve,t),r=sub(q,data[i]);
        const d={x:3*u*u*(curve[1].x-first.x)+6*u*t*(curve[2].x-curve[1].x)+3*t*t*(last.x-curve[2].x),y:3*u*u*(curve[1].y-first.y)+6*u*t*(curve[2].y-curve[1].y)+3*t*t*(last.y-curve[2].y)};
        const dd={x:6*u*(curve[2].x-2*curve[1].x+first.x)+6*t*(last.x-2*curve[2].x+curve[1].x),y:6*u*(curve[2].y-2*curve[1].y+first.y)+6*t*(last.y-2*curve[2].y+curve[1].y)};
        const denom=dot(d,d)+dot(r,dd);return Math.max(0,Math.min(1,t-(denom?dot(r,d)/denom:0)));
      });
      if(next.some((t,i)=>i>0&&t<=next[i-1]))break;
      ts=next;
    }
    const tangent=unit(sub(data[split-1],data[split+1]));
    fit(data.slice(0,split+1),left,tangent,depth+1);
    fit(data.slice(split),{x:-tangent.x,y:-tangent.y},right,depth+1);
  }
  fit(points,unit(sub(points[1],points[0])),unit(sub(points.at(-2)!,points.at(-1)!)),0);
  const anchors:Point[]=[{x:points[0].x,y:points[0].y}];
  curves.forEach(c=>{
    const start=anchors.at(-1)!;start.hx=c[1].x-c[0].x;start.hy=c[1].y-c[0].y;
    anchors.push({x:c[3].x,y:c[3].y,ix:c[2].x-c[3].x,iy:c[2].y-c[3].y});
  });
  return anchors;
}

export function translatePoints(points:Point[],dx:number,dy:number):Point[]{
  return points.map(p=>({...p,x:p.x+dx,y:p.y+dy}));
}
export const ridgePosition=(style:Band['style'])=>style==='Silk'?.985:.5;
export function ribbonGeometry(band:Band,time=0){
  const pts=samplePath(band.points,time,band.amplitude,band.speed),ridge=ridgePosition(band.style);
  const edges=pts.map((p,i)=>{
    const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)];
    const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;
    const before={x:p.x-a.x,y:p.y-a.y},after={x:b.x-p.x,y:b.y-p.y};
    const angle=Math.atan2(before.x*after.y-before.y*after.x,before.x*after.x+before.y*after.y);
    const distance=(Math.hypot(before.x,before.y)+Math.hypot(after.x,after.y))/2;
    const radius=Math.abs(angle)>.0001?distance/Math.abs(angle):Infinity;
    const inward=angle>0?1-ridge:ridge;
    const width=Math.min(band.width*(.6+.4*Math.sin(Math.PI*i/(pts.length-1))),radius*.75/Math.max(.01,inward));
    return {...p,nx:-dy/len,ny:dx/len,width};
  });
  // Ease narrowing into tight turns so the offset ribbon cannot fold over itself.
  for(let pass=0;pass<2;pass++)for(let j=1;j<edges.length;j++){
    const i=pass?edges.length-1-j:j,k=pass?i+1:i-1,a=edges[i],b=edges[k];
    a.width=Math.min(a.width,b.width+.45*Math.hypot(a.x-b.x,a.y-b.y));
  }
  return edges;
}
export function hitBand(band:Band,p:Point,time=0,tolerance=10):boolean{
  if(!band.visible)return false;
  const edges=ribbonGeometry(band,time),ridge=ridgePosition(band.style);
  for(let i=0;i<edges.length-1;i++){
    const a=edges[i],b=edges[i+1],dx=b.x-a.x,dy=b.y-a.y,length2=dx*dx+dy*dy;
    const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(length2||1)));
    const x=a.x+t*dx,y=a.y+t*dy,nx=a.nx+(b.nx-a.nx)*t,ny=a.ny+(b.ny-a.ny)*t;
    const signed=(p.x-x)*nx+(p.y-y)*ny,w=a.width+(b.width-a.width)*t;
    const tangent=Math.abs((p.x-x)*ny-(p.y-y)*nx);
    if(tangent<=tolerance&&signed>=-ridge*w-tolerance&&signed<=(1-ridge)*w+tolerance)return true;
  }
  return false;
}

export function validateScene(value: unknown): value is Scene {
  if(!value || typeof value!=='object') return false;
  const s=value as Scene, hex=/^#[0-9a-f]{6}$/i;
  return typeof s.title==='string' && s.title.length<200 && hex.test(s.background) && validBackgroundGradient(s.backgroundGradient) && Array.isArray(s.bands) && s.bands.length<=40 && new Set(s.bands.map(b=>b.id)).size===s.bands.length && s.bands.every(b=>typeof b.id==='string' && typeof b.name==='string' && b.name.length<200 && typeof b.visible==='boolean' && ['Silk','Radiant','Neon'].includes(b.style) && Array.isArray(b.colors) && b.colors.length>=2 && b.colors.length<=8 && b.colors.every(c=>hex.test(c)) && Array.isArray(b.points) && b.points.length>=2 && b.points.length<=300 && b.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.abs(p.x)<10000&&Math.abs(p.y)<10000 && [p.hx,p.hy,p.ix,p.iy].every(n=>n===undefined||(Number.isFinite(n)&&Math.abs(n)<10000))) && [['width',5,400],['glow',0,100],['opacity',0,100],['speed',0,3],['amplitude',0,100]].every(([k,min,max])=>Number.isFinite(b[k as keyof Band]) && Number(b[k as keyof Band])>=Number(min) && Number(b[k as keyof Band])<=Number(max)));
}

export function parseCoordinates(text: string): Point[] {
  const rows=text.trim().split(/[\n;]+/), points:Point[]=[];
  for(const row of rows) {
    const pair=row.trim().split(/[\s,]+/).map(Number);
    if(pair.length!==2||pair.some(n=>!Number.isFinite(n)||Math.abs(n)>=10000)) throw new Error('Use one x, y pair per line. Values must be between −9999 and 9999.');
    points.push({x:pair[0],y:pair[1]});
  }
  if(points.length<2||points.length>300) throw new Error('Enter between 2 and 300 points.');
  return points;
}
