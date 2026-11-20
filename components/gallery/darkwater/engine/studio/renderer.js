import * as THREE from 'three';
import { OceanSim, defaultOceanParams } from '../water/OceanSim.js';
import { PostFX } from '../engine/PostFX.js';
import { FullscreenQuad, rawPass } from '../engine/fullscreen.js';
import { SURFACE, CAUSTIC_VERT, CAUSTIC_FRAG, VIEW, VOLUME, PICK, HEIGHT_QUERY } from './shaders.js';

import { MAX_RIPPLES } from './state.js';
import { MAX_SHAPES, SHAPE_TYPES } from './shapes.js';
import { StudioSplash } from './splash.js';
import { FluidSystem } from './fluid.js';
import { ModelRenderer } from './model-renderer.js';

const uniform = value => ({ value });
export class StudioRenderer {
  time = 0;
  dirty = true;
  pickPending = false;
  constructor(renderer, camera, settings, lights, ripples, shapes, models) {
    Object.assign(this, { renderer, camera, settings, lights, ripples, shapes, models });
    this.ocean = new OceanSim(renderer, { ...defaultOceanParams(), windSpeed: 5, fetchKm: 20, swellScale: .18, waveScale: 1, timeScale: 1 });
    this.post = new PostFX(renderer);
    Object.assign(this.post.params, { autoExposure: false, contrast: 1.04, saturation: 1.15, bloomThreshold: 0.8 });
    this.hdr = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: true });
    this.volumeTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
    this.atlas = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter });
    this.pickTarget = new THREE.WebGLRenderTarget(3, 1, { type: THREE.FloatType, depthBuffer: false });
    this.surfaceTarget=new THREE.WebGLRenderTarget(512,512,{type:THREE.HalfFloatType,depthBuffer:false,wrapS:THREE.RepeatWrapping,wrapT:THREE.RepeatWrapping,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});
    this.uniforms = {
      uBackdrop: uniform(new THREE.Color()),
      uDisp: uniform(null), uSlope: uniform(null), uDetail: uniform(null),
      uSwellDisp: uniform(null), uSwellSlope: uniform(null),
      uSurface: uniform(this.surfaceTarget.texture),
      uWaveStrength: uniform(1), uDetailStrength: uniform(1), uChoppiness: uniform(1),
      uRippleCount: uniform(0),uTraceSteps:uniform(8),
      uRipples: uniform(Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector4())),
      uRippleSize: uniform(Array(MAX_RIPPLES).fill(0.3)),
      uRippleExtra: uniform(Array.from({length:MAX_RIPPLES},()=>new THREE.Vector2())),
      uShapeCount: uniform(0),
      uShapes: uniform(Array.from({length:MAX_SHAPES},()=>new THREE.Vector4())),
      uShapeRotation: uniform(Array.from({length:MAX_SHAPES},()=>new THREE.Vector4(0,0,0,1))),
      uShapeKind: uniform(Array(MAX_SHAPES).fill(0)),
      uPickObjects: uniform(false),
      uViewProjection: uniform(new THREE.Matrix4()),
      uLightPos: uniform(Array.from({ length: 4 }, () => new THREE.Vector3())),
      uLightDir: uniform(Array.from({ length: 4 }, () => new THREE.Vector3(0,-1,0))),
      uLightColor: uniform(Array.from({ length: 4 }, () => new THREE.Color(0,0,0))),
      uBeam: uniform(Array.from({ length: 4 }, () => new THREE.Vector4())),
      uDepth: uniform(3), uClarity: uniform(1), uScattering: uniform(0.5), uFloorVisible: uniform(1),
      uCausticStrength: uniform(1), uCausticAtlas: uniform(this.atlas.texture), uAtlasSize: uniform(384),
      uCamera: uniform(camera.position), uInverseProjection: uniform(camera.projectionMatrixInverse), uCameraWorld: uniform(camera.matrixWorld),
      uLightIndex: uniform(0), uSliceDepth: uniform(3),
      uRayOrigin: uniform(new THREE.Vector3()), uRayDirection: uniform(new THREE.Vector3()),
      uVolume: uniform(this.volumeTarget.texture),
    };
    this.meshModels=new ModelRenderer(renderer,this.uniforms);
    this.surfacePass=new FullscreenQuad(rawPass(SURFACE,this.uniforms));
    this.view = new FullscreenQuad(rawPass(VIEW, this.uniforms,{depthTest:true,depthWrite:true,depthFunc:THREE.AlwaysDepth}));
    this.splash = new StudioSplash(this.uniforms);
    this.fluid = new FluidSystem();
    this.fluidQueryInput=new THREE.DataTexture(new Float32Array(1200*4),1200,1,THREE.RGBAFormat,THREE.FloatType);
    this.fluidQueryTarget=new THREE.WebGLRenderTarget(1200,1,{type:THREE.FloatType,depthBuffer:false});
    this.fluidQueryPass=new FullscreenQuad(rawPass(HEIGHT_QUERY,{...this.uniforms,uQueries:uniform(this.fluidQueryInput)}));
    this.fluidQueryPending=false;this.lastFluidQuery=-Infinity;
    this.queryInput=new THREE.DataTexture(new Float32Array(1024*4),1024,1,THREE.RGBAFormat,THREE.FloatType);
    this.queryTarget=new THREE.WebGLRenderTarget(1024,1,{type:THREE.FloatType,depthBuffer:false});
    this.queryPass=new FullscreenQuad(rawPass(HEIGHT_QUERY,{...this.uniforms,uQueries:uniform(this.queryInput)}));
    this.queryPending=false;
    this.pickQueue=Promise.resolve();
    this.volume = new FullscreenQuad(rawPass(VOLUME, this.uniforms));
    this.picker = new FullscreenQuad(rawPass(PICK, this.uniforms));
    this.causticMaterial = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: CAUSTIC_VERT, fragmentShader: CAUSTIC_FRAG,
      uniforms: this.uniforms, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    });
    this.causticMesh = new THREE.Mesh(new THREE.PlaneGeometry(1,1,160,160), this.causticMaterial);
    this.causticMesh.frustumCulled = false;
    this.passCamera = new THREE.Camera();
    this.setCausticQuality(settings.causticQuality);
  }
  setCausticQuality(size) {
    this.atlas.setSize(size*4,size*3);
    this.uniforms.uAtlasSize.value = size;
    this.causticMesh.geometry.dispose();
    const grid = size >= 512 ? 192 : size >= 384 ? 160 : 112;
    this.causticMesh.geometry = new THREE.PlaneGeometry(1,1,grid,grid);
    this.dirty = true;
  }
  resize(width,height) {
    this.hdr.setSize(width,height);
    this.meshModels.resize(width,height);
    this.splash.resize(width,height);
    this.volumeTarget.setSize(Math.max(1,Math.floor(width/2)),Math.max(1,Math.floor(height/2)));
    this.post.setSize(width,height);
  }
  sync() {
    const u = this.uniforms, s = this.settings;
    u.uWaveStrength.value = s.waveStrength;
    u.uDetailStrength.value = s.detail;
    u.uChoppiness.value = s.choppiness;
    u.uDepth.value = s.floorDepth;
    u.uClarity.value = s.clarity;
    u.uScattering.value = s.scattering;
    u.uFloorVisible.value = +s.floorVisible;
    u.uCausticStrength.value = s.caustics;
    if(this.ocean.params.windDirection !== s.direction) {
      this.ocean.params.windDirection = s.direction;
      this.ocean.dirty = true;
    }
    this.ocean.params.choppiness = s.choppiness;
    for(let i=0;i<4;i++) {
      const l = this.lights.lights[i];
      u.uLightColor.value[i].setRGB(0,0,0);
      if(!l) continue;
      l.y = Math.max(0.6,l.y);
      u.uLightPos.value[i].set(l.x,l.y,l.z);
      u.uLightDir.value[i].set(l.targetX,0,l.targetZ).sub(u.uLightPos.value[i]).normalize();
      u.uLightColor.value[i].set(l.color).multiplyScalar(l.enabled ? l.intensity : 0);
      u.uBeam.value[i].set(Math.cos(THREE.MathUtils.degToRad(l.spread/2)),l.focus,l.softness,l.size);
    }
    const active = this.ripples.active(this.time);
    u.uRippleCount.value=active.length;
    for(let i=0;i<MAX_RIPPLES;i++) {
      const e = active[i];
      u.uRipples.value[i].set(e?.x ?? 0,e?.z ?? 0,e ? this.time-e.time : 0,e?.strength ?? 0);
      u.uRippleSize.value[i] = e?.radius ?? 0.3;
      u.uRippleExtra.value[i].set(e?.y ?? 0,e?.spray ?? 0);
    }
    u.uShapeCount.value=this.shapes.bodies.length;
    this.shapes.bodies.forEach((b,i)=>{
      u.uShapes.value[i].set(b.position.x,b.position.y,b.position.z,b.size);
      u.uShapeRotation.value[i].copy(b.rotation);
      const kind=SHAPE_TYPES.indexOf(b.kind);
      u.uShapeKind.value[i]=kind<0?3:kind;
    });
    this.meshModels.sync(this.shapes.bodies,this.models,this.lights.lights);
    this.post.params.exposure = s.exposure;
    this.post.params.bloomStrength = s.bloom;
    this.post.params.freezeDither = s.paused || s.speed === 0;
  }
  renderCaustics() {
    const r=this.renderer, size=this.uniforms.uAtlasSize.value;
    const previousViewport=r.getViewport(new THREE.Vector4());
    r.setRenderTarget(this.atlas);
    r.setScissorTest(false);
    r.setClearColor(0x000000,0);
    r.clear();
    r.setScissorTest(true);
    for(let i=0;i<this.lights.lights.length;i++) {
      const l = this.lights.lights[i];
      if(!l.enabled || !l.intensity) continue;
      this.uniforms.uLightIndex.value = i;
      for(let slice=0;slice<3;slice++) {
        this.uniforms.uSliceDepth.value = this.settings.floorDepth*[0.25,0.55,1][slice];
        r.setViewport(i*size,slice*size,size,size);
        r.setScissor(i*size,slice*size,size,size);
        r.render(this.causticMesh,this.passCamera);
      }
    }
    r.setScissorTest(false);
    r.setRenderTarget(null);
    r.setViewport(previousViewport);
  }
  render(dt) {
    const simDt = this.settings.paused ? 0 : Math.min(dt,0.05)*this.settings.speed;
    this.time += simDt;
    this.shapes.step(simDt,this.settings.floorDepth,event=>{
      this.ripples.add(event.x,event.z,this.time,event.radius,event.strength,false,{y:event.y,spray:1,bodyId:event.bodyId});
    });
    this.fluid.sync(this.ripples,this.time,this.shapes.bodies,simDt>0);
    this.fluid.step(simDt,this.shapes.bodies,this.settings.floorDepth,event=>{
      // Surface feedback carries no spray, preventing a self-amplifying loop.
      this.ripples.add(event.x,event.z,this.time,event.radius,event.strength,false,{y:event.y,spray:0,feedback:true});
    });
    this.splash.update(this.fluid);
    this.sync();
    if(simDt>0 || this.dirty) {
      this.ocean.update(simDt);
      this.uniforms.uDisp.value = this.ocean.displacement[2];
      this.uniforms.uSlope.value = this.ocean.slope[2];
      this.uniforms.uDetail.value = this.ocean.slope[3];
      this.uniforms.uSwellDisp.value = this.ocean.displacement[1];
      this.uniforms.uSwellSlope.value = this.ocean.slope[1];
      this.surfacePass.render(this.renderer,this.surfaceTarget);
      this.renderer.setRenderTarget(null);
      this.renderCaustics();
      this.dirty=false;
    }
    if(simDt>0){this.submitHeights();this.submitFluidHeights();}
    this.camera.updateMatrixWorld();
    this.uniforms.uViewProjection.value.multiplyMatrices(this.camera.projectionMatrix,this.camera.matrixWorldInverse);
    this.meshModels.render(this.camera);
    this.splash.render(this.renderer,this.camera);
    this.volume.render(this.renderer,this.volumeTarget);
    this.view.render(this.renderer,this.hdr);
    this.post.render(this.hdr.texture,simDt);
    this.renderer.setRenderTarget(null);
  }
  submitFluidHeights() {
    if(this.fluidQueryPending || !this.fluid.particles.length || this.time-this.lastFluidQuery<.05)return;
    const query=this.fluid.query(),count=query.ids.length;
    for(let i=0;i<count;i++)this.fluidQueryInput.image.data.set([query.points[i*2],query.points[i*2+1],0,0],i*4);
    this.fluidQueryInput.needsUpdate=true;this.fluidQueryPass.render(this.renderer,this.fluidQueryTarget);
    this.renderer.setRenderTarget(null);this.fluidQueryPending=true;this.lastFluidQuery=this.time;
    const result=new Float32Array(count*4);
    this.renderer.readRenderTargetPixelsAsync(this.fluidQueryTarget,0,0,count,1,result)
      .then(()=>this.fluid.ingest(query,result))
      .catch(error=>console.warn('Fluid water sample unavailable',error))
      .finally(()=>{this.fluidQueryPending=false;});
  }
  submitHeights() {
    if(this.queryPending || !this.shapes.bodies.length)return;
    const query=this.shapes.query(),count=query.points.length/2;
    for(let i=0;i<count;i++)this.queryInput.image.data.set([query.points[i*2],query.points[i*2+1],0,0],i*4);
    this.queryInput.needsUpdate=true;this.queryPass.render(this.renderer,this.queryTarget);
    this.renderer.setRenderTarget(null);this.queryPending=true;
    const result=new Float32Array(count*4);
    this.renderer.readRenderTargetPixelsAsync(this.queryTarget,0,0,count,1,result)
      .then(()=>this.shapes.ingest(query,result))
      .catch(error=>console.warn('Water sample unavailable',error))
      .finally(()=>{this.queryPending=false;});
  }
  pick(ray,queued=false,objects=false) {
    if(!queued && this.pickPending)return Promise.resolve(null);
    // Discrete drops queue; a drag may skip a frame instead of building a backlog.
    const result=this.pickQueue.then(()=>this.performPick(ray,objects));
    this.pickQueue=result.catch(()=>null);
    return result;
  }
  async performPick(ray,objects) {
    this.pickPending=true;
    try {
      this.sync();
      const ids=this.shapes.bodies.map(body=>body.id);
      this.uniforms.uPickObjects.value=objects;
      this.uniforms.uRayOrigin.value.copy(ray.origin);
      this.uniforms.uRayDirection.value.copy(ray.direction);
      this.picker.render(this.renderer,this.pickTarget);
      this.renderer.setRenderTarget(null);
      const data = new Float32Array(12);
      await this.renderer.readRenderTargetPixelsAsync(this.pickTarget,0,0,3,1,data);
      const hit=data[3]>.5?new THREE.Vector3(data[0],data[1],data[2]):null;
      if(hit && data[3]>1.5)hit.bodyId=ids[Math.round(data[3])-2];
      if(!objects || !this.meshModels.instances.size)return hit;
      const waterT=data[11],submerged=data[7]>.5;
      let limit=waterT>0?waterT:100;
      if(submerged && ray.direction.y<-.001)limit=Math.min(limit,(-this.settings.floorDepth-ray.origin.y)/ray.direction.y);
      const hitDistance=hit?hit.distanceTo(ray.origin):Infinity;
      const direct=this.meshModels.pick(ray,Math.min(limit,hitDistance));
      if(direct)return direct;
      if(hit?.bodyId!==undefined && hitDistance<limit-.01)return hit;
      if(waterT>0) {
        const normal=new THREE.Vector3().fromArray(data,4),eta=submerged?1.333:1/1.333;
        const dot=normal.dot(ray.direction),k=1-eta*eta*(1-dot*dot);
        if(k>=0) {
          const direction=ray.direction.clone().multiplyScalar(eta).addScaledVector(normal,-eta*dot-Math.sqrt(k)).normalize();
          const origin=new THREE.Vector3().fromArray(data,8).addScaledVector(direction,.005);
          let far=!submerged && direction.y<-.001?Math.max(0,(-this.settings.floorDepth-origin.y)/direction.y):100;
          if(hit?.bodyId!==undefined)far=Math.min(far,origin.distanceTo(hit));
          const refracted=this.meshModels.pick(new THREE.Ray(origin,direction),far);
          if(refracted)return refracted;
        }
      }
      return hit;
    } finally { this.pickPending=false; }
  }
}
