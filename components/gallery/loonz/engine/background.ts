import * as THREE from "three";
import { WIPE_DURATION } from "./motion";

/** Screen-space color, rendered inside WebGL so images and recordings match the stage. */
export class WindBackground {
  private targets = [
    new THREE.WebGLRenderTarget(512, 512),
    new THREE.WebGLRenderTarget(512, 512),
  ];
  private nextTarget = 1;
  private color = "";
  private started = -Infinity;
  private material = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      previous: { value: this.targets[0].texture },
      nextColor: { value: new THREE.Color() },
      progress: { value: 1 },
    },
    vertexShader: `varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }`,
    fragmentShader: `
      uniform sampler2D previous;
      uniform vec3 nextColor;
      uniform float progress;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1.,0.)), f.x), mix(hash(i+vec2(0.,1.)), hash(i+vec2(1.)), f.x), f.y);
      }
      void main() {
        float t = progress * 2.5;
        float wind = (noise(vec2(vUv.y*3.4-t*.55, vUv.x*1.3+t*.35))-.5)*.23;
        wind += (noise(vec2(vUv.y*9.0+t*.8, vUv.x*3.0-t*.5))-.5)*.065;
        float front = mix(-.32, 1.32, progress);
        float blend = 1.0-smoothstep(front-.16, front+.16, vUv.x+wind);
        if (progress <= 0.0) blend = 0.0;
        if (progress >= 1.0) blend = 1.0;
        gl_FragColor = vec4(mix(texture2D(previous, vUv).rgb, nextColor, blend), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
  private captureScene = new THREE.Scene();
  private camera = new THREE.Camera();
  private reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  constructor() {
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
    const capture = new THREE.Mesh(this.mesh.geometry, this.material);
    capture.frustumCulled = false;
    this.captureScene.add(capture);
  }
  setColor(color: string, renderer: THREE.WebGLRenderer) {
    if (color === this.color) return;
    const now = performance.now();
    this.update(now);
    if (this.color && !this.reducedMotion.matches) {
      // Freeze the currently visible blend, even when a new color interrupts a wipe.
      // Ping-pong targets avoid sampling a texture while writing into it.
      const target = this.targets[this.nextTarget];
      const previousTarget = renderer.getRenderTarget();
      renderer.setRenderTarget(target);
      renderer.render(this.captureScene, this.camera);
      renderer.setRenderTarget(previousTarget);
      this.material.uniforms.previous.value = target.texture;
      this.nextTarget = 1 - this.nextTarget;
      this.started = now;
    } else this.started = -Infinity;
    this.color = color;
    this.material.uniforms.nextColor.value.set(color);
    this.update(now);
  }
  update(now: number) {
    this.material.uniforms.progress.value = this.reducedMotion.matches
      ? 1
      : Math.min(1, (now - this.started) / WIPE_DURATION);
  }
  dispose() {
    this.targets.forEach((target) => target.dispose());
    // The renderer owns and disposes the scene mesh's material and geometry.
  }
}
