import * as THREE from 'three';
import { pixelsPerMetre } from './layout';
import { LightColorCycle, projectedLight } from './illumination';
import { LIGHTING_THEMES, type LightingTheme } from './config';

export const ACCENT_AIM_LIMIT = 65;
export const clampAccentAim = (angle: number) => Math.max(-ACCENT_AIM_LIMIT, Math.min(ACCENT_AIM_LIMIT, angle));

/** Invisible corner controls for broad point lights on the same wall as the pendant. */
export function createAccentLights(container: HTMLElement, scene: THREE.Scene, camera: THREE.PerspectiveCamera,
  invalidate: () => void, wall: THREE.Object3D) {
  const events = new AbortController();
  const fixtures = [
    { label: 'Lower left accent light', left: true, top: false, phase: 2 },
    { label: 'Lower right accent light', left: false, top: false, phase: 4 },
    { label: 'Upper left accent light', left: true, top: true, phase: 0 },
    { label: 'Upper right accent light', left: false, top: true, phase: 3 },
  ].map(({ label, left, top, phase }, index) => {
    // The pendant and accents illuminate the very same wall.
    const light = new THREE.PointLight('#ffffff', 0, 0, 2);
    scene.add(light);
    const button = document.createElement('button');
    button.type = 'button'; button.dataset.accentControl = String(index);
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-description', 'Drag to aim. Click or press Space to switch. Arrow keys aim; Home resets.');
    button.title = `${label}: drag to aim · click to switch`;
    container.append(button);
    return { light, button, left, top, cycle: new LightColorCycle(phase), angle: 0, on: true,
      drag: null as null | { id: number; x: number; y: number; angle: number; moved: boolean } };
  });
  let active = true;
  let theme: LightingTheme = 'dark';
  let viewport = { width: 1, height: 1 };
  function aim(fixture: typeof fixtures[number]) {
    const { width, height } = viewport;
    const side = fixture.left ? 1 : -1;
    const wallDepth = wall.getWorldPosition(new THREE.Vector3()).z;
    // Increase source-to-wall distance for a soft flood with no cone edge.
    const sourceDepth = wallDepth + 0.48;
    const ppm = pixelsPerMetre(camera, height, sourceDepth);
    const x = width * (fixture.left ? 0.17 : 0.83) + side * width * fixture.angle / ACCENT_AIM_LIMIT * 0.1;
    const y = height * (fixture.top ? -0.015 + fixture.angle / ACCENT_AIM_LIMIT * 0.04 : 1.015 - fixture.angle / ACCENT_AIM_LIMIT * 0.04);
    fixture.light.position.set((x - width / 2) / ppm, (height / 2 - y) / ppm, sourceDepth);
  }
  function updateEmission(fixture: typeof fixtures[number]) {
    fixture.light.intensity = fixture.on ? LIGHTING_THEMES[theme].accentIntensity : 0;
  }
  function sync() {
    for (const fixture of fixtures) {
      aim(fixture);
      updateEmission(fixture);
      fixture.button.setAttribute('aria-pressed', String(fixture.on));
      fixture.button.dataset.angle = String(Math.round(fixture.angle));
      fixture.button.style.transform = 'translate(-50%, -50%)';
    }
    invalidate();
  }
  function release(fixture: typeof fixtures[number]) {
    const drag = fixture.drag; fixture.drag = null;
    if (drag && fixture.button.hasPointerCapture(drag.id)) fixture.button.releasePointerCapture(drag.id);
    fixture.button.removeAttribute('data-dragging');
  }
  for (const fixture of fixtures) {
    const button = fixture.button;
    button.addEventListener('pointerdown', event => {
      if (!active || event.button !== 0 || !event.isPrimary) return;
      fixture.drag = { id: event.pointerId, x: event.clientX, y: event.clientY, angle: fixture.angle, moved: false };
      button.setPointerCapture(event.pointerId); button.focus({ preventScroll: true });
      button.dataset.dragging = 'true'; event.preventDefault();
    }, { signal: events.signal });
    button.addEventListener('pointermove', event => {
      const drag = fixture.drag;
      if (!drag || drag.id !== event.pointerId) return;
      drag.moved ||= Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 6;
      if (!drag.moved) return;
      // Horizontal scrubbing shifts the broad wash with mouse or touch.
      fixture.angle = clampAccentAim(drag.angle - (event.clientX - drag.x) * 0.55);
      sync(); event.preventDefault();
    }, { signal: events.signal });
    button.addEventListener('pointerup', event => {
      const drag = fixture.drag;
      if (!drag || drag.id !== event.pointerId) return;
      const clicked = !drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) <= 6;
      release(fixture);
      if (clicked) { fixture.on = !fixture.on; sync(); }
      event.preventDefault();
    }, { signal: events.signal });
    button.addEventListener('click', event => {
      // Pointer gestures are handled above; a keyboard/AT activation has detail 0.
      if (event.detail === 0 && active) { fixture.on = !fixture.on; sync(); }
    }, { signal: events.signal });
    button.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
      event.preventDefault();
      fixture.angle = event.key === 'Home' ? 0 : clampAccentAim(fixture.angle +
        (['ArrowLeft', 'ArrowUp'].includes(event.key) ? 5 : -5));
      sync();
    }, { signal: events.signal });
    button.addEventListener('pointercancel', () => release(fixture), { signal: events.signal });
    button.addEventListener('lostpointercapture', () => release(fixture), { signal: events.signal });
  }
  window.addEventListener('blur', () => fixtures.forEach(release), { signal: events.signal });
  sync();
  return {
    get illumination() { return fixtures.map(fixture => projectedLight(fixture.light, camera)); },
    get cycling() { return fixtures.some(fixture => fixture.on && fixture.cycle.enabled); },
    setTheme(value: LightingTheme) { theme = value; sync(); },
    setPalette(colors: readonly string[]) {
      fixtures.forEach(fixture => { fixture.cycle.setPalette(colors); fixture.light.color.copy(fixture.cycle.color); });
      sync();
    },
    advanceColors(elapsed: number, running: boolean) {
      for (const fixture of fixtures) {
        if (!fixture.cycle.enabled) continue;
        fixture.light.color.copy(fixture.cycle.advance(elapsed, running && fixture.on));
        updateEmission(fixture);
      }
    },
    setActive(value: boolean) {
      active = value;
      for (const fixture of fixtures) { fixture.button.disabled = !value; fixture.button.style.pointerEvents = value ? 'auto' : 'none'; if (!value) release(fixture); }
    },
    layout(width: number, height: number) {
      viewport = { width, height };
      const mobile = width < 768;
      const size = mobile ? 48 : 64;
      fixtures.forEach(fixture => {
        const inset = mobile ? 22 : 28;
        const x = fixture.left ? inset : width - inset;
        const y = fixture.top ? 84 : height - 5;
        Object.assign(fixture.button.style, { left: `${x}px`, top: `${fixture.top ? y : height - 22}px`, width: `${Math.max(44, size * 0.75)}px`, height: `${Math.max(44, size * 0.75)}px` });
      });
      sync();
    },
    dispose() {
      events.abort();
      for (const fixture of fixtures) { release(fixture); fixture.button.remove(); }
      // Geometry/material disposal belongs to the scene's existing traversal.
    },
  };
}
