import * as THREE from 'three';
import { modelMaterial } from './model-material.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { WAVES, LIGHTS, CAUSTIC_LOOKUP } from './shaders.js';

const target=()=>new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,count:2,depthBuffer:true,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});

// Full original meshes are rasterized twice: the camera view and a mirrored
// view. Water traces these depth layers for refraction/reflection, while direct
// views retain every source triangle, UV, material and texture.
export class ModelRenderer {
  constructor(renderer,uniforms) {
    this.renderer=renderer;this.uniforms=uniforms;this.scene=new THREE.Scene();this.instances=new Map();
    this.direct=target();this.reflected=target();this.mirror=new THREE.PerspectiveCamera();
    this.projection=new THREE.Matrix4();this.raycaster=new THREE.Raycaster();
    this.lights=Array.from({length:4},()=>{const l=new THREE.SpotLight();l.decay=2;this.scene.add(l,l.target);return l;});
    Object.assign(uniforms,{
      uModelsVisible:{value:false},uModelColor:{value:this.direct.textures[0]},uModelPosition:{value:this.direct.textures[1]},
      uMirrorColor:{value:this.reflected.textures[0]},uMirrorPosition:{value:this.reflected.textures[1]},uMirrorProjection:{value:this.projection},
      uModelMin:{value:new THREE.Vector3()},uModelMax:{value:new THREE.Vector3()},
    });
  }
  resize(w,h){this.direct.setSize(w,h);this.reflected.setSize(w,h);}
  material(source,lighting) {
    const material=modelMaterial(source,lighting);material.toneMapped=false;
    material.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,this.uniforms);
      shader.vertexShader='varying vec3 vModelWorld;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
        vec4 modelPoint=vec4(transformed,1.0);
        #ifdef USE_INSTANCING
          modelPoint=instanceMatrix*modelPoint;
        #endif
        vModelWorld=(modelMatrix*modelPoint).xyz;`);
      // Three's material chunks define PI; isolate the water helper constant.
      shader.fragmentShader='varying vec3 vModelWorld;\nlayout(location=1) out vec4 modelWorldOutput;\n'+(WAVES+LIGHTS+CAUSTIC_LOOKUP).replace(/\bPI\b/g,'WATER_PI')+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
        ${material.isMeshBasicMaterial?'':`float surfaceY=wave(vModelWorld.xz).x;
        if(vModelWorld.y<surfaceY) {
          vec3 caustic=vec3(0.0);
          for(int i=0;i<4;i++)if(dot(uLightColor[i],vec3(1.0))>.001)caustic+=waterLight(i,vModelWorld);
          outgoingLight+=diffuseColor.rgb*caustic*uCausticStrength*0.12;
        } else {
          vec3 bounce=vec3(0.0);
          for(int i=0;i<4;i++)if(dot(uLightColor[i],vec3(1.0))>.001)bounce+=lightAt(i,vec3(vModelWorld.x,surfaceY,vModelWorld.z));
          outgoingLight+=diffuseColor.rgb*bounce*0.045/(1.0+max(0.0,vModelWorld.y-surfaceY));
        }
        `}
        #include <opaque_fragment>
        if(diffuseColor.a<0.01)discard;
        modelWorldOutput=vec4(vModelWorld,1.0);`);
    };
    material.customProgramCacheKey=()=>`studio-original-material-v2`;
    return material;
  }
  sync(bodies,library,lights) {
    const min=this.uniforms.uModelMin.value.set(Infinity,Infinity,Infinity),max=this.uniforms.uModelMax.value.set(-Infinity,-Infinity,-Infinity);
    const ids=new Set(bodies.map(b=>b.id));
    for(const [id,instance] of this.instances)if(!ids.has(id) || instance.lighting!==(library?.get(instance.kind)?.lighting??'studio')) {
      this.scene.remove(instance.group);for(const m of instance.materials)m.dispose();for(const skeleton of instance.skeletons)skeleton.dispose();this.instances.delete(id);
    }
    for(const body of bodies) {
      const asset=library?.get(body.kind);if(!asset)continue;
      min.min(body.position.clone().addScalar(-body.radius-.08));max.max(body.position.clone().addScalar(body.radius+.08));
      let instance=this.instances.get(body.id);
      if(!instance) {
        const group=new THREE.Group(),root=clone(asset.scene),materials=new Map(),skeletons=new Set();group.add(root);
        root.traverse(o=>{
          if(!o.isMesh)return;o.userData.bodyId=body.id;
          if(o.isSkinnedMesh)skeletons.add(o.skeleton);
          const adapt=m=>{if(!materials.has(m))materials.set(m,this.material(m,asset.lighting));return materials.get(m);};
          o.material=Array.isArray(o.material)?o.material.map(adapt):adapt(o.material);
        });
        instance={group,materials:[...materials.values()],skeletons,kind:body.kind,lighting:asset.lighting??'studio'};this.instances.set(body.id,instance);this.scene.add(group);
      }
      instance.group.position.copy(body.position);instance.group.quaternion.copy(body.rotation);instance.group.scale.setScalar(body.size);
    }
    this.lights.forEach((light,i)=>{
      const l=lights[i];light.visible=!!l?.enabled;if(!l)return;
      light.position.set(l.x,l.y,l.z);light.target.position.set(l.targetX,0,l.targetZ);
      light.color.set(l.color);light.intensity=l.intensity;light.angle=THREE.MathUtils.degToRad(l.spread/2);light.penumbra=l.softness;
    });
    this.scene.updateMatrixWorld(true);this.uniforms.uModelsVisible.value=this.instances.size>0;
  }
  render(camera) {
    if(!this.instances.size)return;
    const r=this.renderer;
    this.mirror.copy(camera);this.mirror.position.y*=-1;
    const direction=camera.getWorldDirection(new THREE.Vector3());direction.y*=-1;
    this.mirror.up.copy(camera.up);this.mirror.up.y*=-1;
    this.mirror.lookAt(this.mirror.position.clone().add(direction));this.mirror.updateMatrixWorld(true);
    this.projection.multiplyMatrices(this.mirror.projectionMatrix,this.mirror.matrixWorldInverse);
    const color=r.getClearColor(new THREE.Color()),alpha=r.getClearAlpha();
    r.setClearColor(0,0);
    r.setRenderTarget(this.direct);r.clear();r.render(this.scene,camera);
    r.setRenderTarget(this.reflected);r.clear();r.render(this.scene,this.mirror);
    r.setClearColor(color,alpha);r.setRenderTarget(null);
  }
  pick(ray,limit=100) {
    this.raycaster.ray.copy(ray);this.raycaster.near=.002;this.raycaster.far=limit;
    const hit=this.raycaster.intersectObjects([...this.instances.values()].map(i=>i.group),true)[0];
    if(!hit)return null;hit.point.bodyId=hit.object.userData.bodyId;return hit.point;
  }
}
