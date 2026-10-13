import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SCENE_LIGHT_PALETTE } from '../../components/home/light-study/palette';
import { LightColorCycle } from '../../components/home/light-study/illumination';
import { createAccentLights } from '../../components/home/light-study/accent-lights';

const palette = ['#8abaff', '#528ed1', '#0c5e7d', '#ffe5ab'];
test('the palette cycles smoothly and pauses without catching up when switched off or suspended', () => {
  const cycle = new LightColorCycle(); cycle.setPalette(palette);
  assert.equal(cycle.color.getHexString(), '8abaff');
  for (let i = 0; i < 200; i++) cycle.advance(0.05, true);
  assert.ok(Math.abs(cycle.color.r - new THREE.Color(palette[1]).r) < 1e-6);
  const paused = cycle.color.clone();
  cycle.advance(3600, false);
  assert.ok(cycle.color.equals(paused));
  cycle.advance(3600, true);
  assert.ok(Math.abs(cycle.color.r - paused.r) < 0.001, 'resume cannot skip a palette stop');
  for (let i = 0; i < 400; i++) cycle.advance(0.05, true);
  assert.ok(cycle.color.r > 0.99, 'warm yellow is part of the cycle');
});

test('all emitters share the reference palette with staggered starts and a seamless full lap', () => {
  for (const offset of [0, 2, 4]) {
    const cycle = new LightColorCycle(offset); cycle.setPalette(SCENE_LIGHT_PALETTE);
    assert.equal(`#${cycle.color.getHexString()}`, SCENE_LIGHT_PALETTE[offset]);
    for (let i = 0; i < 200; i++) cycle.advance(0.05, true);
    assert.equal(`#${cycle.color.getHexString()}`, SCENE_LIGHT_PALETTE[(offset + 1) % SCENE_LIGHT_PALETTE.length]);
    for (let i = 0; i < 1000; i++) cycle.advance(0.05, true);
    assert.equal(`#${cycle.color.getHexString()}`, SCENE_LIGHT_PALETTE[offset]);
  }
});

class Button extends EventTarget {
  style: Record<string, string> = {};
  dataset: Record<string, string> = {};
  attributes = new Map<string, string>();
  disabled = false; removed = false; captured: number | null = null;
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  removeAttribute(name: string) { this.attributes.delete(name); }
  setPointerCapture(id: number) { this.captured = id; }
  hasPointerCapture(id: number) { return this.captured === id; }
  releasePointerCapture(_id: number) { this.captured = null; }
  focus() {}
  remove() { this.removed = true; }
}
function send(button: Button, type: string, values: Record<string, unknown>) {
  const event = new Event(type, { cancelable: true });
  Object.assign(event, values); button.dispatchEvent(event);
}

test('broad corner lights move independently, distinguish clicks from drags, support keys and release input on suspend/disposal', () => {
  const previousDocument = globalThis.document, previousWindow = globalThis.window;
  const buttons: Button[] = [];
  globalThis.document = { createElement: () => new Button() } as unknown as Document;
  globalThis.window = new EventTarget() as unknown as Window & typeof globalThis;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, 1.44, 0.01, 30);
  camera.position.z = 1.45; camera.updateMatrixWorld();
  let renders = 0;
  const container = { append: (button: Button) => buttons.push(button) } as unknown as HTMLElement;
  const wall = new THREE.Group(); wall.position.z = -0.35; scene.add(wall);
  const bars = createAccentLights(container, scene, camera, () => renders++, wall);
  try {
    bars.layout(1440, 1000); bars.setPalette(SCENE_LIGHT_PALETTE);
    assert.equal(buttons.length, 4);
    const [blue, warm] = buttons;
    assert.equal(bars.illumination[0].color, SCENE_LIGHT_PALETTE[2]);
    assert.equal(bars.illumination[1].color, SCENE_LIGHT_PALETTE[4]);
    const lights = scene.children.filter((node): node is THREE.PointLight => node instanceof THREE.PointLight);
    assert.equal(lights.length, 4, 'accents use the same point-light type as the pendant');
    assert.equal(wall.children.length, 0, 'no painted wash meshes or cone overlays');
    const darkIllumination = bars.illumination;
    bars.setTheme('light');
    assert.ok(lights.every(light => light.intensity > 0 && light.intensity < darkIllumination[0].intensity),
      'pale walls receive less light, leaving room for colored highlights');
    assert.deepEqual(bars.illumination.map(({ color, position }) => ({ color, position })),
      darkIllumination.map(({ color, position }) => ({ color, position })), 'theme changes preserve palette and coverage');
    bars.setTheme('dark');
    assert.deepEqual(bars.illumination, darkIllumination, 'dark appearance restores exactly');
    const down = { pointerId: 1, isPrimary: true, button: 0, clientX: 46, clientY: 500 };
    send(blue, 'pointerdown', down); send(blue, 'pointerup', down);
    assert.equal(bars.illumination[0].intensity, 0);
    assert.equal(lights[0].intensity, 0, 'switch removes the actual background illumination');
    bars.setTheme('light');
    assert.equal(lights[0].intensity, 0, 'theme switch cannot turn an off light back on');
    bars.setTheme('dark');
    assert.ok(bars.illumination[1].intensity > 0, 'other bar stays on');
    const pausedColor = bars.illumination[0].color, movingColor = bars.illumination[1].color;
    assert.equal(bars.cycling, true, 'an active accent keeps cycling independently');
    for (let i = 0; i < 200; i++) bars.advanceColors(0.05, true);
    assert.equal(bars.illumination[0].color, pausedColor, 'off light pauses its own phase');
    assert.notEqual(bars.illumination[1].color, movingColor, 'other lights continue cycling');
    const stopped = bars.illumination.map(light => light.color);
    bars.setTheme('light'); bars.setTheme('dark');
    assert.deepEqual(bars.illumination.map(light => light.color), stopped, 'theme switching preserves the running cycle phase');
    bars.advanceColors(600, false);
    assert.deepEqual(bars.illumination.map(light => light.color), stopped, 'reduced motion freezes every accent');
    buttons.slice(2).forEach(button => send(button, 'click', { detail: 0 }));
    send(warm, 'click', { detail: 0 });
    assert.equal(bars.cycling, false, 'all-off accents do not keep a render loop alive');
    buttons.slice(2).forEach(button => send(button, 'click', { detail: 0 }));
    send(warm, 'click', { detail: 0 });
    send(blue, 'click', { detail: 0 });
    const target = bars.illumination[0].position;
    send(blue, 'pointerdown', down);
    send(blue, 'pointermove', { ...down, clientX: 200 });
    send(blue, 'pointermove', down); // Returning to the start is still a drag.
    send(blue, 'pointerup', down);
    assert.ok(bars.illumination[0].intensity > 0, 'drag never toggles');
    send(blue, 'keydown', { key: 'ArrowLeft' });
    scene.updateMatrixWorld(true);
    assert.notDeepEqual(bars.illumination[0].position, target, 'controls move the actual light source');
    send(blue, 'keydown', { key: 'Home' });
    assert.equal(blue.dataset.angle, '0');
    send(warm, 'pointerdown', down); bars.setActive(false);
    assert.equal(warm.captured, null);
    assert.ok(blue.disabled && warm.disabled);
    assert.equal(blue.style.pointerEvents, 'none');
    bars.setActive(true); assert.equal(blue.disabled, false);
    bars.layout(390, 844);
    assert.ok(parseFloat(blue.style.width) >= 44, 'compact lights preserve a usable click target');
    for (const [width, height] of [[1440, 1000], [390, 844], [320, 568], [844, 390]]) {
      camera.aspect = width / height; camera.updateProjectionMatrix();
      bars.layout(width, height);
      for (const [index, button] of buttons.entries()) {
        const x = parseFloat(button.style.left), y = parseFloat(button.style.top);
        assert.ok(index < 2 ? y > height * 0.9 && y < height : y > 60 && y < height * 0.25, 'controls stay in their own quadrant, clear of navigation');
        assert.ok(x < width * 0.15 || x > width * 0.85);
        const hitWidth = parseFloat(button.style.width), hitHeight = parseFloat(button.style.height);
        assert.ok(Math.min(width, x + hitWidth / 2) - Math.max(0, x - hitWidth / 2) >= 44);
        assert.ok(Math.min(height, y + hitHeight / 2) - Math.max(0, y - hitHeight / 2) >= 44);
      }
      assert.equal(scene.children.filter(node => node instanceof THREE.Mesh || node.name.startsWith('accent-light-')).length, 0, 'quadrant lights have no visible fixture geometry');
      for (const button of buttons) send(button, 'keydown', { key: 'Home' });
      scene.updateMatrixWorld(true);
      const wallZ = new THREE.Vector3(0, 0, wall.position.z).project(camera).z;
      const irradiance = (x: number, y: number, sources = lights.slice(0, 2)) => {
        const point = new THREE.Vector3(x * 2 - 1, 1 - y * 2, wallZ).unproject(camera);
        return sources.reduce((total, light) => {
          const offset = light.getWorldPosition(new THREE.Vector3()).sub(point);
          return total + light.intensity * offset.z / Math.pow(offset.length(), 3);
        }, 0);
      };
      const upper = lights.slice(2);
      assert.ok(irradiance(0.5, 0.1, upper) > irradiance(0.5, 0.9, upper) * 2, 'upper lights wash the upper quadrants');
      const bottom = irradiance(0.5, 0.94);
      assert.ok(irradiance(0.5, 0.78) > bottom * 0.45, 'wash spreads broadly upward without a cone cutoff');
      assert.ok(irradiance(0.25, 0.87) > bottom * 0.4 && irradiance(0.75, 0.87) > bottom * 0.4, 'both lower halves receive light');
      assert.ok(irradiance(0.5, 0.1) < bottom * 0.45, 'upper background stays quieter than the bottom');

    }
    assert.ok(renders > 0);
    bars.dispose(); assert.ok(buttons.every(button => button.removed));
  } finally {
    globalThis.document = previousDocument; globalThis.window = previousWindow;
    scene.traverse(object => {
      if (object instanceof THREE.Mesh) { object.geometry.dispose(); (object.material as THREE.Material).dispose(); }
    });
  }
});
