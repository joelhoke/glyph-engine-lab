import { sceneCapacity, SCENE_BUDGET } from './models.js';
import { Vector3, Quaternion, Euler } from 'three';

export const MAX_SHAPES = SCENE_BUDGET;
export const MIN_SIZE = 0.35;
export const MAX_SIZE = 1.5;
export const HOLD_SECONDS = 1.2;
export const SHAPE_TYPES = ['sphere', 'pyramid', 'cube'];
export const sizeForHold = seconds => MIN_SIZE + (MAX_SIZE - MIN_SIZE) * Math.min(1, Math.max(0, seconds / HOLD_SECONDS));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const v = (x, y, z) => new Vector3(x, y, z);

// A released gesture may still be waiting for its GPU pick. Keep those requests
// independent so fast clicks never overwrite one another or resurrect after cancel.
export class DropGesture {
  generation = 0;
  current = null;
  pending = new Set();
  begin(kind, time, pointerId) {
    if (this.current) return null;
    const token = { kind, start: time, pointerId, generation: this.generation, hit: null, end: null };
    this.current = token;
    this.pending.add(token);
    return token;
  }
  relocate(token) {
    if (token !== this.current) return null;
    token.revision = (token.revision ?? 0) + 1;
    token.resolved = false;
    return token.revision;
  }
  resolve(token, hit, revision = 0) {
    if (!this.pending.has(token) || token.generation !== this.generation || revision !== (token.revision ?? 0)) return null;
    token.hit = hit;
    token.resolved = true;
    return this.finish(token);
  }
  release(pointerId, time) {
    const token = this.current;
    if (!token || token.pointerId !== pointerId) return null;
    token.end = time;
    this.current = null;
    return this.finish(token);
  }
  finish(token) {
    if (!token.resolved || token.end === null) return null;
    this.pending.delete(token);
    return token.hit ? { kind: token.kind, hit: token.hit, size: sizeForHold(token.end - token.start) } : null;
  }
  preview(time) {
    const t = this.current;
    return t?.hit ? { kind: t.kind, hit: t.hit, size: sizeForHold(time - t.start) } : null;
  }
  cancel() { this.generation++; this.current = null; this.pending.clear(); }
}

const cubeVertices = [];
for (const x of [-0.5, 0.5]) for (const y of [-0.5, 0.5]) for (const z of [-0.5, 0.5]) cubeVertices.push(v(x,y,z));
const pyramidVertices = [v(-.5,-.25,-.5),v(.5,-.25,-.5),v(.5,-.25,.5),v(-.5,-.25,.5),v(0,.75,0)];
const data = {
  cube: { vertices: cubeVertices, normals: [v(1,0,0),v(0,1,0),v(0,0,1)], edges: [v(1,0,0),v(0,1,0),v(0,0,1)], volume: 1, bottom: .5 },
  pyramid: { vertices: pyramidVertices, normals: [v(0,-1,0),v(1,.5,0).normalize(),v(-1,.5,0).normalize(),v(0,.5,1).normalize(),v(0,.5,-1).normalize()], edges: [v(1,0,0),v(0,0,1),...pyramidVertices.slice(0,4).map(p=>pyramidVertices[4].clone().sub(p).normalize())], volume: 1/3, bottom: .25 },
  sphere: { vertices: [], normals: [], edges: [], volume: Math.PI/6, bottom: .5 },
};
export const shapeBottom = kind => data[kind].bottom;
function samples(kind) {
  const points = [], bottom = data[kind].bottom;
  for (let ix=0;ix<4;ix++) for (let iy=0;iy<4;iy++) for (let iz=0;iz<4;iz++) {
    const p=v((ix+.5)/4-.5,(iy+.5)/4-bottom,(iz+.5)/4-.5);
    if (kind==='sphere' && p.length()>.5) continue;
    if (kind==='pyramid' && Math.max(Math.abs(p.x),Math.abs(p.z))+.5*p.y>.375) continue;
    points.push(p);
  }
  return points;
}
for (const kind of SHAPE_TYPES) data[kind].samples=samples(kind);
function modelPhysics(model) {
  // A closed solid box is predictable even for open, disconnected, or concave
  // uploaded meshes. Preserve aspect ratio and keep thin surfaces stable.
  const extent=model.extent.clone().max(v(.04,.04,.04));
  return {...data.cube,vertices:cubeVertices.map(p=>p.clone().multiply(extent)),
    samples:data.cube.samples.map(p=>p.clone().multiply(extent)),
    volume:extent.x*extent.y*extent.z,bottom:extent.y/2};
}
function geometry(body) {
  const d=body.geometry??data[body.kind];
  return {
    vertices:d.vertices.map(p=>p.clone().multiplyScalar(body.size).applyQuaternion(body.rotation).add(body.position)),
    normals:d.normals.map(p=>p.clone().applyQuaternion(body.rotation)),
    edges:d.edges.map(p=>p.clone().applyQuaternion(body.rotation)),
  };
}
function project(body, geo, axis) {
  if(body.kind==='sphere') { const c=body.position.dot(axis);return [c-body.size/2,c+body.size/2]; }
  let lo=Infinity,hi=-Infinity;
  for(const p of geo.vertices) {const d=p.dot(axis);lo=Math.min(lo,d);hi=Math.max(hi,d);}
  return [lo,hi];
}
// SAT for convex pairs; sphere/convex adds vertex and edge-distance axes.
export function contact(a,b) {
  const delta=b.position.clone().sub(a.position);
  if(delta.length()>a.radius+b.radius) return null;
  if(a.kind==='sphere' && b.kind==='sphere') {
    const distance=delta.length(), depth=(a.size+b.size)/2-distance;
    return depth>0 ? {normal:distance>1e-6?delta.divideScalar(distance):v(1,0,0),depth} : null;
  }
  const ga=geometry(a),gb=geometry(b), axes=[...ga.normals,...gb.normals];
  for(const ea of ga.edges) for(const eb of gb.edges) axes.push(ea.clone().cross(eb));
  if(a.kind==='sphere' || b.kind==='sphere') {
    const center=a.kind==='sphere'?a.position:b.position, poly=a.kind==='sphere'?gb:ga;
    for(const p of poly.vertices) {
      axes.push(p.clone().sub(center));
      for(const edge of poly.edges) {
        const offset=center.clone().sub(p);
        axes.push(offset.addScaledVector(edge,-offset.dot(edge)));
      }
    }
  }
  let depth=Infinity,normal=null;
  for(const axis of axes) {
    if(axis.lengthSq()<1e-9)continue;
    axis.normalize();
    const pa=project(a,ga,axis),pb=project(b,gb,axis);
    const overlap=Math.min(pa[1]-pb[0],pb[1]-pa[0]);
    if(overlap<=0)return null;
    if(overlap<depth) {depth=overlap;normal=axis.clone();if(delta.dot(normal)<0)normal.negate();}
  }
  return normal ? {normal,depth} : null;
}

export class ShapeController {
  bodies=[];
  selectedId=null;
  get selected(){return this.bodies.find(b=>b.id===this.selectedId)??null;}
  select(id){this.selectedId=this.bodies.some(b=>b.id===id)?id:null;return this.selected;}
  generation=0;
  nextId=1;
  accumulator=0;
  lastQueryTime=-Infinity;
  time=0;
  moveSession=null;
  add(kind,hit,size,model=null) {
    if(!SHAPE_TYPES.includes(kind) && model?.id!==kind)throw new Error('Unknown shape');
    size=clamp(size,MIN_SIZE,model?3:MAX_SIZE);
    if(!sceneCapacity(this.bodies,model).remaining) {
      // Keep the established primitive-only replacement behavior. Imported work
      // is never silently removed to accommodate a more expensive addition.
      if(!model && this.bodies.length===MAX_SHAPES && this.bodies.every(b=>SHAPE_TYPES.includes(b.kind)))this.bodies.shift();
      else return null;
    }
    const d=model?modelPhysics(model):data[kind], id=this.nextId++;
    const position=v(clamp(hit.x,-9,9),hit.y+2+d.bottom*size,clamp(hit.z,-9,9));
    const body={id,kind,size,cost:model?.cost??1,geometry:d,position,velocity:v(0,0,0),rotation:new Quaternion().setFromAxisAngle(v(0,1,0),id*2.4),angularVelocity:v(0,0,0),entered:false,
      mass:d.volume*size**3*.38, radius:kind==='sphere'?size/2:Math.max(...d.vertices.map(p=>p.length()))*size,
      samples:d.samples.map(p=>p.clone().multiplyScalar(size)), water:d.samples.map(()=>({height:hit.y,x:position.x,z:position.z,sx:0,sz:0,vy:0})),
    };
    if(model)body.rotation.identity();
    // Diagonal inertia from distributed volume samples, about the center of mass.
    const inertia=v(0,0,0);
    for(const p of body.samples)inertia.add(v(p.y*p.y+p.z*p.z,p.x*p.x+p.z*p.z,p.x*p.x+p.y*p.y));
    inertia.multiplyScalar(body.mass/body.samples.length);
    body.invInertia=v(1/Math.max(inertia.x,.00001),1/Math.max(inertia.y,.00001),1/Math.max(inertia.z,.00001));
    this.bodies.push(body);this.selectedId=body.id;this.generation++;
    return body;
  }
  resizeModel(id,size) {
    const body=this.bodies.find(b=>b.id===id);if(!body || SHAPE_TYPES.includes(body.kind))return false;
    return this.resizeBody(id,size);
  }
  resizeBody(id,size) {
    const body=this.bodies.find(b=>b.id===id);if(!body || !Number.isFinite(size))return false;
    this.endMove();const next=clamp(size,MIN_SIZE,SHAPE_TYPES.includes(body.kind)?MAX_SIZE:3),ratio=next/body.size;
    body.size=next;body.radius*=ratio;body.mass*=ratio**3;body.invInertia.divideScalar(ratio**5);
    for(const sample of body.samples)sample.multiplyScalar(ratio);
    body.velocity.set(0,0,0);body.angularVelocity.set(0,0,0);this.generation++;return true;
  }
  setSuspended(id,value) {
    const body=this.bodies.find(b=>b.id===id);if(!body)return false;
    this.endMove();body.suspended=!!value;
    body.velocity.set(0,0,0);body.angularVelocity.set(0,0,0);
    if(!value){body.poseAngles=null;this.rearmImpact(body);}
    this.generation++;return true;
  }
  rearmImpact(body) {
    const bottom=project(body,geometry(body),v(0,1,0))[0];
    if(bottom>Math.max(...body.water.map(w=>w.height))+.08)body.entered=false;
  }
  constrain(body,floorDepth) {
    const geo=geometry(body);
    for(const [axis,lo,hi] of [[v(1,0,0),-10,10],[v(0,0,1),-10,10],[v(0,1,0),-floorDepth,8]]) {
      const [min,max]=project(body,geo,axis);
      body.position.addScaledVector(axis,min<lo?lo-min:max>hi?hi-max:0);
    }
  }
  pose(id,values,floorDepth=3) {
    const body=this.bodies.find(b=>b.id===id),allowed=['x','y','z','size','tilt','turn','roll'];
    if(!body || !Object.keys(values).length || Object.entries(values).some(([k,v])=>!allowed.includes(k)||!Number.isFinite(v)))return false;
    this.endMove();
    if(values.size!==undefined)this.resizeBody(id,values.size);
    for(const axis of ['x','y','z'])if(values[axis]!==undefined)body.position[axis]=values[axis];
    // Preserve authored angles through the Euler singularity while held.
    const angles=body.poseAngles?.clone()??new Euler().setFromQuaternion(body.rotation,'XYZ');
    for(const [key,axis] of [['tilt','x'],['turn','y'],['roll','z']])if(values[key]!==undefined)angles[axis]=clamp(values[key],-180,180)*Math.PI/180;
    body.rotation.setFromEuler(angles).normalize();body.poseAngles=angles;
    this.constrain(body,floorDepth);this.setSuspended(id,true);return true;
  }
  remove(id) {
    if(this.moveSession?.body.id===id)this.endMove();
    this.bodies=this.bodies.filter(b=>b.id!==id);
    if(this.selectedId===id)this.selectedId=null;this.generation++;
  }
  clear() {this.endMove();this.bodies=[];this.selectedId=null;this.generation++;this.accumulator=0;this.lastQueryTime=-Infinity;}
  removeModel(kind) {
    if(this.moveSession?.body.kind===kind)this.endMove();
    this.bodies=this.bodies.filter(b=>b.kind!==kind);this.generation++;
    if(!this.selected)this.selectedId=null;
  }
  beginMove(id, hit, normal = new Vector3(0,1,0)) {
    if(this.moveSession)return false;
    const body=this.bodies.find(b=>b.id===id);
    if(!body)return false;
    const bounds=project(body,geometry(body),v(0,1,0)).map(y=>y-body.position.y);
    this.moveSession={body,hit:hit.clone(),normal:normal.clone().normalize(),bounds,position:body.position.clone(),velocity:body.velocity.clone(),angularVelocity:body.angularVelocity.clone()};
    body.held=true;body.velocity.set(0,0,0);body.angularVelocity.set(0,0,0);
    this.generation++;
    return true;
  }
  move(ray, floorDepth=3) {
    const session=this.moveSession;
    if(!session)return false;
    const denominator=ray.direction.dot(session.normal);
    if(Math.abs(denominator)<.0001)return false;
    const t=session.hit.clone().sub(ray.origin).dot(session.normal)/denominator;
    if(t<0 || t>100)return false;
    const {body,position,hit}=session;
    const p=ray.at(t,new Vector3()).sub(hit).add(position),extent=10-body.radius;
    body.position.set(clamp(p.x,-extent,extent),clamp(p.y,-floorDepth-session.bounds[0]+.01,8-session.bounds[1]),clamp(p.z,-extent,extent));
    // Height samples requested at the old location must not move a newly placed body.
    this.generation++;
    return true;
  }
  endMove(cancel=false) {
    const session=this.moveSession;
    if(!session)return;
    const {body}=session;
    if(cancel) {
      body.position.copy(session.position);body.velocity.copy(session.velocity);
      body.angularVelocity.copy(session.angularVelocity);
    } else {
      // A lifted body gets one fresh water-entry event after release. Moving a
      // submerged body retains its entry state and lets buoyancy raise it.
      const waterTop=Math.max(...body.water.map(w=>w.height));
      if(body.position.y+session.bounds[0]>waterTop+.08)body.entered=false;
    }
    body.held=false;this.moveSession=null;this.generation++;
  }
  query() {
    const points=[];
    for(const b of this.bodies)for(const p of b.samples) {
      const world=p.clone().applyQuaternion(b.rotation).add(b.position);
      points.push(world.x,world.z);
    }
    return {generation:this.generation,time:this.time,points:new Float32Array(points)};
  }
  ingest(query,result) {
    if(query.generation!==this.generation || query.time<=this.lastQueryTime || result.length!==query.points.length*2)return false;
    const dt=query.time-this.lastQueryTime;let i=0;
    for(const b of this.bodies)for(const w of b.water) {
      const h=result[i*4],x=query.points[i*2],z=query.points[i*2+1];
      const previous=w.height+w.sx*(x-w.x)+w.sz*(z-w.z);
      w.vy=Number.isFinite(dt)&&dt>0?clamp((h-previous)/dt,-1,1):0;
      Object.assign(w,{height:h,sx:result[i*4+1],sz:result[i*4+2],x,z});i++;
    }
    this.lastQueryTime=query.time;return true;
  }
  impulse(x,z,strength,exclude=null) {
    for(const b of this.bodies) {
      if(!b.entered || b.held || b.suspended || b.id===exclude)continue;
      const delta=v(b.position.x-x,0,b.position.z-z),distance=delta.length();
      if(distance<.001 || distance>4)continue;
      b.velocity.addScaledVector(delta.normalize(),Math.min(.7,strength)*Math.exp(-distance*.8));
    }
  }
  step(dt,floorDepth,onImpact=()=>{}) {
    if(dt<=0)return;
    const h=1/120;
    this.accumulator+=Math.min(dt,.1);
    while(this.accumulator>=h) {
      this.accumulator-=h;this.time+=h;
      for(const b of this.bodies)this.integrate(b,h,floorDepth,onImpact);
      for(let pass=0;pass<2;pass++)for(let i=0;i<this.bodies.length;i++)for(let j=i+1;j<this.bodies.length;j++)this.collide(this.bodies[i],this.bodies[j]);
    }
  }
  integrate(b,dt,floorDepth,onImpact) {
    if(b.held || b.suspended)return;
    const force=v(0,-9.81*b.mass,0),torque=v(0,0,0),inv=b.rotation.clone().invert();
    let wet=false,entryHeight=0;
    for(let i=0;i<b.samples.length;i++) {
      const r=b.samples[i].clone().applyQuaternion(b.rotation),p=r.clone().add(b.position),w=b.water[i];
      const height=w.height+clamp(w.sx*(p.x-w.x)+w.sz*(p.z-w.z),-.25,.25);
      const fraction=clamp((height-p.y)/(b.size/4)+.5,0,1);
      if(fraction<=0)continue;
      wet=true;entryHeight=height;
      const velocity=b.angularVelocity.clone().cross(r).add(b.velocity);
      const cellMass=b.mass/b.samples.length;
      const f=v(-velocity.x*cellMass*3.5*fraction,
        9.81*cellMass/.38*fraction-(velocity.y-w.vy)*cellMass*7*fraction,
        -velocity.z*cellMass*3.5*fraction);
      force.add(f);torque.add(r.clone().cross(f));
    }
    if(wet&&!b.entered) {
      b.entered=true;
      const strength=clamp(.12+b.size*Math.max(0,-b.velocity.y)*.09,.15,.8);
      const event={x:b.position.x,z:b.position.z,y:entryHeight,radius:b.size*.55,strength,bodyId:b.id};
      onImpact(event);this.impulse(event.x,event.z,strength,b.id);
    }
    b.velocity.addScaledVector(force,dt/b.mass).clampLength(0,10);
    b.position.addScaledVector(b.velocity,dt);
    const acceleration=torque.applyQuaternion(inv).multiply(b.invInertia).applyQuaternion(b.rotation);
    b.angularVelocity.addScaledVector(acceleration,dt).multiplyScalar(Math.exp(-dt*(wet?3:0.15))).clampLength(0,4);
    const spin=b.angularVelocity.length();
    if(spin>1e-6)b.rotation.premultiply(new Quaternion().setFromAxisAngle(b.angularVelocity.clone().divideScalar(spin),spin*dt)).normalize();
    const geo=geometry(b);
    for(const [axis,lo,hi] of [[v(1,0,0),-10,10],[v(0,0,1),-10,10],[v(0,1,0),-floorDepth,Infinity]]) {
      const [min,max]=project(b,geo,axis);
      const correction=min<lo?lo-min:max>hi?hi-max:0;
      if(!correction)continue;
      b.position.addScaledVector(axis,correction);
      const speed=b.velocity.dot(axis);
      if(speed*correction<0)b.velocity.addScaledVector(axis,-speed*1.08);
      b.angularVelocity.multiplyScalar(.95);
    }
  }
  collide(a,b) {
    const c=contact(a,b);if(!c)return;
    const {normal,depth}=c,ia=a.held||a.suspended?0:1/a.mass,ib=b.held||b.suspended?0:1/b.mass,total=ia+ib;
    if(!total)return;
    const correction=Math.max(0,depth-.001)*.75/total;
    a.position.addScaledVector(normal,-correction*ia);b.position.addScaledVector(normal,correction*ib);
    const speed=b.velocity.clone().sub(a.velocity).dot(normal);
    if(speed>=0)return;
    const impulse=-(1.08)*speed/total;
    a.velocity.addScaledVector(normal,-impulse*ia);b.velocity.addScaledVector(normal,impulse*ib);
    // A small tangential kick gives restrained rocking without an unstable stack solver.
    const tangent=b.velocity.clone().sub(a.velocity);tangent.addScaledVector(normal,-tangent.dot(normal));
    const spin=normal.clone().cross(tangent).multiplyScalar(.08);
    if(!a.held&&!a.suspended)a.angularVelocity.add(spin);if(!b.held&&!b.suspended)b.angularVelocity.sub(spin);
  }
}
