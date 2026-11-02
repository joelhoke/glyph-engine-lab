// Extracted from Three.Gradient: procedural surfaces, morph bridge and petal motion.
import * as THREE from 'three';
import {petalCorrespondence,type PetalPatch} from './petal-mapping';
import type {FlowerSettings, FlowerVariety} from './types';

const ROWS=36;
interface Petal {angle:number;length:number;width:number;thickness:number;lift:number;sweep:number;ring:number;kind:FlowerVariety}
function arrangement(kind:FlowerVariety,settings:FlowerSettings):Petal[]{
  const count=kind==='original'?settings.petals:kind==='plumeria'||kind==='cherry'?5:kind==='rose'?24:30;
  const petals:Petal[]=[];
  for(let i=0;i<count;i++){
    const ring=kind==='rose'?i%3:0;
    const angle=kind==='rose'?Math.floor(i/3)/8*Math.PI*2+ring*.24:i/count*Math.PI*2;
    const profile=kind==='rose'?{length:[1.05,.74,.40][ring],width:[.52,.40,.25][ring],thickness:.045,lift:[.38,.55,.68][ring],sweep:.10}:
      kind==='plumeria'?{length:1.2,width:.52,thickness:.075,lift:.17,sweep:.25}:
      kind==='cherry'?{length:1.14,width:.54,thickness:.035,lift:.11,sweep:.015}:
      kind==='daisy'?{length:1.02,width:.12,thickness:.033,lift:.10,sweep:.015}:
      {length:1.18,width:.39,thickness:.23,lift:.15,sweep:0};
    petals.push({angle,ring,kind,...profile});
  }
  return petals.sort((a,b)=>a.angle-b.angle);
}
function petalPoint(p:Petal,settings:FlowerSettings,u:number,v:number,side:number,roundRange?:[number,number]){
  const c=1-2*v,s=side*Math.sqrt(Math.max(0,1-c*c));
  const profile=p.kind==='rose'?Math.pow(Math.max(.000001,Math.sin(u*Math.PI)),.35):p.kind==='original'?Math.sqrt(Math.max(.000001,4*u*(1-u))):Math.pow(Math.max(.000001,Math.sin(Math.PI*u)),p.kind==='daisy'?.45:.65);
  const z=p.width*profile*c+p.sweep*u*u;
  let x=(p.kind==='daisy'?.28:.06)+u*p.length*settings.length,y=p.thickness*s*profile;
  if(p.kind==='original')y+=.15*Math.sin(u*Math.PI)-settings.bend*u*u;
  else if(p.kind==='rose'){x-=.15*c*c*profile*u**3;y+=p.ring*.035+p.lift*(.4*Math.sin(u*Math.PI)+.75*u)+.12*c*c*profile+.04*c*Math.sin(u*Math.PI);}
  else if(p.kind==='plumeria')y+=p.lift*u*u+.13*c*profile*u+.08*c*c*profile;
  else if(p.kind==='cherry'){x-=.16*u**6*Math.exp(-Math.pow(z/.16,2));y+=p.lift*u*u+.07*c*c*profile+.012*Math.sin(u*28+c*4)*profile;}
  else y+=p.lift*Math.sin(u*Math.PI)-.07*u*u+.025*c*c*profile;
  if(p.kind!=='original')y-=(settings.bend-.3)*.3*u*u;
  if(roundRange){
    const [lo,hi]=roundRange,t=(v-lo)/(hi-lo);
    const round=(distance:number)=>{const x=THREE.MathUtils.clamp(distance/.35,0,1);return Math.sqrt(1-(1-x)*(1-x));};
    const factor=(lo>1e-7?round(t):1)*(hi<1-1e-7?round(1-t):1);
    y-=p.thickness*s*profile*(1-factor);
  }
  return new THREE.Vector3(x,y,z);
}
function surfaceNormal(p:Petal,settings:FlowerSettings,u:number,v:number,side:number,roundRange?:[number,number]){
  const e=.0001,lo=roundRange?.[0]??0,hi=roundRange?.[1]??1,ve=Math.min(e,(hi-lo)/4),uu=Math.max(e,Math.min(1-e,u)),vv=Math.max(lo+ve,Math.min(hi-ve,v));
  const du=petalPoint(p,settings,uu+e,vv,side,roundRange).sub(petalPoint(p,settings,uu-e,vv,side,roundRange));
  const dv=petalPoint(p,settings,uu,vv+ve,side,roundRange).sub(petalPoint(p,settings,uu,vv-ve,side,roundRange));
  return du.cross(dv).multiplyScalar(side).normalize();
}
function elementPoint(u:number,v:number,side:number){
  const c=1-2*v,profile=Math.sqrt(Math.max(0,Math.sin(u*Math.PI)));
  return [.6*profile*c,(u-.5)*1.5,.12*profile*side*Math.sqrt(Math.max(0,1-c*c))];
}
function petalGeometry(from:Petal,to:Petal,patch:PetalPatch,settings:FlowerSettings,bridge:Petal){
  const widthSteps=12,indices:number[]=[],positions:number[][]=[[],[],[],[],[]],normals:number[][]=[[],[],[],[],[]],elements:number[][]=[[],[],[]];
  // Top and underside are split at identical width fractions. Shared edge
  // normals are evaluated on the full petal, never on the individual patch.
  for(const side of [1,-1]){
    const offset=positions[0].length/3;
    for(let i=0;i<=ROWS;i++)for(let j=0;j<=widthSteps;j++){
      const u=i/ROWS,t=j/widthSteps;
      for(const [k,p,range]of [[0,from,patch.fromRange],[1,to,patch.toRange],[2,from,patch.fromRange],[3,to,patch.toRange]] as const){
        const v=THREE.MathUtils.lerp(range[0],range[1],t);
        positions[k].push(...petalPoint(p,settings,u,v,side,k>=2?range:undefined).toArray());normals[k].push(...surfaceNormal(p,settings,u,v,side,k>=2?range:undefined).toArray());if(k<2)elements[k].push(...elementPoint(u,v,side));
      }
      positions[4].push(...petalPoint(bridge,settings,u,t,side).toArray());normals[4].push(...surfaceNormal(bridge,settings,u,t,side).toArray());elements[2].push(...elementPoint(u,t,side));
    }
    for(let i=0;i<ROWS;i++)for(let j=0;j<widthSteps;j++){
      const a=offset+i*(widthSteps+1)+j,b=a+widthSteps+1;
      indices.push(...(side===1?[a,b,a+1,b,b+1,a+1]:[a,a+1,b,b,a+1,b+1]));
    }
  }
  // Close the cut edges so a separating patch remains a solid petal surface.
  for(const edge of [0,1]){
    const offset=positions[0].length/3;
    for(let i=0;i<=ROWS;i++)for(const side of [1,-1]){
      const u=i/ROWS;
      for(const [k,p,range]of [[0,from,patch.fromRange],[1,to,patch.toRange],[2,from,patch.fromRange],[3,to,patch.toRange]] as const){
        const v=range[edge],du=petalPoint(p,settings,Math.min(1,u+.0001),v,1).sub(petalPoint(p,settings,Math.max(0,u-.0001),v,1));
        const n=du.cross(new THREE.Vector3(0,1,0)).multiplyScalar(edge===0?1:-1).normalize();
        positions[k].push(...petalPoint(p,settings,u,v,side,k>=2?range:undefined).toArray());normals[k].push(...n.toArray());if(k<2)elements[k].push(...elementPoint(u,v,side));
      }
      const du=petalPoint(bridge,settings,Math.min(1,u+.0001),edge,1).sub(petalPoint(bridge,settings,Math.max(0,u-.0001),edge,1));
      positions[4].push(...petalPoint(bridge,settings,u,edge,side).toArray());normals[4].push(...du.cross(new THREE.Vector3(0,1,0)).multiplyScalar(edge===0?1:-1).normalize().toArray());elements[2].push(...elementPoint(u,edge,side));
    }
    for(let i=0;i<ROWS;i++){const a=offset+i*2,b=a+2;indices.push(a,b,a+1,b,b+1,a+1);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setIndex(indices);
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions[0],3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals[0],3));
  geometry.setAttribute('elementGradientPosition',new THREE.Float32BufferAttribute(elements[0],3));geometry.setAttribute('elementGradientTarget',new THREE.Float32BufferAttribute(elements[1],3));
  geometry.setAttribute('elementGradientBridge',new THREE.Float32BufferAttribute(elements[2],3));
  geometry.morphAttributes.position=positions.slice(1).map(p=>new THREE.Float32BufferAttribute(p,3));geometry.morphAttributes.normal=normals.slice(1).map(n=>new THREE.Float32BufferAttribute(n,3));
  geometry.computeBoundingSphere();return geometry;
}
const centerSize=(kind:FlowerVariety):[number,number,number]=>kind==='daisy'?[.36,.15,.36]:kind==='rose'?[.08,.07,.08]:kind==='original'?[.23,.10,.23]:[.12,.065,.12];
// A periodic offset closes the first/last petal seam without synchronizing
// every element. Angle also keeps the result independent of morph patch count.
const petalPhase=(angle:number)=>.11*(1-Math.cos(angle));
const flutter=(kind:FlowerVariety)=>kind==='original'?.19:kind==='rose'?.035:kind==='daisy'?.085:.065;
export class Flower {
  root=new THREE.Group();head=new THREE.Group();petals:THREE.Group[]=[];petalMeshes:THREE.Mesh[]=[];
  stem:THREE.Mesh;stemBase:Float32Array;heart:THREE.Mesh;stamens=new THREE.Group();
  private pairs:{from:Petal;to:Petal;radial:THREE.Group;phase:{value:number}}[]=[];
  private morphUniform={value:0};private bridgeUniform={value:0};private bridgeEnabled=false;
  constructor(private settings:FlowerSettings){
    const material=new THREE.MeshStandardMaterial({color:'#889c73',roughness:.43});
    const petalMat=new THREE.MeshStandardMaterial({color:'#efafc7',roughness:.44,side:THREE.DoubleSide});
    const from=arrangement(settings.variety,settings),to=arrangement(settings.target,settings);
    const patches=petalCorrespondence(from.length,to.length);
    this.bridgeEnabled=from.length!==to.length;
    // Unequal angular cuts are only an endpoint correspondence. During a
    // count change, redistribute them into an evenly spaced ring of equal
    // full petals, rather than exposing the unequal cuts as tiny slivers.
    const mean=(key:'length'|'thickness')=>[...from,...to].reduce((n,p)=>n+p[key],0)/(from.length+to.length);
    const bridge:Petal={angle:0,length:mean('length'),width:Math.min(.38,Math.PI*mean('length')*.76/patches.length),thickness:Math.min(.12,mean('thickness')),lift:.15,sweep:0,ring:0,kind:'original'};
    for(const patch of patches){
      const a=from[patch.from],b=to[patch.to],radial=new THREE.Group(),hinge=new THREE.Group(),mesh=new THREE.Mesh(petalGeometry(a,b,patch,settings,bridge),petalMat);
      const phase={value:petalPhase(a.angle)};mesh.userData.gradientPhaseUniform=phase;mesh.userData.morphUniform=this.morphUniform;mesh.userData.bridgeUniform=this.bridgeUniform;
      mesh.userData.petalPatch=patch;
      hinge.add(mesh);radial.add(hinge);this.head.add(radial);this.petals.push(hinge);this.petalMeshes.push(mesh);this.pairs.push({from:a,to:b,radial,phase});
    }
    const heartMaterial=new THREE.MeshStandardMaterial({color:'#e5b553',roughness:.65});
    const heartGeo=new THREE.SphereGeometry(1,40,24),hp=heartGeo.attributes.position;
    for(let i=0;i<hp.count;i++){const x=hp.getX(i),y=hp.getY(i),z=hp.getZ(i),r=1+.025*Math.sin(Math.atan2(z,x)*22)*Math.sin(Math.acos(Math.max(-1,Math.min(1,y)))*18);hp.setXYZ(i,x*r,y*r,z*r);}heartGeo.computeVertexNormals();
    this.heart=new THREE.Mesh(heartGeo,heartMaterial);this.heart.userData.gradientPhase=0;this.heart.position.y=.05;this.head.add(this.heart);
    const filament=new THREE.CylinderGeometry(.009,.012,1,6),tip=new THREE.SphereGeometry(.025,8,6);
    for(let i=0;i<15;i++){
      const group=new THREE.Group(),h=.23+.08*Math.sin(i*2.3),angle=i/15*Math.PI*2;
      group.position.set(.09*Math.cos(angle),.06,.09*Math.sin(angle));group.rotation.set(.34*Math.sin(angle),0,-.34*Math.cos(angle));
      const stalk=new THREE.Mesh(filament,heartMaterial);stalk.position.y=h/2;stalk.scale.y=h;stalk.userData.gradientPhase=.2;
      const anther=new THREE.Mesh(tip,heartMaterial);anther.userData.gradientPhase=.2;anther.position.y=h;group.add(stalk,anther);this.stamens.add(group);
    }
    this.head.add(this.stamens);
    const stemGeometry=new THREE.CylinderGeometry(.085,.12,1,14,48);this.stemBase=new Float32Array(stemGeometry.attributes.position.array);
    const coordinates=new Float32Array(this.stemBase.length);for(let i=0;i<coordinates.length;i+=3)coordinates.set([this.stemBase[i]*5,this.stemBase[i+1]*1.8,this.stemBase[i+2]*5],i);stemGeometry.setAttribute('elementGradientPosition',new THREE.BufferAttribute(coordinates,3));
    this.stem=new THREE.Mesh(stemGeometry,material);this.stem.userData.gradientPhase=.25;this.root.add(this.stem,this.head);this.update(0);
  }
  update(time:number,amount=0){
    const m=THREE.MathUtils.clamp(Number.isFinite(amount)?amount:0,0,1),phase=time/8*Math.PI*2,sway=.16*Math.sin(phase);
    const {variety,target}=this.settings;
    this.head.position.set(.25*Math.sin(Math.PI*1.3)+sway,.85,.06*Math.sin(phase+2));
    this.head.rotation.set(.36+.08*Math.sin(phase),.09*Math.sin(phase),-.12+.09*Math.cos(phase));
    const a=this.stem.geometry.attributes.position as THREE.BufferAttribute;
    for(let i=0;i<a.count;i++){const u=this.stemBase[i*3+1]+.5;a.setXYZ(i,this.stemBase[i*3]+.25*Math.sin(u*Math.PI*1.3)+sway*u*u,-1.9+u*2.75,this.stemBase[i*3+2]+.06*Math.sin(phase+u*2)*u);}
    a.needsUpdate=true;this.stem.geometry.computeVertexNormals();this.stem.geometry.computeBoundingSphere();
    this.morphUniform.value=m;const bridge=this.bridgeEnabled&&m>0&&m<1?Math.sin(Math.PI*m)**2:0;this.bridgeUniform.value=bridge;
    this.petals.forEach((hinge,i)=>{
      const pair=this.pairs[i],start=pair.from.angle,end=pair.to.angle;
      const delta=Math.atan2(Math.sin(end-start),Math.cos(end-start)),angle=start+delta*m,bridgeAngle=i/this.petals.length*Math.PI*2;
      pair.radial.rotation.y=angle+Math.atan2(Math.sin(bridgeAngle-angle),Math.cos(bridgeAngle-angle))*bridge;
      const fromMotion=(variety==='original'?.11:.06)+flutter(variety)*Math.sin(phase+pair.from.angle);
      const toMotion=(target==='original'?.11:.06)+flutter(target)*Math.sin(phase+pair.to.angle);
      hinge.rotation.z=THREE.MathUtils.lerp(THREE.MathUtils.lerp(fromMotion,toMotion,m),.085+.04*Math.sin(phase),bridge);
      pair.phase.value=THREE.MathUtils.lerp(THREE.MathUtils.lerp(petalPhase(pair.from.angle),petalPhase(pair.to.angle),m),petalPhase(bridgeAngle),bridge);
      // Both endpoints stay exact. The shared intermediate surface has equal
      // length, width, thickness and spacing for every participating section.
      const weights=this.petalMeshes[i].morphTargetInfluences!;
      weights[0]=m*(1-bridge);weights[1]=0;weights[2]=0;weights[3]=bridge;

    });
    const c=centerSize(variety),d=centerSize(target);this.heart.scale.set(...c.map((v,i)=>THREE.MathUtils.lerp(v,d[i],m)) as [number,number,number]);
    const stamenWeight=THREE.MathUtils.lerp(variety==='cherry'?1:0,target==='cherry'?1:0,m);this.stamens.visible=stamenWeight>0;this.stamens.scale.setScalar(stamenWeight);this.stamens.rotation.z=.045*Math.sin(phase+.5);
  }
}
