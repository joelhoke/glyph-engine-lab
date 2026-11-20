import * as THREE from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { FLUID_SUPPORT } from './fluid.js';

const VERT=/* glsl */`
precision highp float;
in vec3 position,normal;
uniform mat4 modelMatrix,viewMatrix,projectionMatrix;
out vec3 vWorld,vNormal;
void main(){
  vec4 p=vec4(position,1.0);vec3 n=normal;
  #ifdef USE_INSTANCING
    p=instanceMatrix*p;n=mat3(instanceMatrix)*n;
  #endif
  vWorld=(modelMatrix*p).xyz;vNormal=normalize(mat3(modelMatrix)*n);
  gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.0);
}`;
const FRAG=/* glsl */`
precision highp float;
in vec3 vWorld,vNormal;
layout(location=0) out vec4 surfaceNormal;
layout(location=1) out vec4 surfacePosition;
void main(){surfaceNormal=vec4(normalize(vNormal),0.16);surfacePosition=vec4(vWorld,1.0);}`;
const target=()=>new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,count:2,depthBuffer:true,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});

// Connected components keep distant splashes from sharing one huge, coarse
// extraction grid. Isolated droplets use real 3D geometry, never billboards.
export function fluidClusters(particles) {
  const cells=new Map(),cellSize=FLUID_SUPPORT*1.8;
  const key=(x,y,z)=>`${x},${y},${z}`;
  for(const p of particles){const k=key(Math.floor(p.x/cellSize),Math.floor(p.y/cellSize),Math.floor(p.z/cellSize));if(!cells.has(k))cells.set(k,[]);cells.get(k).push(p);}
  const clusters=[];
  while(cells.size) {
    const first=cells.keys().next().value,queue=[first],cluster=[];
    cluster.push(...cells.get(first));cells.delete(first);
    for(let index=0;index<queue.length;index++) {
      const [cx,cy,cz]=queue[index].split(',').map(Number);
      for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++) {
        const k=key(cx+x,cy+y,cz+z),cell=cells.get(k);
        if(cell){cluster.push(...cell);cells.delete(k);queue.push(k);}
      }
    }
    clusters.push(cluster);
  }
  return clusters.sort((a,b)=>b.length-a.length);
}

export class StudioSplash {
  constructor(uniforms) {
    this.scene=new THREE.Scene();this.direct=target();this.reflected=target();this.mirror=new THREE.PerspectiveCamera();
    this.projection=new THREE.Matrix4();this.revision=-1;this.generation=-1;this.lastUpdate=-Infinity;
    const material=new THREE.RawShaderMaterial({glslVersion:THREE.GLSL3,vertexShader:VERT,fragmentShader:FRAG,side:THREE.DoubleSide});
    this.surfaces=Array.from({length:4},()=>{
      const mesh=new MarchingCubes(40,material,false,false,24000);mesh.isolation=.6;mesh.frustumCulled=false;mesh.visible=false;this.scene.add(mesh);return mesh;
    });
    const dropletMaterial=material.clone();dropletMaterial.vertexShader='precision highp float;\nin mat4 instanceMatrix;\n'+VERT;
    dropletMaterial.defines={USE_INSTANCING:''};
    this.droplets=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),dropletMaterial,1200);
    this.droplets.frustumCulled=false;this.droplets.count=0;this.scene.add(this.droplets);
    Object.assign(uniforms,{uFluidVisible:{value:false},uFluidNormal:{value:this.direct.textures[0]},uFluidPosition:{value:this.direct.textures[1]},
      uFluidMin:{value:new THREE.Vector3()},uFluidMax:{value:new THREE.Vector3()},
      uFluidMirrorNormal:{value:this.reflected.textures[0]},uFluidMirrorPosition:{value:this.reflected.textures[1]},uFluidMirrorProjection:{value:this.projection}});
    this.uniforms=uniforms;
  }
  resize(w,h){this.direct.setSize(w,h);this.reflected.setSize(w,h);}
  update(fluid) {
    if(this.generation!==fluid.generation){this.generation=fluid.generation;this.lastUpdate=-Infinity;}
    this.uniforms.uFluidVisible.value=fluid.particles.length>0;
    if(this.revision===fluid.revision || (fluid.particles.length && fluid.time-this.lastUpdate<1/30))return;
    this.revision=fluid.revision;this.lastUpdate=fluid.time;
    const min=this.uniforms.uFluidMin.value.set(Infinity,Infinity,Infinity),max=this.uniforms.uFluidMax.value.set(-Infinity,-Infinity,-Infinity);
    for(const p of fluid.particles){min.min(new THREE.Vector3(p.x,p.y,p.z));max.max(new THREE.Vector3(p.x,p.y,p.z));}
    min.addScalar(-FLUID_SUPPORT);max.addScalar(FLUID_SUPPORT);
    for(const mesh of this.surfaces)mesh.visible=false;
    this.droplets.count=0;const matrix=new THREE.Matrix4();
    let slot=0;
    for(const cluster of fluidClusters(fluid.particles)) {
      if(slot>=4 || cluster.length<5) {
        for(const p of cluster){matrix.makeScale(.065,.065,.065);matrix.setPosition(p.x,p.y,p.z);this.droplets.setMatrixAt(this.droplets.count++,matrix);}
        continue;
      }
      const mesh=this.surfaces[slot++],resolution=fluid.budget<800?32:40;
      // init replaces vertex attributes; dispose their previous GPU buffers.
      if(mesh.resolution!==resolution){mesh.geometry.dispose();mesh.init(resolution);}
      mesh.isolation=.6;mesh.reset();mesh.visible=true;
      const lo=new THREE.Vector3(Infinity,Infinity,Infinity),hi=new THREE.Vector3(-Infinity,-Infinity,-Infinity);
      for(const p of cluster){lo.min(new THREE.Vector3(p.x,p.y,p.z));hi.max(new THREE.Vector3(p.x,p.y,p.z));}
      const extent=hi.clone().sub(lo),side=Math.ceil((Math.max(extent.x,extent.y,extent.z)+FLUID_SUPPORT*4)/.25)*.25;
      mesh.position.copy(lo).add(hi).multiplyScalar(.5);mesh.scale.setScalar(side/2);
      const n=resolution,dx=side/n,start=mesh.position.clone().addScalar(-side/2),r=FLUID_SUPPORT,r2=r*r;
      for(const p of cluster) {
        const cx=(p.x-start.x)/dx,cy=(p.y-start.y)/dx,cz=(p.z-start.z)/dx,reach=r/dx;
        for(let z=Math.max(1,Math.floor(cz-reach));z<=Math.min(n-2,Math.ceil(cz+reach));z++)for(let y=Math.max(1,Math.floor(cy-reach));y<=Math.min(n-2,Math.ceil(cy+reach));y++)for(let x=Math.max(1,Math.floor(cx-reach));x<=Math.min(n-2,Math.ceil(cx+reach));x++) {
          const d2=((x-cx)**2+(y-cy)**2+(z-cz)**2)*dx*dx;
          if(d2<r2)mesh.field[x+y*n+z*n*n]+=(1-d2/r2)**3;
        }
      }
      mesh.update();mesh.geometry.setDrawRange(0,Math.min(mesh.count,mesh.geometry.attributes.position.count));
    }
    this.droplets.instanceMatrix.needsUpdate=true;
  }
  render(renderer,camera) {
    if(!this.uniforms.uFluidVisible.value)return;
    this.mirror.copy(camera);this.mirror.position.y*=-1;
    const direction=camera.getWorldDirection(new THREE.Vector3());direction.y*=-1;
    this.mirror.up.copy(camera.up);this.mirror.up.y*=-1;this.mirror.lookAt(this.mirror.position.clone().add(direction));this.mirror.updateMatrixWorld(true);
    this.projection.multiplyMatrices(this.mirror.projectionMatrix,this.mirror.matrixWorldInverse);
    const color=renderer.getClearColor(new THREE.Color()),alpha=renderer.getClearAlpha();renderer.setClearColor(0,0);
    renderer.setRenderTarget(this.direct);renderer.clear();renderer.render(this.scene,camera);
    renderer.setRenderTarget(this.reflected);renderer.clear();renderer.render(this.scene,this.mirror);
    renderer.setClearColor(color,alpha);renderer.setRenderTarget(null);
  }
}
