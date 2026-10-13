import * as THREE from 'three';
import { LIGHT_CYCLE_SECONDS_PER_COLOR } from './palette';

export type PageLight = {
  color: string; intensity: number;
  position: { x: number; y: number };
};
export type PageIllumination = PageLight[];

/** One slow lap; callers pause elapsed time when off, covered, or motion is reduced. */
export class LightColorCycle {
  private colors: THREE.Color[] = [];
  private seconds = 0;
  readonly color = new THREE.Color();
  constructor(private readonly offset = 0) {}
  setPalette(colors: readonly string[]) {
    this.colors = colors.map(color => new THREE.Color(color));
    this.sample();
  }
  get enabled() { return this.colors.length > 1; }
  advance(elapsed: number, running: boolean) {
    if (running) this.seconds += Math.max(0, Math.min(elapsed, 0.05));
    return this.sample();
  }
  private sample() {
    if (!this.colors.length) return this.color;
    const position = this.seconds / LIGHT_CYCLE_SECONDS_PER_COLOR + this.offset;
    const index = Math.floor(position) % this.colors.length;
    const fraction = position % 1;
    const eased = fraction * fraction * (3 - 2 * fraction);
    return this.color.copy(this.colors[index]).lerp(this.colors[(index + 1) % this.colors.length], eased);
  }
}

export function projectedLight(light: THREE.PointLight, camera: THREE.Camera): PageLight {
  const point = light.getWorldPosition(new THREE.Vector3()).project(camera);
  return { color: `#${light.color.getHexString()}`, intensity: light.intensity,
    position: { x: (point.x + 1) / 2, y: (1 - point.y) / 2 } };
}
