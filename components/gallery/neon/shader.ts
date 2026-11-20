export const vertex = `attribute vec2 position; void main(){gl_Position=vec4(position,0.,1.);}`;
export const fragment = `
precision highp float;
uniform vec2 resolution;
uniform float time, shape, distortion, noiseAmount, noiseScale, glow, grain, mode, seed, zoom;
uniform sampler2D textMask;
uniform float textMode;
uniform vec3 color0,color1,color2,color3,background;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){return .57*noise(p)+.28*noise(p*2.03)+.15*noise(p*4.01);}
vec3 palette(float t){t=fract(t);if(t<.25)return mix(color0,color1,smoothstep(0.,.25,t));if(t<.5)return mix(color1,color2,smoothstep(.25,.5,t));if(t<.75)return mix(color2,color3,smoothstep(.5,.75,t));return mix(color3,color0,smoothstep(.75,1.,t));}
float boundary(float a){
 if(shape<.5)return 1.;
 if(shape<1.5)return pow(pow(abs(cos(a)),5.)+pow(abs(sin(a)),5.),-.2)*.86;
 if(shape<2.5){float sector=6.2831853/3.;return .62/cos(mod(a-1.5707963+sector*.5,sector)-sector*.5);}
 if(shape<3.5)return .91/(abs(cos(a))+abs(sin(a)));
 if(shape<4.5){float sector=6.2831853/6.;return .86/cos(mod(a+sector*.5,sector)-sector*.5);}
 return .79+.21*cos(5.*(a-1.5707963));
}
void main(){
 vec2 p=(gl_FragCoord.xy-.5*resolution)/min(resolution.x,resolution.y)*2.4/zoom;
 float t=time; float a=atan(p.y,p.x); float len=length(p);
 float edge=boundary(a); float bend=sin(a*3.+t*.55+seed)*.055+sin(a*7.-t*.4)*.026;
 float r=len/(edge+distortion*bend*2.8); float radius=.86; float d=r-radius;
 float mask=1.-smoothstep(-.004,.006,d);
 vec3 bg=background; bg+=vec3(.006,.008,.014)*exp(-length(p)*1.8);
 float halo=exp(-abs(d)*16.)*glow*.14;
 vec3 col=bg+color0*halo;
 if(textMode>.5){
   // Fit a 2:1 typography plane within either a wide or portrait preview.
   float fit=min(resolution.x*.86,resolution.y*1.8);
   vec2 uv=(gl_FragCoord.xy-.5*resolution)/vec2(fit,fit*.5)/zoom;
   uv.y=-uv.y;
   vec2 warped=uv;
   warped.x+=sin(uv.y*13.+t*.65)*distortion*.016;
   warped.y+=sin(uv.x*15.-t*.8)*distortion*.024;
   vec2 tex=warped+.5;
   float inBounds=step(0.,tex.x)*step(tex.x,1.)*step(0.,tex.y)*step(tex.y,1.);
   float sd=(texture2D(textMask,clamp(tex,0.,1.)).r*255.-128.)/4.;
   sd=mix(-32.,sd,inBounds);
   float aa=max(.65,1024./fit/zoom*.65);
   float ink=smoothstep(-aa,aa,sd);
   float n=fbm(warped*noiseScale*12.+vec2(t*.13,-t*.17)+seed)-.5;
   float depth=clamp(sd/24.,0.,1.);
   float field=warped.x*1.25+warped.y*.45+depth*.45;
   if(mode<.5)field+=sin(warped.y*7.-t*.7)*.2;
   else if(mode<1.5)field+=sin(t*.8)*(.2+depth*.18);
   else if(mode<2.5)field+=sin(length(warped)*19.-t*1.5)*.16;
   else field+=sin(warped.x*11.+warped.y*9.-t*.6)*.2;
   field+=n*noiseAmount*.7;
   float band=sin(field*10.5-t*.55);
   vec3 body=palette(field*.65-t*.035+.3)*(.6+pow(max(0.,band),2.)*.75);
   body+=mix(color0,vec3(1.),.7)*pow(max(0.,cos(field*10.5-t*.55-.4)),5.)*.58;
   // Distance to the letter outline gives every stroke its own illuminated bevel.
   float rim=exp(-max(sd,0.)*.28);
   body=body*(.65+.35*sqrt(depth))+color0*rim*.65;
   float outer=exp(-max(-sd,0.)*.18)*step(-31.,sd)*inBounds;
   col=bg+color0*outer*glow*.28;
   col=mix(col,body,ink);
 } else if(mask>.001){
   vec2 uv=p/(edge+distortion*bend*2.8)/radius;
   float rr=clamp(r/radius,0.,1.); float z=sqrt(max(0.,1.-rr*rr));
   float n=fbm(uv*noiseScale*3.+vec2(t*.17,-t*.12)+seed)-.5;
   float tilt=sin(t*.45)*.72;
   float yy=uv.y*cos(tilt)+z*sin(tilt);
   float zz=z*cos(tilt)-uv.y*sin(tilt);
   float radial=length(vec2(uv.x,yy*.85));
   float field=radial*1.23+zz*.12;
   if(mode<.5)field+=sin(yy*3.-t*.8)*.12;
   else if(mode<1.5)field*=1.+sin(t*.75)*.12;
   else if(mode<2.5)field+=sin(rr*14.-t*1.7)*.07;
   else field+=sin(a*2.+rr*7.-t*.6)*.13;
   field+=n*noiseAmount*.23+distortion*sin(a*4.+rr*9.-t*.65)*.035;
   float band=sin(field*10.5-t*.55);
   float bright=pow(max(0.,band),1.7);
   float core=smoothstep(.12,.48,radial);
   vec3 spectrum=palette(field*.88-t*.035+.43);
   float diffuse=.4+.6*pow(z,.5);
   vec3 body=spectrum*(.40+bright*.95)*diffuse;
   body=mix(color1*.12,body,core);
   float ribbon=pow(max(0.,cos(field*10.5-t*.55-.22)),5.);
   body+=mix(vec3(.9,1.,.9),color0,.35)*ribbon*.7*core;
   float rim=pow(1.-z,2.8);
   body+=color0*rim*.65;
   body+=color0*pow(max(0.,band),2.)*glow*.13;
   body*=.78+.22*smoothstep(-1.,1.,uv.y);
   col=mix(col,body,mask);
 }
 float pixelGrain=hash(gl_FragCoord.xy+vec2(fract(time*.01)*100.,seed));
 col+=(pixelGrain-.5)*grain*.105;
 col-=sin(gl_FragCoord.y*3.14159)*grain*.008;
 col=pow(max(col,vec3(0.)),vec3(.92));
 gl_FragColor=vec4(col,1.);
}`;
