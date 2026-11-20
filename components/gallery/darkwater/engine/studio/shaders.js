import { MAX_RIPPLES } from './state.js';
import { MAX_SHAPES } from './shapes.js';
// Resolve the choppy, multi-band ocean once per frame, rather than repeating
// displacement inversion for every caustic, ray step and buoyancy sample.
export const SURFACE = /* glsl */`
precision highp float;
uniform sampler2D uDisp,uSlope,uSwellDisp,uSwellSlope;
uniform float uWaveStrength;
in vec2 vUv;
out vec4 outColor;
vec3 displacement(vec2 p){return (textureLod(uDisp,p/12.0,0.0).xyz+textureLod(uSwellDisp,p/24.0,0.0).xyz*.24)*uWaveStrength;}
void main(){
  vec2 p=vUv*24.0,q=p;
  for(int i=0;i<3;i++)q=p-displacement(q).xz;
  float h=displacement(q).y;
  vec2 slope=(textureLod(uSlope,q/12.0,.6).xy+textureLod(uSwellSlope,q/24.0,.6).xy*(.24*85.0/24.0))*uWaveStrength;
  float bound=1.0+h*h/4.0;
  outColor=vec4(h/sqrt(bound),slope/pow(bound,1.5),textureLod(uDisp,q/12.0,0.0).w);
}`;
// Optical building blocks adapted from Ultra-Water's OceanSurface / Caustics /
// UnderwaterPass. A bounded heightfield and finite lights replace sun and terrain.
export const WAVES = /* glsl */`
precision highp float;
precision highp int;
uniform sampler2D uSurface, uDetail;
uniform float uWaveStrength, uDetailStrength, uChoppiness;
uniform int uRippleCount,uTraceSteps;
uniform vec4 uRipples[${MAX_RIPPLES}];
uniform float uRippleSize[${MAX_RIPPLES}];
const float PI = 3.14159265359;
vec3 impact(vec2 p) {
  vec3 result = vec3(0.0);
  for (int i = 0; i < uRippleCount; i++) {
    vec4 e = uRipples[i];
    if(e.w <= 0.0) continue;
    vec2 delta = p - e.xy;
    float r = max(length(delta), 0.001), age = max(e.z, 0.0), L = max(uRippleSize[i],0.1);
    float speed=1.6+0.6*sqrt(L), width=L*0.65+0.16;
    float d=r-speed*age;
    // Outside the Gaussian support the contribution is below a tenth of a
    // millimeter. Skip expensive trig/exp work without changing visible rings.
    if(abs(d)>width*4.0 && (age>0.8 || r>L*3.0))continue;
    // An immediate crater rebounds into a mound, followed by a travelling ring.
    float q=r/L, core=exp(-q*q*1.5);
    float pulse=-exp(-age*12.0)+0.85*exp(-pow((age-0.24)/0.17,2.0));
    float h=e.w*pulse*core;
    float dh=h*(-3.0*r/(L*L));
    float envelope=exp(-d*d/(2.0*width*width));
    float fade=(1.0-exp(-age*14.0))*exp(-age*0.7);
    float k=3.5/width, phase=k*d;
    float amplitude=e.w*0.65*fade*L/(L+r);
    h+=amplitude*envelope*cos(phase);
    dh+=amplitude*envelope*((-d/(width*width)-1.0/(L+r))*cos(phase)-k*sin(phase));
    result+=vec3(h,delta/r*dh);
  }
  // Smooth saturation bounds overlapping impacts, including their derivatives.
  float bound=1.0+result.x*result.x/(0.7*0.7);
  result=vec3(result.x/sqrt(bound),result.yz/pow(bound,1.5));
  return result;
}
// Return height and slopes; rendering, caustics, picks and both physics queries
// all use this same world-space evaluation.
vec3 wave(vec2 p) {
  vec3 field=textureLod(uSurface,p/24.0,0.0).xyz;
  float h=field.x;vec2 slope=field.yz;
  slope += textureLod(uDetail, p / 2.1, 0.7).xy * uDetailStrength * 0.22;
  return vec3(h, slope) + impact(p);
}
vec3 normalAt(vec2 p) { vec3 w=wave(p); return normalize(vec3(-w.y,1.0,-w.z)); }
float hitWater(vec3 ro, vec3 rd) {
  if (abs(rd.y)<0.0001) return -1.0;
  // Restrict the solve to a slab containing all supported wave displacements.
  float a=(-2.8-ro.y)/rd.y, b=(2.8-ro.y)/rd.y;
  float lo=max(0.001,min(a,b)),hi=min(100.0,max(a,b));
  if(hi<=lo)return -1.0;
  float t=clamp(-ro.y/rd.y,lo,hi);
  for(int i=0;i<uTraceSteps;i++) {
    vec3 p=ro+rd*t,w=wave(p.xz);
    float error=p.y-w.x;
    if(abs(error)<0.002)return t;
    if(error*rd.y>0.0)hi=t;else lo=t;
    float derivative=rd.y-dot(w.yz,rd.xz);
    float candidate=t-error/(abs(derivative)<0.02?(derivative<0.0?-0.02:0.02):derivative);
    t=candidate>lo && candidate<hi?candidate:(lo+hi)*0.5;
  }
  return abs((ro+rd*t).y-wave((ro+rd*t).xz).x)<0.06?t:-1.0;
}
`;
export const LIGHTS = /* glsl */`
uniform vec3 uLightPos[4], uLightDir[4], uLightColor[4];
uniform vec4 uBeam[4]; // outer cosine, focus, edge softness, source radius
uniform float uDepth, uClarity;
vec3 absorption() { return vec3(0.18,0.075,0.035)/max(uClarity,0.15); }
vec3 lightAt(int i, vec3 p) {
  vec3 d = p-uLightPos[i];
  float dist2 = dot(d,d);
  float c = dot(normalize(d),uLightDir[i]);
  float edge = mix(0.005,0.85,uBeam[i].z);
  float cone = smoothstep(uBeam[i].x,mix(uBeam[i].x,1.0,edge),c);
  float center = pow(clamp((c-uBeam[i].x)/(1.0-uBeam[i].x),0.0,1.0),uBeam[i].y*5.0);
  return uLightColor[i]*cone*mix(1.0,center,uBeam[i].y)/max(dist2,0.3);
}
float fresnel(float cosine) { return 0.02037+0.97963*pow(1.0-clamp(cosine,0.0,1.0),5.0); }
// Schlick alone is inaccurate at the underwater critical angle. Exact dielectric
// Fresnel approaches total internal reflection continuously instead of popping.
float internalFresnel(float cosine) {
  float ci=clamp(cosine,0.0,1.0), st2=1.333*1.333*(1.0-ci*ci);
  if(st2>=1.0)return 1.0;
  float ct=sqrt(1.0-st2);
  float rs=(1.333*ci-ct)/(1.333*ci+ct);
  float rp=(ci-1.333*ct)/(ci+1.333*ct);
  return 0.5*(rs*rs+rp*rp);
}
`;
export const CAUSTIC_LOOKUP = /* glsl */`
uniform sampler2D uCausticAtlas;
uniform float uAtlasSize, uCausticStrength;
vec3 sliceLight(int i,int slice,vec3 p) {
  vec2 tile=vec2(float(i),float(slice));
  vec2 uv=p.xz/24.0+0.5;
  if(any(lessThan(uv,vec2(0.0))) || any(greaterThan(uv,vec2(1.0)))) return vec3(0.0);
  float pad=2.0/uAtlasSize;
  vec2 lo=(tile+pad)/vec2(4.0,3.0), hi=(tile+1.0-pad)/vec2(4.0,3.0);
  vec2 atlasUv=(tile+uv)/vec2(4.0,3.0);
  float radius=(0.6+uBeam[i].w*(-p.y)/max(uLightPos[i].y,0.5)*uAtlasSize/24.0)/uAtlasSize;
  vec2 off=radius/vec2(4.0,3.0);
  vec3 c=texture(uCausticAtlas,clamp(atlasUv,lo,hi)).rgb*0.4;
  c+=texture(uCausticAtlas,clamp(atlasUv+vec2(off.x,off.y),lo,hi)).rgb*0.15;
  c+=texture(uCausticAtlas,clamp(atlasUv+vec2(-off.x,off.y),lo,hi)).rgb*0.15;
  c+=texture(uCausticAtlas,clamp(atlasUv+vec2(off.x,-off.y),lo,hi)).rgb*0.15;
  c+=texture(uCausticAtlas,clamp(atlasUv-off,lo,hi)).rgb*0.15;
  return c;
}
// Ray integration already averages many samples. Keep its atlas lookup cheap;
// the visible floor uses the source-size filter above at full resolution.
vec3 volumeSlice(int i,int slice,vec3 p) {
  vec2 uv=p.xz/24.0+0.5;
  if(any(lessThan(uv,vec2(0.0))) || any(greaterThan(uv,vec2(1.0))))return vec3(0.0);
  uv=clamp(uv,vec2(1.0/uAtlasSize),vec2(1.0-1.0/uAtlasSize));
  return texture(uCausticAtlas,(vec2(float(i),float(slice))+uv)/vec2(4.0,3.0)).rgb;
}
vec3 waterLight(int i,vec3 p) {
  float d=clamp(-p.y/uDepth,0.0,1.0);
  if(d<0.25) return mix(lightAt(i,vec3(p.x,0.0,p.z))*0.98,volumeSlice(i,0,p),d/0.25);
  if(d<0.55) return mix(volumeSlice(i,0,p),volumeSlice(i,1,p),(d-0.25)/0.3);
  return mix(volumeSlice(i,1,p),volumeSlice(i,2,p),(d-0.55)/0.45);
}
`;
export const CAUSTIC_VERT = WAVES + LIGHTS + /* glsl */`
in vec3 position;
uniform int uLightIndex;
uniform float uSliceDepth;
out vec2 vOriginal;
out vec3 vEnergy;
void main() {
  vec2 xz=position.xy*24.0;
  vec3 w=wave(xz), p=vec3(xz.x,w.x,xz.y);
  vec3 n=normalize(vec3(-w.y,1.0,-w.z));
  vec3 incident=normalize(p-uLightPos[uLightIndex]);
  vec3 ray=refract(incident,n,1.0/1.333);
  float travel=max((uSliceDepth+p.y)/max(-ray.y,0.05),0.0);
  vec2 landed=p.xz+ray.xz*travel;
  float incidence=max(dot(-incident,n),0.0);
  vEnergy=lightAt(uLightIndex,p)*incidence*(1.0-fresnel(incidence))*exp(-absorption()*travel);
  vOriginal=xz;
  gl_Position=vec4(landed/12.0,0.0,1.0);
}`;
export const CAUSTIC_FRAG = /* glsl */`
precision highp float;
in vec2 vOriginal;
in vec3 vEnergy;
uniform float uAtlasSize;
out vec4 outColor;
void main() {
  vec2 a=dFdx(vOriginal), b=dFdy(vOriginal);
  float ratio=abs(a.x*b.y-a.y*b.x)*pow(uAtlasSize/24.0,2.0);
  outColor=vec4(vEnergy*min(ratio,12.0),0.0);
}`;
export const SHAPES = /* glsl */`
uniform int uShapeCount;
uniform vec4 uShapes[${MAX_SHAPES}]; // center, size
uniform vec4 uShapeRotation[${MAX_SHAPES}];
uniform int uShapeKind[${MAX_SHAPES}]; // sphere, pyramid, cube
int shapeHitIndex;
vec3 rotateQ(vec3 p,vec4 q) {return p+2.0*cross(q.xyz,cross(q.xyz,p)+q.w*p);}
vec4 planeAt(int kind,int j) {
  if(kind==2) {
    if(j==0)return vec4(1,0,0,0.5);if(j==1)return vec4(-1,0,0,0.5);
    if(j==2)return vec4(0,1,0,0.5);if(j==3)return vec4(0,-1,0,0.5);
    if(j==4)return vec4(0,0,1,0.5);return vec4(0,0,-1,0.5);
  }
  if(j==0)return vec4(0,-1,0,0.25);
  if(j==1)return vec4(1,0.5,0,0.375);if(j==2)return vec4(-1,0.5,0,0.375);
  if(j==3)return vec4(0,0.5,1,0.375);return vec4(0,0.5,-1,0.375);
}
float primitive(vec3 ro,vec3 rd,int kind,out vec3 normal) {
  if(kind==0) {
    float b=dot(ro,rd),c=dot(ro,ro)-0.25,d=b*b-c;
    if(d<0.0)return -1.0;
    float t=-b-sqrt(d);if(t<0.001)t=-b+sqrt(d);
    normal=normalize(ro+rd*t);return t;
  }
  float nearT=-1e5,farT=1e5;vec3 nearN=vec3(0),farN=vec3(0);
  for(int j=0;j<6;j++) {
    if(kind==1 && j==5)break;
    vec4 plane=planeAt(kind,j);float denom=dot(plane.xyz,rd),dist=plane.w-dot(plane.xyz,ro);
    if(abs(denom)<0.000001) {if(dist<0.0)return -1.0;continue;}
    float t=dist/denom;
    if(denom<0.0 && t>nearT){nearT=t;nearN=plane.xyz;}
    if(denom>0.0 && t<farT){farT=t;farN=plane.xyz;}
    if(nearT>farT)return -1.0;
  }
  normal=normalize(nearT>0.001?nearN:farN);return nearT>0.001?nearT:farT;
}
float hitShapes(vec3 ro,vec3 rd,float limit,out vec3 normal) {
  float nearest=limit;bool found=false;shapeHitIndex=-1;
  for(int i=0;i<uShapeCount;i++) {
    vec4 body=uShapes[i];vec3 offset=ro-body.xyz;
    // Cheap bounding sphere rejection before transforming a ray into local space.
    float along=-dot(offset,rd),radius=body.w*0.87;
    if(along+radius<0.0 || along-radius>nearest || dot(offset,offset)-along*along>radius*radius)continue;
    vec4 q=uShapeRotation[i],invQ=vec4(-q.xyz,q.w);vec3 n;
    vec3 localOrigin=rotateQ(offset,invQ)/body.w,localDirection=rotateQ(rd,invQ);
    if(uShapeKind[i]==3)continue;
    float t=primitive(localOrigin,localDirection,uShapeKind[i],n)*body.w;
    if(t>0.002 && t<nearest){nearest=t;normal=rotateQ(n,q);found=true;shapeHitIndex=i;}
  }
  return found?nearest:-1.0;
}
`;

const VIEW_COMMON = WAVES + LIGHTS + CAUSTIC_LOOKUP + SHAPES + /* glsl */`
in vec2 vUv;
uniform vec3 uBackdrop;
uniform mat4 uInverseProjection,uCameraWorld,uViewProjection;
uniform vec3 uCamera;
uniform float uFloorVisible,uScattering;
uniform sampler2D uVolume;
out vec4 outColor;
vec3 rayDirection(vec2 uv) {
  vec4 v=uInverseProjection*vec4(uv*2.0-1.0,1.0,1.0);
  return normalize((uCameraWorld*vec4(v.xyz/v.w,0.0)).xyz);
}
uniform bool uModelsVisible;
uniform sampler2D uModelColor,uModelPosition,uMirrorColor,uMirrorPosition;
uniform mat4 uMirrorProjection;
uniform vec3 uModelMin,uModelMax;
bool layerBounds(vec3 ro,vec3 rd,vec3 boundsMin,vec3 boundsMax,float limit,out float begin,out float end) {
  vec3 safe=mix(vec3(.00001),rd,greaterThan(abs(rd),vec3(.00001)));
  vec3 a=(boundsMin-ro)/safe,b=(boundsMax-ro)/safe,lo=min(a,b),hi=max(a,b);
  begin=max(.005,max(lo.x,max(lo.y,lo.z)));end=min(limit,min(hi.x,min(hi.y,hi.z)));
  return end>begin;
}
float modelLayer(vec3 ro,vec3 rd,float limit,bool reflected,bool wet,out vec4 color) {
  if(!uModelsVisible)return -1.0;
  float begin,end;if(!layerBounds(ro,rd,uModelMin,uModelMax,limit,begin,end))return -1.0;
  mat4 projection=reflected?uMirrorProjection:uViewProjection;
  // Screen-space secondary rays retain full-resolution mesh silhouettes. A
  // mirrored layer supplies reflected surfaces that the primary camera cannot see.
  float previous=begin;
  for(int i=0;i<=48;i++) {
    float f=float(i)/48.0,t=mix(begin,end,f);
    vec3 p=ro+rd*t;vec4 clip=projection*vec4(p,1.0);
    if(clip.w<=0.0)continue;
    vec2 uv=clip.xy/clip.w*.5+.5;
    if(any(lessThan(uv,vec2(0)))||any(greaterThan(uv,vec2(1)))){previous=t;continue;}
    vec4 surface=reflected?texture(uMirrorPosition,uv):texture(uModelPosition,uv);
    if(surface.w>.5) {
      float along=dot(surface.xyz-ro,rd);
      float error=length(surface.xyz-(ro+rd*along));
      if(along>0.004 && along<limit && along>=previous-.08 && along<=t+.08 && error<.07) {
        if((surface.y<wave(surface.xz).x)==wet){color=reflected?texture(uMirrorColor,uv):texture(uModelColor,uv);return along;}
      }
    }
    previous=t;
  }
  return -1.0;
}
vec3 floorColor(vec3 p) {
  if(uFloorVisible<0.5 || max(abs(p.x),abs(p.z))>10.0) return uBackdrop * 0.08;
  vec3 light=vec3(0.0);
  for(int i=0;i<4;i++) {
    if(dot(uLightColor[i],vec3(1.0))<0.001) continue;
    light+=sliceLight(i,2,p);
  }
  return light*0.12*uCausticStrength + uBackdrop * 0.08;
}
vec3 volume(vec3 origin,vec3 direction,float distance) {
  vec3 sum=vec3(0.0);
  float stepSize=min(distance,18.0)/12.0;
  for(int j=0;j<12;j++) {
    float t=(float(j)+0.5)*stepSize;
    vec3 p=origin+direction*t;
    if(p.y>0.05 || p.y < -uDepth) continue;
    for(int i=0;i<4;i++) {
      if(dot(uLightColor[i],vec3(1.0))<0.001) continue;
      vec3 ray=normalize(p-uLightPos[i]);
      float mu=dot(-direction,ray), g=0.35;
      float phase=(1.0-g*g)/(4.0*PI*pow(max(1.0+g*g-2.0*g*mu,0.1),1.5));
      sum+=waterLight(i,p)*exp(-absorption()*t)*phase*stepSize*uScattering*0.22;
    }
  }
  return sum;
}
vec3 shapeColor(vec3 p,vec3 n,vec3 view) {
  float waterY=wave(p.xz).x;
  vec3 col=vec3(0.0);bool wet=p.y<waterY;
  for(int i=0;i<4;i++) {
    if(dot(uLightColor[i],vec3(1.0))<0.001)continue;
    vec3 l=normalize(uLightPos[i]-p),h=normalize(l+view);
    vec3 illumination=wet?waterLight(i,p)*uCausticStrength:lightAt(i,p);
    float diffuse=max(dot(n,l),0.0);
    float sheen=pow(max(dot(n,h),0.0),48.0)*0.45;
    col+=illumination*(vec3(0.72,0.74,0.78)*(diffuse+0.055)/PI+sheen);
    // A restrained bounce from the illuminated water keeps satin faces readable
    // outside a spotlight cone; switching all lights off still gives black.
    if(!wet)col+=lightAt(i,vec3(p.x,waterY,p.z))*vec3(0.72,0.74,0.78)*0.045/(1.0+max(0.0,p.y-waterY));
  }
  return col;
}
vec3 throughWater(vec3 p,vec3 ray) {
  float dist=ray.y < -0.001 ? max((-uDepth-p.y)/ray.y,0.0) : 18.0;
  vec3 n;float t=hitShapes(p+ray*0.005,ray,dist,n);
  vec4 modelColor;float modelT=modelLayer(p,ray,t>0.0?t:dist,false,true,modelColor);
  if(modelT>0.0)return modelColor.rgb*exp(-absorption()*modelT);
  if(t>0.0)return shapeColor(p+ray*t,n,-ray)*exp(-absorption()*t);
  return ray.y < -0.001 ? floorColor(p+ray*dist)*exp(-absorption()*dist) : vec3(0.0);
}
vec3 solidAboveWater(vec3 p,vec3 ray,bool reflected) {
  vec3 n;float t=hitShapes(p+ray*0.005,ray,100.0,n);
  vec4 modelColor;float modelT=modelLayer(p,ray,t>0.0?t:100.0,reflected,false,modelColor);
  if(modelT>0.0)return modelColor.rgb;
  return t>0.0?shapeColor(p+ray*t,n,-ray):uBackdrop;
}
vec3 specular(vec3 p,vec3 n,vec3 view) {
  vec3 sum=vec3(0.0);
  float nv=max(dot(n,view),0.001);
  for(int i=0;i<4;i++) {
    if(dot(uLightColor[i],vec3(1.0))<0.001) continue;
    vec3 delta=uLightPos[i]-p, l=normalize(delta), h=normalize(l+view);
    float nl=max(dot(n,l),0.0), nh=max(dot(n,h),0.0), vh=max(dot(view,h),0.0);
    float rough=clamp(0.035+uBeam[i].w/length(delta)*0.7,0.035,0.45);
    float a2=rough*rough, d=nh*nh*(a2-1.0)+1.0;
    float D=a2/(PI*d*d);
    float vis=0.5/max(nl*sqrt(nv*nv*(1.0-a2)+a2)+nv*sqrt(nl*nl*(1.0-a2)+a2),0.001);
    sum+=lightAt(i,p)*D*vis*fresnel(vh)*nl;
  }
  return sum;
}
uniform bool uFluidVisible;
uniform sampler2D uFluidNormal,uFluidPosition,uFluidMirrorNormal,uFluidMirrorPosition;
uniform mat4 uFluidMirrorProjection;
uniform vec3 uFluidMin,uFluidMax;
float fluidLayer(vec3 ro,vec3 rd,float limit,bool reflected,out vec3 position,out vec3 normal) {
  if(!uFluidVisible)return -1.0;
  float begin,end;if(!layerBounds(ro,rd,uFluidMin,uFluidMax,limit,begin,end))return -1.0;
  mat4 projection=reflected?uFluidMirrorProjection:uViewProjection;
  float previous=begin;
  for(int i=0;i<=24;i++) {
    float f=float(i)/24.0,t=mix(begin,end,f);
    vec4 clip=projection*vec4(ro+rd*t,1.0);if(clip.w<=0.0)continue;
    vec2 uv=clip.xy/clip.w*.5+.5;
    if(any(lessThan(uv,vec2(0)))||any(greaterThan(uv,vec2(1)))){previous=t;continue;}
    vec4 surface=reflected?texture(uFluidMirrorPosition,uv):texture(uFluidPosition,uv);
    if(surface.w>.5) {
      float along=dot(surface.xyz-ro,rd),error=length(surface.xyz-(ro+rd*along));
      if(along>.015 && along<limit && along>=previous-.06 && along<=t+.06 && error<.055 && surface.y>wave(surface.xz).x-.025) {
        position=surface.xyz;normal=normalize((reflected?texture(uFluidMirrorNormal,uv):texture(uFluidNormal,uv)).xyz);return along;
      }
    }
    previous=t;
  }
  return -1.0;
}
vec3 fluidEnvironment(vec3 origin,vec3 ray,bool reflected) {
  if(origin.y<wave(origin.xz).x)return throughWater(origin,ray);
  float waterT=hitWater(origin,ray),limit=waterT>0.0?waterT:100.0;
  vec3 on;float ot=hitShapes(origin+ray*.005,ray,limit,on);
  vec4 mc;float mt=modelLayer(origin,ray,ot>0.0?ot:limit,reflected,false,mc);
  if(mt>0.0)return mc.rgb;
  if(ot>0.0)return shapeColor(origin+ray*ot,on,-ray);
  if(waterT>0.0) {
    vec3 waterP=origin+ray*waterT,wn=normalAt(waterP.xz);
    if(dot(wn,-ray)<0.0)wn=-wn;
    float wf=fresnel(dot(wn,-ray));
    return throughWater(waterP,refract(ray,wn,1.0/1.333))*(1.0-wf)+solidAboveWater(waterP,reflect(ray,wn),true)*wf+specular(waterP,wn,-ray);
  }
  return vec3(0.0);
}
vec3 fluidColor(vec3 p,vec3 n,vec3 rd) {
  if(dot(n,-rd)<0.0)n=-n;
  vec3 inside=refract(rd,n,1.0/1.333),exitPoint=p+inside*.16;
  // One optical bounce through the extracted surface. The bounded thickness
  // represents a local sheet; secondary rays use the original model layers.
  vec3 transmitted=fluidEnvironment(exitPoint,inside,false);
  float f=fresnel(dot(n,-rd));
  vec3 reflected=fluidEnvironment(p+reflect(rd,n)*.005,reflect(rd,n),true);
  vec3 col=mix(transmitted*exp(-absorption()*.16),reflected,f)+specular(p,n,-rd);
  for(int i=0;i<4;i++)if(dot(uLightColor[i],vec3(1.0))>.001)col+=lightAt(i,p)*vec3(.004,.008,.012)*(1.0-f);
  return col;
}
vec3 aboveWater(vec3 p,vec3 ray,bool reflected) {
  vec3 n;float limit=hitShapes(p+ray*.005,ray,100.0,n);
  vec4 modelColor;float mt=modelLayer(p,ray,limit>0.0?limit:100.0,reflected,false,modelColor);
  if(mt>0.0)limit=mt;
  vec3 fp,fn;float t=fluidLayer(p,ray,limit>0.0?limit:100.0,reflected,fp,fn);
  return t>0.0?fluidColor(fp,fn,ray):mt>0.0?modelColor.rgb:limit>0.0?shapeColor(p+ray*limit,n,-ray):uBackdrop;
}
`;
export const VIEW = VIEW_COMMON + /* glsl */`
void main() {
  vec3 rd=rayDirection(vUv), ro=uCamera;
  bool underwater=ro.y<wave(ro.xz).x;
  float t=hitWater(ro,rd);
  vec3 col=uBackdrop;
  if(!underwater) {
    if(t>0.0) {
      vec3 p=ro+rd*t, n=normalAt(p.xz);
      if(dot(n,-rd)<0.0) n=-n;
      vec3 ray=refract(rd,n,1.0/1.333);
      float f=fresnel(dot(n,-rd));
      col=throughWater(p,ray)*(1.0-f)+aboveWater(p,reflect(rd,n),true)*f+specular(p,n,-rd);
      col=mix(col,uBackdrop,smoothstep(10.0,15.0,max(abs(p.x),abs(p.z))));
    }
  } else {
    float floorT=rd.y < -0.001 ? (-uDepth-ro.y)/rd.y : 100.0;
    if(t>0.0 && t<floorT) {
      vec3 p=ro+rd*t, n=-normalAt(p.xz);
      if(dot(n,-rd)<0.0) n=-n;
      vec3 exitRay=refract(rd,n,1.333);
      float f=internalFresnel(dot(n,-rd));
      col=throughWater(p,reflect(rd,n))*f;
      if(f<1.0)col+=aboveWater(p,exitRay,false)*(1.0-f);
      if(f<1.0) for(int i=0;i<4;i++) {
        vec3 delta=uLightPos[i]-p;
        float radius=max(uBeam[i].w,0.035)/length(delta);
        float alignment=dot(exitRay,normalize(delta));
        col+=lightAt(i,p)*(1.0-f)*smoothstep(cos(radius*1.8),cos(radius*0.5),alignment)*3.0;
      }
      col=col*exp(-absorption()*t);
    } else col=throughWater(ro,rd);
  }
  vec3 objectNormal;
  float objectT=hitShapes(ro,rd,t>0.0?t:100.0,objectNormal);
  vec3 fog=texture(uVolume,vUv).rgb;
  if(objectT>0.0) {
    col=shapeColor(ro+rd*objectT,objectNormal,-rd);
    if(underwater)col*=exp(-absorption()*objectT);else fog=vec3(0.0);
  }
  if(uModelsVisible) {
    vec4 model=texture(uModelPosition,vUv);
    float modelT=dot(model.xyz-ro,rd),limit=objectT>0.0?objectT:t>0.0?t:100.0;
    if(underwater && rd.y<-.001)limit=min(limit,(-uDepth-ro.y)/rd.y);
    if(model.w>.5 && modelT>0.0 && modelT<limit) {
      vec4 shade=texture(uModelColor,vUv);
      if(underwater)shade.rgb*=exp(-absorption()*modelT);else fog=vec3(0.0);
      col=shade.rgb+col*(1.0-shade.a);objectT=modelT;
    }
  }
  if(uFluidVisible && !underwater) {
    vec4 fluid=texture(uFluidPosition,vUv);
    float fluidT=dot(fluid.xyz-ro,rd),limit=objectT>0.0?objectT:t>0.0?t:100.0;
    if(fluid.w>.5 && fluidT>0.0 && fluidT<limit && fluid.y>wave(fluid.xz).x-.025) {
      col=fluidColor(fluid.xyz,normalize(texture(uFluidNormal,vUv).xyz),rd);fog=vec3(0.0);objectT=fluidT;
    }
  }
  col+=fog;
  float depthT=objectT>0.0?objectT:t>0.0?t:100.0;
  if(underwater && rd.y< -0.001)depthT=min(depthT,(-uDepth-ro.y)/rd.y);
  vec4 clip=uViewProjection*vec4(ro+rd*depthT,1.0);
  gl_FragDepth=clamp(clip.z/clip.w*0.5+0.5,0.0,1.0);
  outColor=vec4(max(col,vec3(0.0)),1.0);
}`;
// Scattering is smooth and expensive, so integrate it at half resolution. The
// full-resolution surface keeps fine glints, normals, refraction, and caustics.
export const VOLUME = VIEW_COMMON + /* glsl */`
void main() {
  vec3 ro=uCamera,rd=rayDirection(vUv),col=vec3(0.0);
  float t=hitWater(ro,rd);
  if(ro.y < wave(ro.xz).x) {
    float floorT=rd.y < -0.001 ? max((-uDepth-ro.y)/rd.y,0.0) : 100.0;
    float dist=t>0.0 ? min(t,floorT) : floorT;
    vec3 n;float objectT=hitShapes(ro,rd,dist,n);
    col=volume(ro,rd,objectT>0.0?objectT:dist);
  } else if(t>0.0) {
    vec3 p=ro+rd*t,n=normalAt(p.xz);
    if(dot(n,-rd)<0.0)n=-n;
    vec3 ray=refract(rd,n,1.0/1.333);
    float dist=ray.y < -0.001 ? max((-uDepth-p.y)/ray.y,0.0) : 18.0;
    vec3 objectNormal;float objectT=hitShapes(p+ray*0.005,ray,dist,objectNormal);
    col=volume(p,ray,objectT>0.0?objectT:dist)*(1.0-fresnel(dot(n,-rd)));
    col*=1.0-smoothstep(10.0,15.0,max(abs(p.x),abs(p.z)));
  }
  outColor=vec4(col,1.0);
}`;
export const PICK = WAVES + SHAPES + /* glsl */`
uniform vec3 uRayOrigin,uRayDirection;
uniform bool uPickObjects;
uniform float uDepth;
out vec4 outColor;
void pickScene(){
  vec3 ro=uRayOrigin,rd=uRayDirection;
  float t=hitWater(ro,rd);
  vec3 p=ro+rd*t;
  outColor=vec4(p,t>0.0 && max(abs(p.x),abs(p.z))<10.0 ? 1.0 : 0.0);
  if(!uPickObjects)return;
  vec3 n;float limit=t>0.0?t:100.0;
  bool submerged=ro.y<wave(ro.xz).x;
  if(submerged && rd.y< -0.001)limit=min(limit,(-uDepth-ro.y)/rd.y);
  float objectT=hitShapes(ro,rd,limit,n);
  if(objectT>0.0) {outColor=vec4(ro+rd*objectT,float(shapeHitIndex+2));return;}
  // Pick the visible submerged surface along the same refracted ray as VIEW.
  // Reflections intentionally remain water interactions, not duplicate handles.
  if(t>0.0) {
    n=normalAt(p.xz);if(dot(n,-rd)<0.0)n=-n;
    vec3 ray=refract(rd,n,submerged?1.333:1.0/1.333);
    if(length(ray)<0.001)return;
    vec3 origin=p+ray*0.005;
    float floorT=!submerged && ray.y< -0.001?max((-uDepth-p.y)/ray.y,0.0):100.0;
    objectT=hitShapes(origin,ray,floorT,n);
    if(objectT>0.0)outColor=vec4(origin+ray*objectT,float(shapeHitIndex+2));
  }
}
void main(){
  if(gl_FragCoord.x<1.0){pickScene();return;}
  vec3 ro=uRayOrigin,rd=uRayDirection;float t=hitWater(ro,rd);
  vec3 p=ro+rd*t,n=normalAt(p.xz);if(dot(n,-rd)<0.0)n=-n;
  outColor=gl_FragCoord.x<2.0?vec4(n,ro.y<wave(ro.xz).x?1.0:0.0):vec4(p,t);
}`;

export const HEIGHT_QUERY = WAVES + /* glsl */`
uniform sampler2D uQueries;
out vec4 outColor;
void main() {
  vec2 point=texelFetch(uQueries,ivec2(gl_FragCoord.xy),0).xy;
  outColor=vec4(wave(point),1.0);
}`;
