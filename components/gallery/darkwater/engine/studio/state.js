// Distances: meters. Angles: degrees. Intensity: artistic radiometric scale.
// Four lights is a shared shader budget, not a UI-only limit.
export const MAX_LIGHTS = 4;
export const MAX_RIPPLES = 16;
let nextId = 1;
export function makeLight(overrides = {}) {
  return {
    id: nextId++, name: 'Light', enabled: true, color: '#8660ff', intensity: 170,
    x: -3, y: 5, z: 1, targetX: 0, targetZ: 0,
    spread: 64, focus: 0.3, softness: 0.65, size: 0.25, ...overrides,
  };
}
export class LightCollection {
  lights = [];
  selectedId = null;
  get selected() { return this.lights.find(l => l.id === this.selectedId); }
  add(overrides = {}) {
    if (this.lights.length >= MAX_LIGHTS) return null;
    const light = makeLight({ name: `Light ${this.lights.length + 1}`, ...overrides });
    this.lights.push(light);
    this.selectedId = light.id;
    return light;
  }
  duplicate() {
    const light = this.selected;
    if (!light) return null;
    const { id, ...copy } = light;
    return this.add({ ...copy, name: `${light.name} copy`, x: Math.min(10, light.x + 1) });
  }
  remove() {
    this.lights = this.lights.filter(l => l.id !== this.selectedId);
    this.selectedId = this.lights[0]?.id ?? null;
  }
  preset(name) {
    this.lights = [];
    this.selectedId = null;
    if (name === 'cross') {
      this.add({ name: 'Glacier', color: '#32cfff', x: -4, y: 4.5, z: 1, targetX: -1.5, intensity: 130, spread: 66 });
      this.add({ name: 'Amber', color: '#ff9e37', x: 4, y: 5.5, z: -2, targetX: 2, targetZ: -1, intensity: 200, spread: 62 });
    } else if (name === 'white') {
      this.add({ name: 'White study', color: '#ffffff', x: -2, y: 5, z: -2, intensity: 180, spread: 42, focus: 0.5, size: 0.16 });
    } else {
      this.add({ name: 'Ultraviolet', color: '#7551ff', x: -3, y: 4.5, z: -1, intensity: 230, spread: 78, targetX: -1 });
      this.add({ name: 'Blue hour', color: '#2448ff', x: 4, y: 5, z: 1, intensity: 145, spread: 70, targetX: 2, targetZ: -1 });
    }
    this.selectedId = this.lights[0].id;
  }
}
export class RippleController {
  generation = 0;
  events = [];
  lastTime = -Infinity;
  lastPoint = null;
  add(x, z, time, radius, strength, dragging = false, options = {}) {
    if (dragging && (time - this.lastTime < 0.075 || (this.lastPoint && Math.hypot(x - this.lastPoint.x, z - this.lastPoint.z) < radius * 0.28))) return false;
    // Reservoir feedback must not evict a fresh primary impact or interfere
    // with pointer-trail throttling. At most four slots carry returning water.
    if(options.feedback) {
      const index=this.events.findIndex(e=>e.feedback);
      if(this.events.filter(e=>e.feedback).length>=4 || this.events.length===MAX_RIPPLES) {
        if(index<0)return false;this.events.splice(index,1);
      }
    } else if (this.events.length === MAX_RIPPLES) this.events.shift();
    this.events.push({ x, z, time, radius, strength, y: options.y ?? 0, spray: options.spray ?? (dragging ? 0.15 : 1), feedback:!!options.feedback, bodyId:options.bodyId });
    if(!options.feedback){this.lastTime = time;this.lastPoint = { x, z };}
    return true;
  }
  active(time) { return this.events.filter(e => time - e.time < 18); }
  clear() { this.events = []; this.lastTime = -Infinity; this.lastPoint = null; this.generation++; }
}
export const defaultSettings = () => ({
  shape: 'sphere', preset: 'violet', mode: 'interact', camera: 'surface', paused: false,
  waveStrength: 0.65, direction: 24, detail: 1.1, choppiness: 0.8, speed: 0.7,
  brushSize: 0.45, brushStrength: 0.28,
  floorDepth: 3, floorVisible: true, exposure: 1.05, bloom: 0.16,
  clarity: 0.8, scattering: 0.45, caustics: 1.0,
  resolution: 1, causticQuality: 384,
});
