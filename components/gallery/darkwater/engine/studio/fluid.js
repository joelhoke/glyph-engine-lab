import { Vector3 } from 'three';

// A local position-based fluid reservoir. The ocean remains a height field;
// only ejected liquid pays for a volumetric solve. Units are meters / seconds.
export const FLUID_STEP = 1 / 90;
export const FLUID_SPACING = .095;
export const FLUID_SUPPORT = FLUID_SPACING * 2.1;
export const fluidBudget = bodies => Math.max(480, 1200 - bodies.reduce((n,b)=>n+(b.cost??1),0)*45);
const H=FLUID_SUPPORT,H2=H*H,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const weight=r2=>r2<H2?(1-r2/H2)**3:0;
let restDensity=0;
for(let x=-2;x<=2;x++)for(let y=-2;y<=2;y++)for(let z=-2;z<=2;z++)restDensity+=weight((x*x+y*y+z*z)*FLUID_SPACING**2);
const key=(x,y,z)=>(x+1024)*4194304+(y+1024)*2048+z+1024;
const point=new Vector3();

// Emit beside the solid footprint, not inside a falling object. Projecting the
// established convex proxy keeps rotated cubes, pyramids and wide imports from
// forcing embedded samples out at artificial, explosive velocities.
export function fluidFootprint(body) {
  if(body.kind==='sphere')return {radius:body.size*.5,inside:(x,z)=>Math.hypot(x,z)<body.size*.5+.025};
  const points=body.geometry.vertices.map(p=>p.clone().multiplyScalar(body.size).applyQuaternion(body.rotation)).sort((a,b)=>a.x-b.x||a.z-b.z);
  const cross=(o,a,b)=>(a.x-o.x)*(b.z-o.z)-(a.z-o.z)*(b.x-o.x),half=points=>{
    const chain=[];for(const p of points){while(chain.length>=2 && cross(chain.at(-2),chain.at(-1),p)<=0)chain.pop();chain.push(p);}return chain;
  };
  const lo=half(points),hi=half([...points].reverse()),hull=[...lo.slice(0,-1),...hi.slice(0,-1)];
  return {radius:Math.max(...points.map(p=>Math.hypot(p.x,p.z))),inside:(x,z)=>hull.every((a,i)=>{
    const b=hull[(i+1)%hull.length];return (b.x-a.x)*(z-a.z)-(b.z-a.z)*(x-a.x)>=-.025*Math.hypot(b.x-a.x,b.z-a.z);
  })};
}

// Use the same sphere / convex collision proxy as the existing rigid bodies.
// Imported meshes retain all visual detail; their established box proxy stays.
export function collideFluid(p,body) {
  point.set(p.x,p.y,p.z).sub(body.position);
  if(point.lengthSq()>(body.radius+FLUID_SPACING)**2)return false;
  point.applyQuaternion(body.rotation.clone().conjugate());
  const margin=FLUID_SPACING*.28;
  if(body.kind==='sphere') {
    const radius=body.size*.5+margin,d=point.length();if(d>=radius)return false;
    if(d<1e-6)point.set(0,radius,0);else point.multiplyScalar(radius/d);
  } else {
    let depth=Infinity,normal=null;
    for(const n of body.geometry.normals) {
      let support=-Infinity;
      for(const vertex of body.geometry.vertices)support=Math.max(support,vertex.dot(n)*body.size);
      const d=support+margin-point.dot(n);if(d<=0)return false;
      if(d<depth){depth=d;normal=n;}
      // Cube geometry stores only the three positive face normals.
      if(body.geometry.normals.length===3) {
        const other=support+margin+point.dot(n);if(other<=0)return false;
        if(other<depth){depth=other;normal=n.clone().negate();}
      }
    }
    if(!normal)return false;point.addScaledVector(normal,depth);
  }
  point.applyQuaternion(body.rotation).add(body.position);
  p.x=point.x;p.y=point.y;p.z=point.z;return true;
}

export class FluidSystem {
  particles=[];
  generation=0;
  nextId=1;
  time=0;
  accumulator=0;
  revision=0;
  budget=1200;
  seen=new WeakSet();
  rippleGeneration=-1;
  returned=0;
  returnPool=[];
  lastReturn=0;
  lastQueryTime=-Infinity;
  clear() {this.particles=[];this.returnPool=[];this.accumulator=0;this.lastQueryTime=-Infinity;this.generation++;this.revision++;}
  sync(ripples,time,bodies,enabled) {
    if(this.rippleGeneration!==ripples.generation){this.clear();this.rippleGeneration=ripples.generation;}
    this.budget=fluidBudget(bodies);
    for(const event of ripples.active(time)) {
      if(this.seen.has(event))continue;
      this.seen.add(event);
      if(enabled && event.spray>0 && time-event.time<.15 && time>=event.time)this.emit(event,event.bodyId===undefined?null:bodies.find(b=>b.id===event.bodyId));
    }
  }
  emit(event,body=null) {
    const available=this.budget-this.particles.length;
    if(available<24)return 0;
    const footprint=body?fluidFootprint(body):null;
    const radius=footprint?Math.min(3,footprint.radius+.22):clamp(event.radius,.15,.9),power=clamp(Math.sqrt(event.strength/.28),.35,1.7);
    const amount=clamp(event.spray??1,.1,1),limit=Math.min(available,Math.round((140+radius*260)*amount));
    const particles=[],spacing=FLUID_SPACING;
    // A sampled volume, rather than an animated ring: pressure, cohesion,
    // collisions and gravity subsequently determine the surface and break-up.
    for(let y=0;y<3;y++)for(let x=-Math.ceil(radius/spacing);x<=Math.ceil(radius/spacing);x++)for(let z=-Math.ceil(radius/spacing);z<=Math.ceil(radius/spacing);z++) {
      const px=x*spacing,pz=z*spacing,r=Math.hypot(px,pz);
      if(r>radius || r<radius*.35)continue;
      if(footprint?.inside(px,pz))continue;
      const angle=Math.atan2(pz,px),lobe=1+.18*Math.sin(angle*5+event.x)+.12*Math.cos(angle*3-event.z);
      particles.push({id:this.nextId++,x:event.x+px,y:(event.y??0)+(y+.2)*spacing,z:event.z+pz,
        vx:px/Math.max(r,.01)*power*.85,vy:(.3+4.2*(r/radius)**2)*power*lobe*Math.sqrt(amount),vz:pz/Math.max(r,.01)*power*.85,
        age:0,water:event.y??0,sx:0,sz:0,waterX:event.x+px,waterZ:event.z+pz,lambda:0,density:0,neighbors:[]});
    }
    // Keep complete local columns when budget-limited, preserving a continuous
    // initial sheet instead of randomly removing samples throughout its volume.
    particles.sort((a,b)=>Math.hypot(a.x-event.x,a.z-event.z)-Math.hypot(b.x-event.x,b.z-event.z));
    this.particles.push(...particles.slice(0,limit));this.revision++;
    return Math.min(limit,particles.length);
  }
  step(dt,bodies=[],floorDepth=3,onReturn=()=>{}) {
    if(dt<=0)return;
    this.accumulator+=Math.min(dt,.1);
    while(this.accumulator+1e-10>=FLUID_STEP) {
      this.advance(FLUID_STEP,bodies,floorDepth,onReturn);this.accumulator-=FLUID_STEP;this.time+=FLUID_STEP;
    }
  }
  advance(dt,bodies,depth,onReturn) {
    const particles=this.particles;if(!particles.length)return;
    const grid=new Map();
    for(const p of particles) {
      p.ox=p.x;p.oy=p.y;p.oz=p.z;p.vy-=9.81*dt;
      p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.age+=dt;
      const k=key(Math.floor(p.x/H),Math.floor(p.y/H),Math.floor(p.z/H));
      if(!grid.has(k))grid.set(k,[]);grid.get(k).push(p);
    }
    for(const p of particles) {
      p.neighbors.length=0;
      const cx=Math.floor(p.x/H),cy=Math.floor(p.y/H),cz=Math.floor(p.z/H);
      for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++) {
        const cell=grid.get(key(cx+x,cy+y,cz+z));if(!cell)continue;
        for(const q of cell)if(q!==p && (p.x-q.x)**2+(p.y-q.y)**2+(p.z-q.z)**2<H2 && p.neighbors.length<64)p.neighbors.push(q);
      }
    }
    for(let iteration=0;iteration<3;iteration++) {
      for(const p of particles) {
        let density=1,gx=0,gy=0,gz=0,denom=0;
        for(const q of p.neighbors) {
          const x=p.x-q.x,y=p.y-q.y,z=p.z-q.z,r2=x*x+y*y+z*z;
          if(r2>=H2)continue;density+=weight(r2);
          const g=-6/H2*(1-r2/H2)**2/restDensity;
          gx+=g*x;gy+=g*y;gz+=g*z;denom+=g*g*r2;
        }
        p.density=density/restDensity;
        p.lambda=-Math.max(0,p.density-1)/(denom+gx*gx+gy*gy+gz*gz+.001);
      }
      for(const p of particles) {
        let dx=0,dy=0,dz=0;
        for(const q of p.neighbors) {
          const x=p.x-q.x,y=p.y-q.y,z=p.z-q.z,r2=x*x+y*y+z*z;
          if(r2>=H2 || r2<1e-10)continue;
          const g=-6/H2*(1-r2/H2)**2/restDensity;
          // Weak surface tension binds the free surface; compression is solved
          // separately so liquid can stretch into sheets and separate droplets.
          const cohesion=r2>FLUID_SPACING**2?.000035*(1-r2/H2):0;
          const scale=(p.lambda+q.lambda)*g-cohesion/Math.sqrt(r2);
          dx+=scale*x;dy+=scale*y;dz+=scale*z;
        }
        const scale=Math.min(1,FLUID_SPACING*.25/Math.max(1e-9,Math.hypot(dx,dy,dz)));
        p.dx=dx*scale;p.dy=dy*scale;p.dz=dz*scale;
      }
      for(const p of particles){p.x+=p.dx;p.y+=p.dy;p.z+=p.dz;}
    }
    const returns=new Map(),survivors=[];
    for(const p of particles) {
      for(const body of bodies)collideFluid(p,body);
      p.x=clamp(p.x,-9.95,9.95);p.z=clamp(p.z,-9.95,9.95);p.y=Math.max(-depth+.03,p.y);
      p.vx=clamp((p.x-p.ox)/dt,-9,9)*.997;p.vy=clamp((p.y-p.oy)/dt,-12,12)*.997;p.vz=clamp((p.z-p.oz)/dt,-9,9)*.997;
      const surface=p.water+clamp((p.x-p.waterX)*p.sx+(p.z-p.waterZ)*p.sz,-.25,.25);
      if(p.age>.12 && p.vy<0 && p.y<surface+.025) {
        const k=key(Math.floor(p.x/.7),0,Math.floor(p.z/.7));
        const bucket=returns.get(k)??{x:0,z:0,y:0,energy:0,count:0};
        bucket.x+=p.x;bucket.z+=p.z;bucket.y+=surface;bucket.energy+=Math.min(8,-p.vy);bucket.count++;returns.set(k,bucket);this.returned++;
      } else if(p.age<3.5)survivors.push(p);
    }
    // Returning liquid feeds the shared surface without recursively emitting
    // more particles. Aggregate per cell and fixed step to bound disturbance.
    this.returnPool.push(...returns.values());
    if((this.time-this.lastReturn>=.14 || !survivors.length) && this.returnPool.length) {
      const regions=new Map();
      for(const b of this.returnPool) {
        const k=key(Math.floor(b.x/b.count/1.5),0,Math.floor(b.z/b.count/1.5)),a=regions.get(k)??{x:0,y:0,z:0,energy:0,count:0};
        for(const field of ['x','y','z','energy','count'])a[field]+=b[field];regions.set(k,a);
      }
      for(const b of [...regions.values()].sort((a,b)=>b.energy-a.energy).slice(0,4))onReturn({x:b.x/b.count,z:b.z/b.count,y:b.y/b.count,radius:.3+Math.sqrt(b.count)*.025,strength:Math.min(.13,b.energy*.0008)});
      this.lastReturn=this.time;this.returnPool=[];
    }
    this.particles=survivors;this.revision++;
  }
  query() {
    return {generation:this.generation,time:this.time,ids:this.particles.map(p=>p.id),points:this.particles.flatMap(p=>[p.x,p.z])};
  }
  ingest(query,values) {
    if(query.generation!==this.generation || this.time-query.time>.25 || query.time<this.lastQueryTime)return false;
    this.lastQueryTime=query.time;
    const byId=new Map(this.particles.map(p=>[p.id,p]));
    for(let i=0;i<query.ids.length;i++) {
      const p=byId.get(query.ids[i]);if(!p || !Number.isFinite(values[i*4]))continue;
      p.water=values[i*4];p.sx=values[i*4+1];p.sz=values[i*4+2];p.waterX=query.points[i*2];p.waterZ=query.points[i*2+1];
    }
    return true;
  }
}
