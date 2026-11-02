// Three.Gradient's per-element gradient, including morphing gradient coordinates.
import * as THREE from 'three';
import type { FlowerGradientSettings } from './types';
export const gradientUniforms=()=>({uColors:{value:Array.from({length:8},()=>new THREE.Color())},uStops:{value:new Float32Array(8)},uCount:{value:5},uMode:{value:0},uScale:{value:1},uSoft:{value:.85},uAngle:{value:0},uPhase:{value:0},uNoise:{value:.35},uAssetInv:{value:new THREE.Matrix4()},uElementScope:{value:1}});

/** Keep uniform objects stable: already compiled materials see live edits. */
export function setGradientUniforms(u: ReturnType<typeof gradientUniforms>, settings: FlowerGradientSettings) {
  u.uMode.value = ['bands', 'radial', 'noise'].indexOf(settings.mode)
  u.uElementScope.value = settings.scope === 'element' ? 1 : 0
  u.uScale.value = settings.scale
  u.uSoft.value = settings.softness
  u.uAngle.value = settings.direction * Math.PI / 180
  u.uNoise.value = settings.noise
  const palette = settings.palette.slice(0, 8)
  u.uCount.value = palette.length
  palette.forEach((color, index) => {
    u.uColors.value[index].set(color)
    u.uStops.value[index] = index / palette.length
  })
}

const shaderHeader=`
varying vec3 vGradientPosition; varying vec3 vElementPosition;
uniform float uElementScope; uniform float uElementPhase;
uniform vec3 uColors[8]; uniform float uStops[8]; uniform int uCount;
uniform int uMode; uniform float uScale; uniform float uSoft; uniform float uAngle; uniform float uPhase; uniform float uNoise;
float hash3(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x),mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z);}
vec3 palette(float t){
 t=fract(t);vec3 a=uColors[0],b=uColors[0];float lo=uStops[0],hi=uStops[0]+1.;
 for(int i=0;i<8;i++){if(i>=uCount)break;if(t>=uStops[i]){a=uColors[i];lo=uStops[i];if(i+1<uCount){b=uColors[i+1];hi=uStops[i+1];}else{b=uColors[0];hi=uStops[0]+1.;}}}
 if(t<uStops[0]){a=uColors[uCount-1];b=uColors[0];lo=uStops[uCount-1]-1.;hi=uStops[0];}
 float f=clamp((t-lo)/max(.0001,hi-lo),0.,1.);float w=max(.015,uSoft*.5);f=smoothstep(.5-w,.5+w,f);return mix(a,b,f);
}
`;

export function applyGradient(root: THREE.Object3D, u: ReturnType<typeof gradientUniforms>) {
  const originals = new Set<THREE.Material>();
  let elementIndex=0;root.traverse(o=>{
    if(!(o instanceof THREE.Mesh))return;const original=o.material;
    const custom=!!o.geometry.getAttribute('elementGradientPosition'),morphGradient=!!o.geometry.getAttribute('elementGradientTarget');
    const bounds=new THREE.Box3().setFromBufferAttribute(o.geometry.attributes.position as THREE.BufferAttribute),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
    const elementUniforms={uElementCenter:{value:center},uElementScale:{value:1.8/Math.max(size.x,size.y,size.z,.0001)},uElementPhase:o.userData.gradientPhaseUniform??{value:o.userData.gradientPhase??(elementIndex++*.137)%1},uPetalMorph:o.userData.morphUniform??{value:0},uPetalBridge:o.userData.bridgeUniform??{value:0}};
    const convert=(old:THREE.Material)=>{
      const originalStandard=old as THREE.MeshStandardMaterial;
      const m=new THREE.MeshStandardMaterial({roughness:.48,metalness:0,side:old.side,transparent:old.transparent,opacity:old.opacity,alphaTest:old.alphaTest,alphaMap:originalStandard.alphaMap??null});
      m.onBeforeCompile=s=>{Object.assign(s.uniforms,u,elementUniforms);
        s.vertexShader=`varying vec3 vGradientPosition; varying vec3 vElementPosition; uniform mat4 uAssetInv; uniform vec3 uElementCenter; uniform float uElementScale; ${custom?'attribute vec3 elementGradientPosition;':''} ${morphGradient?'attribute vec3 elementGradientTarget; attribute vec3 elementGradientBridge; uniform float uPetalMorph; uniform float uPetalBridge;':''}\n`+s.vertexShader;
        s.vertexShader=s.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>\nvec4 gradientVertex = vec4(transformed,1.0);\n#ifdef USE_INSTANCING\ngradientVertex = instanceMatrix * gradientVertex;\n#endif\nvGradientPosition = (uAssetInv * modelMatrix * gradientVertex).xyz;\nvElementPosition = ${morphGradient?'mix(mix(elementGradientPosition,elementGradientTarget,uPetalMorph),elementGradientBridge,uPetalBridge)':custom?'elementGradientPosition':'(transformed-uElementCenter)*uElementScale'};`);
        s.fragmentShader=shaderHeader+s.fragmentShader;
        s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
          vec3 p=mix(vGradientPosition,vElementPosition,uElementScope);float phase=uPhase+uElementPhase*uElementScope;float angle=uAngle;float coord=(p.y*cos(angle)+p.x*sin(angle))*uScale*.6;
          if(uMode==1)coord=length(p.xz)*uScale;
          float n=noise3(p*uScale*1.7+vec3(cos(phase*6.28318),sin(phase*6.28318),0.0));
          if(uMode==2)coord=n*(1.0+uNoise*2.0);else coord+=(n-.5)*uNoise*.12;
          diffuseColor.rgb=palette(coord+phase);`);
      };m.customProgramCacheKey=()=> 'three-gradient-petal-bridge-v5-'+custom+'-'+morphGradient;return m;
    };
    const gradient=Array.isArray(original)?original.map(convert):convert(original);o.material=gradient; for (const m of Array.isArray(original)?original:[original]) originals.add(m);
  });
  originals.forEach(m=>m.dispose());
}
