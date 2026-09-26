import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createRendering } from './rendering';
import { DEFAULT_SETTINGS, lightColor, updateSettings } from './settings';
import type { LightingSettings } from './settings';
import { CONTENT, CORD, GLASS, LIGHTING, VIEW, clamp } from './config';
import { CordSimulation } from './physics';
import { ContentLayer } from './content';
import { createStickerInteraction } from './sticker-interaction';
import { createStickerHover } from './sticker-hover';
import { createStickerPress } from './sticker-press';
import { validateItem, validateProject } from './project';
import type { SceneItem, StudyProject, ImageStickerPatch } from './project';
import { bendPoint } from './sticker';
import { fitToRect, pixelsPerMetre } from './layout';
import type { StudyLayout } from './layout';

export interface LightingScene {
  readonly ready: Promise<void>;
  readonly settings: LightingSettings;
  /** Empty wall-local group. Positive Z brings future content toward the bulb. */
  readonly contentGroup: THREE.Group;
  readonly items: SceneItem[];
  readonly motionEnabled: boolean;
  readonly selectedId: string | null;
  readonly arrangeMode: boolean;
  addItem(item: SceneItem): Promise<void>;
  updateItem(item: SceneItem): Promise<void>;
  updateImageSticker(id: string, patch: ImageStickerPatch): void;
  removeItem(id: string): void;
  selectItem(id: string | null): void;
  setArrangeMode(value: boolean): void;
  setMotionEnabled(value: boolean): void;
  resetBulb(): void;
  exportProject(): StudyProject;
  loadProject(value: unknown): Promise<void>;
  updateSettings(patch: Partial<LightingSettings>): LightingSettings;
  reset(): LightingSettings;
  /** Request a frame after adding/changing future content. */
  invalidate(): void;
  /** Pause rendering while the homepage section is out of view. */
  setActive(value: boolean): void;
  setLayout(value: StudyLayout): void;
  setTheme(wallColor: string, textColor: string, housingColor: string, cordColor: string, glassColor: string): void;
  dispose(): void;
}

function disposeObjects(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) textures.add(value);
      }
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
}

export function createLightingScene(container: HTMLElement): LightingScene {
  let settings = { ...DEFAULT_SETTINGS };
  let disposed = false;
  let active = true;
  let frame = 0;
  let contextLost = false;
  let lastTime = 0;
  let selectedId: string | null = null;
  let arrangeMode = true;
  let motionEnabled = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const physics = new CordSimulation();
  const events = new AbortController();
  const filamentMaterials: THREE.MeshStandardMaterial[] = [];
  const glassMaterials: THREE.MeshPhysicalMaterial[] = [];
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#111111');

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'default' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.append(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(VIEW.fieldOfView, 1, 0.01, 30);
  camera.position.set(0, 0, VIEW.cameraZ);

  const rendering = createRendering(renderer, scene, camera);

  // Generated locally: no external HDR download or dependency on a remote image.
  const room = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = LIGHTING.environment;
  room.dispose();
  pmrem.dispose();

  scene.add(new THREE.AmbientLight('#ffffff', LIGHTING.ambient));
  const wallRoot = new THREE.Group();
  wallRoot.name = 'wall';
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: settings.wallColor,
    roughness: 1,
    metalness: 0,
    envMapIntensity: 0,
  });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), wallMaterial);
  wall.name = 'empty-wall';
  wall.receiveShadow = true;
  wallRoot.add(wall);
  const contentGroup = new THREE.Group();
  contentGroup.name = 'future-wall-content';
  contentGroup.position.z = CONTENT.surfaceEpsilon;
  wallRoot.add(contentGroup);
  scene.add(wallRoot);
  const content = new ContentLayer(contentGroup, container);
  const artwork = new THREE.Group();
  contentGroup.add(artwork);
  let artworkPoints: THREE.Vector3[] = [];
  let heading: THREE.Object3D | undefined;
  let headingPoints: THREE.Vector3[] = [];
  let layout: StudyLayout | undefined;

  const fixtureGroup = new THREE.Group();
  scene.add(fixtureGroup);
  const fixture = new THREE.Group();
  fixture.name = 'hanging-fixture';
  fixture.position.set(physics.end.x, physics.end.y, 0);
  fixtureGroup.add(fixture);
  const socketMaterial = new THREE.MeshStandardMaterial({
    color: '#528ed1', roughness: 0.55, metalness: 0.35,
  });
  const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.027, VIEW.socketTop - VIEW.socketBottom, 48), socketMaterial);
  socket.position.y = (VIEW.socketTop + VIEW.socketBottom) / 2 - VIEW.socketTop;
  socket.castShadow = true;
  fixture.add(socket);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.0275, 0.0275, 0.006, 48), socketMaterial);
  collar.position.y = VIEW.socketBottom + 0.003 - VIEW.socketTop;
  collar.castShadow = true;
  fixture.add(collar);
  const cableMaterial = new THREE.MeshStandardMaterial({ color: '#083f56', roughness: 0.9 });
  let cable = new THREE.InstancedMesh(new THREE.CylinderGeometry(VIEW.cordRadius, VIEW.cordRadius, 1, 8), cableMaterial, physics.maxSegments);
  cable.name = 'simulated-cord';
  cable.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  cable.frustumCulled = false;
  fixtureGroup.add(cable);
  const cableTransform = new THREE.Object3D();
  const up = new THREE.Vector3(0, 1, 0);
  function updateFixture() {
    fixture.position.set(physics.end.x, physics.end.y, 0);
    fixture.rotation.z = physics.angle;
    cable.count = physics.segmentCount;
    for (let i = 0; i < physics.segmentCount; i++) {
      const a = physics.points[i], b = physics.points[i + 1];
      const direction = new THREE.Vector3(b.x - a.x, b.y - a.y, 0);
      cableTransform.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, 0);
      cableTransform.scale.set(1, direction.length(), 1);
      cableTransform.quaternion.setFromUnitVectors(up, direction.normalize());
      cableTransform.updateMatrix();
      cable.setMatrixAt(i, cableTransform.matrix);
    }
    cable.instanceMatrix.needsUpdate = true;
  }
  updateFixture();

  const light = new THREE.PointLight(lightColor(settings), LIGHTING.intensity, 0, 2);
  light.name = 'filament-light';
  light.position.set(0, 0.15 - VIEW.socketTop, 0);
  light.castShadow = true;
  light.shadow.mapSize.set(VIEW.shadowSize, VIEW.shadowSize);
  light.shadow.camera.near = 0.01;
  light.shadow.camera.far = 8;
  light.shadow.bias = -0.0001;
  light.shadow.normalBias = 0.001;
  fixture.add(light);

  function reportError(message: string) {
    container.dispatchEvent(new CustomEvent('lighting-error', { detail: message }));
  }

  function invalidate() {
    if (disposed || !active || contextLost || frame || document.hidden) return;
    frame = requestAnimationFrame((time) => {
      frame = 0;
      if (disposed || contextLost) return;
      try {
        const elapsed = lastTime ? (time - lastTime) / 1000 : CORD.timestep;
        lastTime = time;
        physics.advance(elapsed);
        updateFixture();
        updateHoverCursor();
        const hoverMoving = stickerHover.advance(elapsed);
        const pressMoving = stickerPress.advance(elapsed);
        content.project(camera);
        rendering.render(settings.brightness > 0);
        // Consumers can capture the canvas before WebGL discards its drawing buffer.
        container.dispatchEvent(new Event('study-render'));
        if (physics.awake || hoverMoving || pressMoving) invalidate();
        else lastTime = 0;
      } catch (error) {
        console.error('Unable to render the light study.', error);
        reportError('The light study could not be rendered. Please reload to try again.');
      }
    });
  }

  function applySettings() {
    const color = new THREE.Color(lightColor(settings));
    const level = settings.brightness / 100;
    light.color.copy(color);
    light.intensity = LIGHTING.intensity * level;
    for (const material of filamentMaterials) {
      material.emissive.copy(color);
      material.emissiveIntensity = LIGHTING.filamentEmission * level;
    }
    // The distance is measured from the light to the wall, not from the glass surface.
    wallRoot.position.z = light.getWorldPosition(new THREE.Vector3()).z - settings.wallDistance;
    wallMaterial.color.set(settings.wallColor);
    invalidate();
  }

  function resize() {
    if (disposed) return;
    const { width, height } = container.getBoundingClientRect();
    if (!width || !height) return;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, VIEW.maxPixelRatio);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    rendering.setSize(width, height, pixelRatio);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    applyLayout();
    invalidate();
  }

  function applyLayout() {
    if (!layout) return;
    const { width, height } = container.getBoundingClientRect();
    if (!width || !height) return;
    if (heading) fitToRect(heading, headingPoints, layout.heading, camera, width, height, 'left');
    fitToRect(artwork, artworkPoints, layout.artwork, camera, width, height, 'center');
    // Desktop hangs between the artwork and copy; phones keep the bulb over
    // the portrait, with the existing grab size and vertical placement.
    const ppm = pixelsPerMetre(camera, height, 0);
    const bulbPixels = layout.mobile ? 72 : 100;
    const scale = bulbPixels / (VIEW.bulbHeight * ppm);
    fixtureGroup.scale.setScalar(scale);
    fixtureGroup.position.set(
      layout.mobile ? (layout.artwork.left + layout.artwork.width / 2 - width / 2) / ppm : 0,
      (height / 2 - (layout.artwork.top + layout.artwork.height * 0.3)) / ppm - 0.2 * scale,
      0,
    );
    const ceilingY = ((height / 2 + 2) / ppm - fixtureGroup.position.y) / scale;
    const leadLength = Math.max(0, ceilingY - CORD.anchor.y);
    // The ceiling is the actual physics anchor. Every visible segment can
    // respond to a pull; there is no rigid extension or pinned mid-cord joint.
    const extension = layout.mobile ? 0 : leadLength;
    if (physics.setSuspension({ x: CORD.anchor.x, y: CORD.anchor.y + extension }, CORD.length + extension)) {
      finishDrag(true);
      lastTime = 0;
      if (physics.maxSegments > cable.instanceMatrix.count) {
        const previous = cable;
        cable = new THREE.InstancedMesh(previous.geometry, cableMaterial, physics.maxSegments);
        cable.name = 'simulated-cord';
        cable.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        cable.frustumCulled = false;
        fixtureGroup.add(cable);
        previous.removeFromParent(); previous.dispose();
      }
      updateFixture();
    }
    fixtureGroup.updateWorldMatrix(true, true);
    invalidate();
  }

  function prepareLayout() {
    artwork.position.set(0, 0, 0); artwork.scale.setScalar(1);
    artworkPoints = []; headingPoints = []; heading = undefined;
    for (const node of content.nodes.values()) {
      if (node.record.kind === 'image' && node.image) {
        artwork.add(node.root);
        node.root.updateMatrix();
        const bounds = node.image.bounds;
        // Measure visible pixels, including the saved curl, not PNG padding.
        for (let y = 0; y <= 16; y++) for (let x = 0; x <= 16; x++) {
          const px = THREE.MathUtils.lerp(bounds.minX, bounds.maxX, x / 16);
          const py = THREE.MathUtils.lerp(bounds.minY, bounds.maxY, y / 16);
          const point = node.image.surface && node.record.sticker
            ? bendPoint(px, py, bounds, node.record.sticker)
            : new THREE.Vector3(px, py, 0);
          artworkPoints.push(point.applyMatrix4(node.root.matrix));
        }
      } else if (node.record.kind === 'text' && node.record.treatment === 'solid') {
        heading = node.root;
        node.root.traverse(object => {
          if (!(object instanceof THREE.Mesh)) return;
          const positions = object.geometry.getAttribute('position');
          for (let i = 0; i < positions.count; i++) headingPoints.push(new THREE.Vector3().fromBufferAttribute(positions, i));
        });
      }
    }
    applyLayout();
  }

  const observer = new ResizeObserver(resize);
  observer.observe(container);
  window.addEventListener('resize', resize);
  // Some browsers discard a dormant tab's drawing buffer. Redraw when it returns.
  const onVisibilityChange = () => {
    physics.pause(); lastTime = 0;
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; finishDrag(true); }
    else invalidate();
  };
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pageshow', invalidate);
  function onContextLost(event: Event) {
    event.preventDefault();
    contextLost = true;
    reportError('Graphics were interrupted. Reload the page to restore the light study.');
  }
  renderer.domElement.addEventListener('webglcontextlost', onContextLost);
  resize();
  applySettings();

  const ready = new GLTFLoader().loadAsync(`/assets/about-light-study/models/edison/scene.gltf`).then((gltf) => {
    if (disposed) {
      disposeObjects(gltf.scene);
      return;
    }
    const model = gltf.scene;
    model.name = 'edison-bulb';
    // The supplied model is upright after its glTF root transform. Turn it cap-up.
    model.rotation.z = Math.PI;
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model);
    const height = bounds.max.y - bounds.min.y;
    model.scale.setScalar(VIEW.bulbHeight / height);
    model.updateMatrixWorld(true);
    bounds.setFromObject(model);
    const center = bounds.getCenter(new THREE.Vector3());
    model.position.set(-center.x, VIEW.bulbTop - VIEW.socketTop - bounds.max.y, -center.z);

    let filament: THREE.Mesh | undefined;
    const oldMaterials = new Set<THREE.Material>();
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = false;
      object.receiveShadow = false;
      const original = object.material as THREE.MeshStandardMaterial;
      oldMaterials.add(original);
      if (original.name === 'glass') {
        object.material = new THREE.MeshPhysicalMaterial({
          name: 'bulb-glass', color: '#fff7e9', metalness: 0, roughness: GLASS.roughness,
          transmission: GLASS.transmission, ior: GLASS.ior,
          envMapIntensity: GLASS.environmentIntensity, side: THREE.FrontSide,
        });
        glassMaterials.push(object.material);
        rendering.registerGlass(object as THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>, fixture);
      } else if (original.name === 'glass-thicker') {
        // Nested transmission isn't supported by the forward transmission pass.
        // Keep the inner support softly transparent instead.
        object.material = new THREE.MeshPhysicalMaterial({
          name: 'inner-glass', color: '#d9d3c8', roughness: 0.1,
          transparent: true, opacity: 0.16, depthWrite: false,
          envMapIntensity: 0.3,
        });
      } else {
        const material = original.clone();
        object.material = material;
        if (original.name === 'glow') {
          material.color.set('#191310');
          material.roughness = 0.45;
          material.metalness = 0;
          filamentMaterials.push(material);
          filament = object;
        } else if (original.name === 'gold') {
          // The screw base is enclosed by the socket, not exposed decorative metal.
          object.visible = false;
          material.color.set('#927040');
          material.metalness = 0.85;
          material.roughness = 0.3;
          object.castShadow = true;
        } else {
          material.color.set(original.name === 'black' ? '#141211' : '#3c3430');
          material.roughness = 0.38;
          material.metalness = 0.6;
        }
      }
    });
    oldMaterials.forEach((material) => material.dispose());
    // Measure the filament while the model is still in fixture-local space.
    // A newly parented model can otherwise inherit a stale fixture world matrix
    // when its cached assets finish loading before the first rendered frame.
    model.updateMatrixWorld(true);
    if (filament) {
      new THREE.Box3().setFromObject(filament).getCenter(light.position);
    }
    fixture.add(model);
    fixture.updateWorldMatrix(true, true);
    applySettings();
  });

  function changed() { container.dispatchEvent(new Event('study-change')); }
  function selectItem(id: string | null) {
    selectedId = id && content.nodes.has(id) ? id : null;
    content.select(selectedId); invalidate(); changed();
  }
  function resetBulb() { finishDrag(true); physics.reset(); updateFixture(); lastTime = 0; invalidate(); }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const dragPlane = new THREE.Plane();
  let drag: { pointerId: number; id: string | null; offset: THREE.Vector3 } | null = null;
  let hoverPosition: Pick<PointerEvent, 'clientX' | 'clientY'> | null = null;
  function pointOnPlane(event: Pick<PointerEvent, 'clientX' | 'clientY'>, z: number) {
    const rect = container.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
    raycaster.setFromCamera(pointer, camera);
    dragPlane.set(new THREE.Vector3(0, 0, 1), -z);
    return raycaster.ray.intersectPlane(dragPlane, new THREE.Vector3());
  }
  // Share the drag hit test so content in front of the bulb doesn't advertise
  // a bulb grab. Recheck during motion, without introducing an idle render loop.
  function pickObject(event: Pick<PointerEvent, 'clientX' | 'clientY'>) {
    pointOnPlane(event, 0);
    const targets: THREE.Object3D[] = [fixture];
    if (arrangeMode) targets.push(...[...content.nodes.values()].map((node) => node.root));
    const hit = raycaster.intersectObjects(targets, true).find((hit) => hit.object.visible);
    let object: THREE.Object3D | null = hit?.object ?? null;
    while (object && object !== fixture && !object.userData.itemId) object = object.parent;
    return object;
  }
  function updateHoverCursor() {
    if (drag) return;
    const top = hoverPosition && document.elementFromPoint(hoverPosition.clientX, hoverPosition.clientY);
    const overCanvas = top === renderer.domElement || top === container;
    container.classList.toggle('is-bulb-hovered', !!hoverPosition && overCanvas && pickObject(hoverPosition) === fixture);
  }
  function clearHover() { hoverPosition = null; container.classList.remove('is-bulb-hovered'); }
  function finishDrag(cancelled: boolean, time = performance.now()) {
    if (!drag) return;
    const pointerId = drag.pointerId;
    if (drag.id === null) physics.release(time, !cancelled && motionEnabled);
    drag = null;
    if (container.hasPointerCapture(pointerId)) container.releasePointerCapture(pointerId);
    container.classList.remove('is-dragging');
    updateHoverCursor();
    lastTime = 0; invalidate(); changed();
  }
  container.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || drag || !event.isPrimary) return;
    if (!arrangeMode && (event.target as Element).closest('.scene-html')) return;
    const object = pickObject(event);
    if (!object) { if (arrangeMode) selectItem(null); return; }
    const id = object === fixture ? null : String(object.userData.itemId);
    const position = object.getWorldPosition(new THREE.Vector3());
    const point = pointOnPlane(event, position.z);
    if (!point) return;
    drag = { pointerId: event.pointerId, id, offset: position.sub(point) };
    if (id === null) physics.beginDrag(event.timeStamp);
    else selectItem(id);
    container.setPointerCapture(event.pointerId);
    container.classList.add('is-dragging');
    event.preventDefault(); lastTime = 0; invalidate();
  }, { signal: events.signal });
  container.addEventListener('pointermove', (event) => {
    if (event.isPrimary && event.pointerType !== 'touch') {
      hoverPosition = { clientX: event.clientX, clientY: event.clientY };
      updateHoverCursor();
    }
    if (!drag || event.pointerId !== drag.pointerId) return;
    const node = drag.id ? content.nodes.get(drag.id) : null;
    const z = node ? node.root.getWorldPosition(new THREE.Vector3()).z : 0;
    const point = pointOnPlane(event, z);
    if (!point) return;
    point.add(drag.offset);
    if (drag.id === null) physics.dragTo(fixtureGroup.worldToLocal(point), event.timeStamp);
    else {
      contentGroup.worldToLocal(point);
      content.move(drag.id, clamp(point.x, CONTENT.x), clamp(point.y, CONTENT.y));
    }
    event.preventDefault(); invalidate();
  }, { signal: events.signal });
  container.addEventListener('pointerleave', clearHover, { signal: events.signal });
  container.addEventListener('pointercancel', clearHover, { signal: events.signal });
  window.addEventListener('blur', clearHover, { signal: events.signal });
  // Capture loss is not cancellation: Chrome can report it before pointerup,
  // with buttons already zero. Complete the release once and preserve the swing.
  // Listen for pointerup at window level too, in case capture ended outside us.
  window.addEventListener('pointerup', (event) => { if (drag?.pointerId === event.pointerId) finishDrag(false, event.timeStamp); }, { capture: true, signal: events.signal });
  container.addEventListener('pointercancel', (event) => { if (drag?.pointerId === event.pointerId) finishDrag(true, event.timeStamp); }, { signal: events.signal });
  container.addEventListener('lostpointercapture', (event) => { if (drag?.pointerId === event.pointerId) finishDrag(false, event.timeStamp); }, { signal: events.signal });

  function updateImageSticker(id: string, patch: ImageStickerPatch) {
    if (disposed) return;
    content.updateImageSticker(id, patch); invalidate();
    container.dispatchEvent(new Event('study-sticker-change'));
  }
  const stickerInteraction = createStickerInteraction(container, camera, content, updateImageSticker, () => arrangeMode);
  const stickerHover = createStickerHover(container, renderer.domElement, camera, content, () => !arrangeMode, invalidate);
  const stickerPress = createStickerPress(container, renderer.domElement, content, () => !arrangeMode, (event) => {
    pointOnPlane(event, 0);
    const targets = [fixture, ...[...content.nodes.values()].map((node) => node.root)];
    for (const hit of raycaster.intersectObjects(targets, true)) {
      const mesh = hit.object as THREE.Mesh;
      let visible = true;
      for (let parent: THREE.Object3D | null = mesh; parent; parent = parent.parent) if (!parent.visible) visible = false;
      if (!visible) continue;
      const material = (Array.isArray(mesh.material) ? mesh.material[hit.face?.materialIndex ?? 0] : mesh.material) as THREE.MeshStandardMaterial;
      if (!material?.visible || material.opacity === 0) continue;
      // Transparent PNG padding/holes must not become invisible press targets.
      if (hit.uv && material.map?.image instanceof HTMLCanvasElement) {
        const image = material.map.image, uv = material.map.transformUv(hit.uv.clone());
        const alpha = image.getContext('2d')!.getImageData(Math.min(image.width - 1, Math.floor(uv.x * image.width)), Math.min(image.height - 1, Math.floor(uv.y * image.height)), 1, 1).data[3] / 255;
        if (alpha < Math.max(material.alphaTest, 1 / 255)) continue;
      }
      let object: THREE.Object3D | null = mesh;
      while (object && object !== fixture && !object.userData.itemId) object = object.parent;
      return object?.userData.itemId ? content.nodes.get(String(object.userData.itemId)) ?? null : null;
    }
    return null;
  }, invalidate);

  return {
    ready,
    contentGroup,
    get items() { return content.items; },
    get motionEnabled() { return motionEnabled; },
    get selectedId() { return selectedId; },
    get arrangeMode() { return arrangeMode; },
    async addItem(item) { await content.put(validateItem(item)); selectItem(item.id); },
    async updateItem(item) { stickerInteraction.cancel(); await content.put(validateItem(item)); invalidate(); changed(); },
    updateImageSticker,
    removeItem(id) { stickerInteraction.cancel(); content.remove(id); if (selectedId === id) selectedId = null; invalidate(); changed(); },
    selectItem,
    setArrangeMode(value) { stickerPress.reset(); stickerHover.reset(); stickerInteraction.cancel(); finishDrag(true); arrangeMode = value; content.setArrange(value); invalidate(); changed(); },
    setMotionEnabled(value) { motionEnabled = value; if (!value) resetBulb(); changed(); },
    resetBulb,
    exportProject() { return { format: 'edison-light-study', version: 2, lighting: { ...settings }, motionEnabled, items: content.items }; },
    async loadProject(value) {
      const project = validateProject(value);
      stickerInteraction.cancel();
      await content.replace(project.items);
      stickerPress.reset();
      stickerHover.reset();
      finishDrag(true); selectedId = null;
      settings = project.lighting; motionEnabled = project.motionEnabled;
      resetBulb(); applySettings(); changed();
      prepareLayout();
    },
    get settings() { return { ...settings }; },
    updateSettings(patch) {
      if (disposed) return { ...settings };
      settings = updateSettings(settings, patch);
      applySettings();
      changed();
      return { ...settings };
    },
    reset() {
      if (disposed) return { ...settings };
      settings = { ...DEFAULT_SETTINGS };
      applySettings();
      changed();
      return { ...settings };
    },
    invalidate,
    setLayout(value) { layout = value; resize(); },
    setTheme(wallColor, textColor, housingColor, cordColor, glassColor) {
      settings = updateSettings(settings, { wallColor });
      socketMaterial.color.set(housingColor);
      cableMaterial.color.set(cordColor);
      for (const material of glassMaterials) material.color.set(glassColor);
      heading?.traverse(object => {
        if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial) object.material.color.set(textColor);
      });
      applySettings();
    },
    setActive(value) {
      active = value;
      physics.pause(); lastTime = 0;
      if (!active) { cancelAnimationFrame(frame); frame = 0; stickerPress.reset(); finishDrag(true); }
      else invalidate();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      events.abort();
      stickerInteraction.dispose();
      stickerHover.dispose();
      stickerPress.dispose();
      finishDrag(true);
      clearHover();
      content.dispose();
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pageshow', invalidate);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      scene.environment = null;
      cable.dispose();
      disposeObjects(scene);
      environment.dispose();
      light.shadow.dispose();
      rendering.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      scene.clear();
    },
  };
}
