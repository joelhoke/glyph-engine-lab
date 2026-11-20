import * as THREE from "three";
import { WindBackground } from "./background";
import { DEFAULT_BACKGROUND_PALETTE, PalettePlayback } from "./palette";
import { releaseVelocity, type PointerSample } from "./motion";
import { viewportWalls } from "./bounds";

import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  applyWeights,
  center,
  makeMesh,
  prepareOutline,
  subdivision,
  transformPositions,
  type Weight,
} from "./geometry";
import type {
  Balloon,
  SceneDocument,
  Vec2,
  Vec3,
  WorkerInput,
  WorkerOutput,
} from "./types";

export type SelectionBox = {
  x: number;
  y: number;
  width: number;
  height: number;
} | null;
interface RenderBody {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>;
  coarse: Float32Array;
  local: Float32Array;
  rest: Float32Array;
  signature: string;
  weights: Weight[];
  shadow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
}
interface Callbacks {
  select(id: string | null): void;
  move(id: string, position: Vec3, previous: Vec3): void;
  camera(value: SceneDocument["camera"]): void;
  box(value: SelectionBox): void;
  stats(fps: number, ms: number): void;
  error(message: string): void;
  background(color: string): void;
}
export class PlaygroundRenderer {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(37, 1, 0.1, 100);
  controls: OrbitControls;
  bodies = new Map<string, RenderBody>();
  worker: Worker;
  document: SceneDocument | null = null;
  selected: string | null = null;
  playing = false;
  mode: "select" | "orbit" | "draw" = "select";
  private windBackground = new WindBackground();
  private palettePlayback = new PalettePlayback();
  backgroundColor = "";
  private generation = 0;
  private geometryKey = "";
  private waiting = false;
  private disposed = false;
  private frameCount = 0;
  private lastStats = performance.now();
  private simMS = 0;
  private lastStep = performance.now();
  private size = { width: 1, height: 1 };
  private ray = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private drag: {
    id: string;
    plane: THREE.Plane;
    initial: THREE.Vector3;
    origin: Vec3;
    coarse: Float32Array;
    last: Vec3;
    center: Vec3;
    samples: PointerSample[];
    pointerId: number;
    moved: boolean;
  } | null = null;
  private environment: THREE.WebGLRenderTarget;
  private floor: THREE.Mesh<THREE.PlaneGeometry, THREE.ShadowMaterial>;
  private shadowTexture: THREE.CanvasTexture;
  private observer: ResizeObserver;
  private recording: {
    canvas: HTMLCanvasElement;
    context: CanvasRenderingContext2D;
  } | null = null;
  constructor(
    public canvas: HTMLCanvasElement,
    private cb: Callbacks,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.camera.position.set(0, 1.3, 9);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(0, 0.95, 0);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 18;
    this.controls.minPolarAngle = 0.5;
    this.controls.maxPolarAngle = 1.73;
    this.controls.mouseButtons = {
      LEFT: null as unknown as THREE.MOUSE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    this.controls.addEventListener("end", this.onCamera);
    const studio = new THREE.Scene();
    studio.background = new THREE.Color("#9b8d9a");
    const room = new THREE.Mesh(
      new THREE.BoxGeometry(20, 16, 20),
      new THREE.MeshBasicMaterial({ color: "#968b96", side: THREE.BackSide }),
    );
    studio.add(room);
    const panel = (
      position: Vec3,
      width: number,
      height: number,
      intensity: number,
      color = "#ffffff",
    ) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(color).multiplyScalar(intensity),
          side: THREE.DoubleSide,
        }),
      );
      m.position.fromArray(position);
      m.lookAt(0, 0, 0);
      studio.add(m);
    };
    panel([-4, 4, 5], 3, 6, 5);
    panel([4, 2, 3], 1.2, 5, 4);
    panel([0, 7, 0], 7, 3, 5);
    panel([0, -3, 5], 7, 1.3, 1.6, "#ffb8ce");
    panel([-5, 0, -3], 2, 4, 2, "#d4dbff");
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.environment = pmrem.fromScene(studio, 0.025);
    this.scene.environment = this.environment.texture;
    studio.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight("#ffffff", "#cd779d", 1.7));
    const light = new THREE.DirectionalLight("#fff7f2", 3);
    light.position.set(-3, 7, 5);
    light.castShadow = true;
    light.shadow.mapSize.set(2048, 2048);
    light.shadow.camera.left = -5;
    light.shadow.camera.right = 5;
    light.shadow.camera.top = 5;
    light.shadow.camera.bottom = -5;
    light.shadow.normalBias = 0.03;
    light.shadow.bias = -0.0002;
    light.shadow.radius = 4;
    this.scene.add(light);
    this.floor = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.ShadowMaterial({ color: "#57324d", opacity: 0.045 }),
    );
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = -1.4;
    this.floor.receiveShadow = true;
    this.scene.add(this.floor, this.windBackground.mesh);
    const shadowCanvas = document.createElement("canvas");
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const context = shadowCanvas.getContext("2d")!;
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, "rgba(53,12,38,0.4)");
    gradient.addColorStop(0.45, "rgba(53,12,38,0.16)");
    gradient.addColorStop(1, "rgba(53,12,38,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
    this.shadowTexture = new THREE.CanvasTexture(shadowCanvas);
    this.worker = new Worker(new URL("./physics.worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (event: MessageEvent<WorkerOutput>) => {
      if (this.disposed) return;
      const m = event.data;
      if (m.type === "error") {
        this.waiting = false;
        cb.error(m.message);
        return;
      }
      if (m.type === "frame") this.waiting = false;
      if (m.generation !== this.generation) return;
      if (m.type === "placement") {
        const balloon = this.document?.balloons.find((b) => b.id === m.id);
        const body = this.bodies.get(m.id);
        if (balloon && body && this.document) {
          const position = balloon.position.map(
            (v, k) => v + m.delta[k],
          ) as Vec3;
          // Adopt the worker's new anchor before React updates. This keeps the live
          // solver intact, while placement remains undoable and locally saved.
          this.document = {
            ...this.document,
            balloons: this.document.balloons.map((b) =>
              b.id === m.id ? { ...b, position } : b,
            ),
          };
          for (let i = 0; i < body.rest.length; i++)
            body.rest[i] += m.delta[i % 3];
          this.geometryKey = this.getGeometryKey(this.document);
          this.cb.move(m.id, position, balloon.position);
        }
        return;
      }
      this.simMS = m.ms;
      for (const b of m.bodies) {
        const body = this.bodies.get(b.id);
        if (body) this.updateBody(body, b.positions);
      }
    };
    this.worker.onerror = () => {
      this.waiting = false;
      cb.error(
        "The physics worker stopped. Your scene is safe; reload to restart it.",
      );
    };
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas.parentElement!);
    canvas.addEventListener("pointerdown", this.onDown);
    canvas.addEventListener("pointermove", this.onMove);
    canvas.addEventListener("pointerup", this.onUp);
    canvas.addEventListener("pointercancel", this.onUp);
    canvas.addEventListener("contextmenu", this.onContext);
    canvas.addEventListener("webglcontextlost", this.onContextLost);
    this.resize();

  }
  private send(m: WorkerInput) {
    this.worker.postMessage(m);
  }
  private onCamera = () =>
    this.cb.camera({
      position: this.camera.position.toArray() as Vec3,
      target: this.controls.target.toArray() as Vec3,
    });
  private onContext = (e: Event) => e.preventDefault();
  private onContextLost = (e: Event) => {
    e.preventDefault();
    this.cb.error(
      "Graphics context was lost. Save your scene, then reload to restore the canvas.",
    );
  };
  private material(balloon: Balloon) {
    const m = new THREE.MeshPhysicalMaterial({
      color: balloon.color,
      metalness: 1,
      roughness: balloon.roughness,
      clearcoat: 0.75,
      clearcoatRoughness: 0.13,
      envMapIntensity: 1.05,
    });
    m.onBeforeCompile = (shader) => {
      shader.vertexShader =
        "attribute float seam; varying float vSeam;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvSeam = seam;",
      );
      shader.fragmentShader = "varying float vSeam;\n" + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <normal_fragment_begin>",
        `#include <normal_fragment_begin>
        float edge = exp(-vSeam * 29.0);
        vec3 wrinkles = vec3(sin(vViewPosition.x * 110.0 + vViewPosition.y * 22.0), cos(vViewPosition.y * 100.0 + vViewPosition.x * 19.0), 0.0);
        normal = normalize(normal + wrinkles * edge * 0.065);`,
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\nroughnessFactor += exp(-vSeam * 55.0) * 0.09;",
      );
    };
    return m;
  }
  private updateBody(body: RenderBody, coarse: Float32Array) {
    body.coarse = coarse;
    const attr = body.mesh.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    applyWeights(coarse, body.weights, attr.array as Float32Array);
    attr.needsUpdate = true;
    body.mesh.geometry.computeVertexNormals();
    body.mesh.geometry.computeBoundingSphere();
    body.mesh.geometry.computeBoundingBox();
    const c = center(coarse);
    body.shadow.position.set(c[0], -1.385, c[2]);
  }
  private getGeometryKey(doc: SceneDocument) {
    return JSON.stringify(
      doc.balloons.map(({ color, roughness, name, ...b }) => b),
    );
  }
  setScene(doc: SceneDocument) {
    this.document = doc;
    this.palettePlayback.configure(
      doc.backgroundPalette ?? DEFAULT_BACKGROUND_PALETTE,
    );
    if (!this.palettePlayback.playing) this.setBackground(doc.background);
    const geoKey = this.getGeometryKey(doc);
    if (geoKey !== this.geometryKey) {
      this.geometryKey = geoKey;
      const ids = new Set(doc.balloons.map((b) => b.id));
      const disposeBody = (body: RenderBody) => {
        this.scene.remove(body.mesh, body.shadow);
        body.mesh.geometry.dispose();
        body.mesh.material.dispose();
        body.shadow.geometry.dispose();
        body.shadow.material.dispose();
      };
      for (const [id, body] of this.bodies)
        if (!ids.has(id)) {
          disposeBody(body);
          this.bodies.delete(id);
        }
      for (const b of doc.balloons) {
        const signature = JSON.stringify([b.outline, b.inflation]);
        let body = this.bodies.get(b.id);
        if (body && body.signature !== signature) {
          disposeBody(body);
          this.bodies.delete(b.id);
          body = undefined;
        }
        if (!body) {
          const coarseMesh = makeMesh(b.outline, b.inflation),
            sub = subdivision(coarseMesh);
          const geometry = new THREE.BufferGeometry();
          geometry.setIndex(sub.indices);
          geometry.setAttribute(
            "position",
            new THREE.BufferAttribute(
              new Float32Array(sub.weights.length * 3),
              3,
            ),
          );
          geometry.setAttribute(
            "seam",
            new THREE.Float32BufferAttribute(sub.seam, 1),
          );
          const mesh = new THREE.Mesh(geometry, this.material(b));
          mesh.castShadow = true;
          mesh.userData.id = b.id;
          const shadow = new THREE.Mesh(
            new THREE.PlaneGeometry(3.3, 2.5),
            new THREE.MeshBasicMaterial({
              map: this.shadowTexture,
              transparent: true,
              opacity: 0.6,
              depthWrite: false,
            }),
          );
          shadow.rotation.x = -Math.PI / 2;
          body = {
            mesh,
            shadow,
            coarse: coarseMesh.positions,
            local: coarseMesh.positions,
            rest: coarseMesh.positions,
            signature,
            weights: sub.weights,
          };
          this.bodies.set(b.id, body);
          this.scene.add(mesh, shadow);
        }
        body.rest = transformPositions(body.local, b);
        body.shadow.scale.set(b.scale, b.scale, 1);
        body.mesh.material.color.set(b.color);
        body.mesh.material.roughness = b.roughness;
        this.updateBody(body, body.rest.slice());
      }
      this.generation++;
      this.send({
        type: "init",
        balloons: doc.balloons,
        physics: doc.physics,
        generation: this.generation,
      });
    } else
      for (const b of doc.balloons) {
        const body = this.bodies.get(b.id);
        if (body) {
          body.mesh.material.color.set(b.color);
          body.mesh.material.roughness = b.roughness;
        }
      }
    this.send({ type: "settings", physics: doc.physics });
  }
  setPlaying(value: boolean) {
    if (this.playing === value) return;
    this.playing = value;
    this.lastStep = performance.now();
    this.send({ type: "play", playing: value });
  }
  private setBackground(color: string) {
    this.windBackground.setColor(color, this.renderer);
    if (color !== this.backgroundColor) {
      this.backgroundColor = color;
      this.cb.background(color);
    }
  }
  setPalettePlaying(value: boolean) {
    if (value === this.palettePlayback.playing) return;
    if (value) this.palettePlayback.start();
    else this.palettePlayback.stop();
  }
  setSelected(id: string | null) {
    this.selected = id;
  }
  setMode(value: PlaygroundRenderer["mode"]) {
    this.mode = value;
    this.controls.enabled = value !== "draw";
    this.controls.mouseButtons.LEFT =
      value === "orbit" ? THREE.MOUSE.ROTATE : (null as unknown as THREE.MOUSE);
    this.controls.touches.ONE =
      value === "orbit" ? THREE.TOUCH.ROTATE : (null as unknown as THREE.TOUCH);
  }
  // Put the foil on a camera-facing plane so it inflates at the stroke,
  // including after orbiting or zooming the scene.
  drawingPlacement(points: Vec2[]): Pick<Balloon, "outline" | "position" | "scale" | "rotation"> {
    const depth = this.camera.position.distanceTo(this.controls.target) * 0.9;
    const size = this.camera.getViewSize(depth, new THREE.Vector2());
    const local = points.map(([x, y]): Vec2 => [(x - 0.5) * size.x, (0.5 - y) * size.y]);
    const xs = local.map(([x]) => x), ys = local.map(([, y]) => y);
    const left = Math.min(...xs), right = Math.max(...xs);
    const bottom = Math.min(...ys), top = Math.max(...ys);
    const cx = (left + right) / 2, cy = (top + bottom) / 2;
    const radius = Math.max(right - left, top - bottom) / 2;
    if (radius < 0.06) throw new Error("Draw a larger outline to inflate it.");
    const outline = prepareOutline(local.map(([x, y]) => [(x - cx) / radius, (y - cy) / radius]));
    makeMesh(outline, 1); // Reject invalid triangulations before inserting a balloon into the scene.
    const position = this.camera.localToWorld(new THREE.Vector3(cx, cy, -depth));
    const { x, y, z } = this.camera.rotation;
    return {
      outline,
      scale: THREE.MathUtils.clamp(radius, 0.25, 2),
      position: position.toArray() as Vec3,
      rotation: [x, y, z].map(THREE.MathUtils.radToDeg) as Vec3,
    };
  }
  setCamera(value: SceneDocument["camera"]) {
    this.camera.position.fromArray(value.position);
    this.controls.target.fromArray(value.target);
    this.controls.update();
  }
  front() {
    this.setCamera({ position: [0, 1.3, 9], target: [0, 0.95, 0] });
    this.onCamera();
  }
  resetMotion() {
    this.geometryKey = "";
    if (this.document) this.setScene(this.document);
  }
  snapshot(): SceneDocument {
    const doc = structuredClone(this.document!);
    doc.background = this.backgroundColor || doc.background;
    doc.camera = {
      position: this.camera.position.toArray() as Vec3,
      target: this.controls.target.toArray() as Vec3,
    };
    for (const b of doc.balloons) {
      const body = this.bodies.get(b.id);
      if (!body) continue;
      const resting = center(body.rest),
        current = center(body.coarse);
      b.position = b.position.map((v, k) =>
        Math.max(-5, Math.min(5, v + current[k] - resting[k])),
      ) as Vec3;
    }
    return doc;
  }
  private resize() {
    const rect = this.canvas.parentElement!.getBoundingClientRect();
    this.size = {
      width: Math.max(1, rect.width),
      height: Math.max(1, rect.height),
    };
    this.renderer.setSize(this.size.width, this.size.height, false);
    this.camera.aspect = this.size.width / this.size.height;
    this.camera.updateProjectionMatrix();
  }
  private hit(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    this.pointer.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      (-(e.clientY - r.top) / r.height) * 2 + 1,
    );
    this.ray.setFromCamera(this.pointer, this.camera);
    return this.ray.intersectObjects(
      Array.from(this.bodies.values()).map((b) => b.mesh),
    )[0];
  }
  private onDown = (e: PointerEvent) => {
    if (e.button !== 0 || this.mode !== "select" || this.drag) return;
    const hit = this.hit(e);
    if (!hit) {
      this.cb.select(null);
      return;
    }
    const id = hit.object.userData.id as string;
    this.cb.select(id);
    const body = this.bodies.get(id)!,
      balloon = this.document!.balloons.find((b) => b.id === id)!;
    this.drag = {
      id,
      initial: hit.point.clone(),
      plane: new THREE.Plane().setFromNormalAndCoplanarPoint(
        this.camera.getWorldDirection(new THREE.Vector3()),
        hit.point,
      ),
      origin: [...balloon.position],
      coarse: body.coarse.slice(),
      last: [...balloon.position],
      center: center(body.coarse),
      samples: [
        { point: hit.point.toArray() as Vec3, time: performance.now() },
      ],
      pointerId: e.pointerId,
      moved: false,
    };
    this.controls.enabled = false;
    this.canvas.setPointerCapture(e.pointerId);
    this.canvas.style.cursor = "grabbing";
  };
  private onMove = (e: PointerEvent) => {
    if (!this.drag || e.pointerId !== this.drag.pointerId) return;
    this.hit(e);
    const p = this.ray.ray.intersectPlane(this.drag.plane, new THREE.Vector3());
    if (!p) return;
    const now = performance.now();
    this.drag.samples.push({ point: p.toArray() as Vec3, time: now });
    this.drag.samples = this.drag.samples.filter(
      (sample) => sample.time >= now - 140,
    );
    this.drag.moved ||= p.distanceTo(this.drag.initial) > 0.015;
    if (!this.drag.moved) return;
    if (this.playing) {
      const delta = p.clone().sub(this.drag.initial);
      const point = this.drag.center.map((v, k) =>
        Math.max(k === 1 ? -0.5 : -4, Math.min(4, v + delta.getComponent(k))),
      ) as Vec3;
      this.send({ type: "grab", id: this.drag.id, point });
    } else {
      const delta = p.sub(this.drag.initial),
        coarse = this.drag.coarse.slice();
      this.drag.last = this.drag.origin.map((v, k) =>
        Math.max(-4, Math.min(4, v + delta.getComponent(k))),
      ) as Vec3;
      for (let i = 0; i < coarse.length; i++)
        coarse[i] += this.drag.last[i % 3] - this.drag.origin[i % 3];
      this.updateBody(this.bodies.get(this.drag.id)!, coarse);
    }
  };
  private onUp = (e: PointerEvent) => {
    if (!this.drag || e.pointerId !== this.drag.pointerId) return;
    if (
      !this.playing &&
      this.drag.last.some((v, k) => Math.abs(v - this.drag!.origin[k]) > 0.001)
    )
      this.cb.move(this.drag.id, this.drag.last, this.drag.origin);
    this.send({
      type: "release",
      velocity:
        e.type === "pointercancel" || !this.playing
          ? [0, 0, 0]
          : releaseVelocity(this.drag.samples, performance.now()),
    });
    if (this.canvas.hasPointerCapture(e.pointerId))
      this.canvas.releasePointerCapture(e.pointerId);
    this.drag = null;
    this.controls.enabled = this.mode !== "draw";
    this.canvas.style.cursor = "";
  };
  private selectionBox(): SelectionBox {
    if (!this.selected || this.mode === "draw") return null;
    const body = this.bodies.get(this.selected);
    if (!body) return null;
    const box = body.mesh.geometry.boundingBox!;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (let i = 0; i < 8; i++) {
      const p = new THREE.Vector3(
        i & 1 ? box.max.x : box.min.x,
        i & 2 ? box.max.y : box.min.y,
        i & 4 ? box.max.z : box.min.z,
      ).project(this.camera);
      const x = (p.x * 0.5 + 0.5) * this.size.width,
        y = (-p.y * 0.5 + 0.5) * this.size.height;
      minX = Math.min(x, minX);
      maxX = Math.max(x, maxX);
      minY = Math.min(y, minY);
      maxY = Math.max(y, maxY);
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }
  render = () => {
    if (this.disposed) return;

    this.controls.update();
    const now = performance.now();
    if (!document.hidden) {
      const nextColor = this.palettePlayback.tick(now);
      if (nextColor) this.setBackground(nextColor);
    }
    this.windBackground.update(now);
    if (this.playing && !this.waiting && !document.hidden) {
      this.waiting = true;
      this.camera.updateMatrixWorld();
      this.send({
        type: "step",
        dt: Math.min(1 / 30, (now - this.lastStep) / 1000),
        walls: viewportWalls(
          new THREE.Matrix4().multiplyMatrices(
            this.camera.projectionMatrix,
            this.camera.matrixWorldInverse,
          ).elements,
        ),
      });
      this.lastStep = now;
    }
    this.renderer.render(this.scene, this.camera);
    if (this.recording)
      this.recording.context.drawImage(
        this.canvas,
        0,
        0,
        this.recording.canvas.width,
        this.recording.canvas.height,
      );
    this.frameCount++;
    if (this.frameCount % 5 === 0) this.cb.box(this.selectionBox());
    if (now - this.lastStats > 1500) {
      const fps = (this.frameCount * 1000) / (now - this.lastStats);
      this.cb.stats(Math.round(fps), this.simMS);
      if (fps < 28 && this.renderer.getPixelRatio() > 1) {
        this.renderer.setPixelRatio(1);
        this.resize();
      }
      this.frameCount = 0;
      this.lastStats = now;
    }
  };
  async exportPNG(multiplier: number, transparent: boolean) {
    const background = this.scene.background,
      floorVisible = this.floor.visible;
    const shadowVisibility = [...this.bodies.values()].map(
      (b) => b.shadow.visible,
    );
    try {
      if (transparent) {
        this.scene.background = null;
        this.windBackground.mesh.visible = false;
        this.floor.visible = false;
        for (const b of this.bodies.values()) b.shadow.visible = false;
        this.renderer.setClearColor(0, 0);
      }
      const longEdge = 1600 * multiplier,
        ratio =
          this.document?.aspect === "square"
            ? 1
            : this.document?.aspect === "portrait"
              ? 3 / 4
              : 4 / 3;
      this.camera.aspect = ratio;
      this.camera.updateProjectionMatrix();
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(
        Math.round(ratio >= 1 ? longEdge : longEdge * ratio),
        Math.round(ratio >= 1 ? longEdge / ratio : longEdge),
        false,
      );
      this.renderer.render(this.scene, this.camera);
      return await new Promise<Blob>((resolve, reject) =>
        this.canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Image export failed."))),
          "image/png",
        ),
      );
    } finally {
      this.scene.background = background;
      this.windBackground.mesh.visible = true;
      this.floor.visible = floorVisible;
      [...this.bodies.values()].forEach(
        (b, i) => (b.shadow.visible = shadowVisibility[i]),
      );
      this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
      this.resize();
      this.renderer.render(this.scene, this.camera);
    }
  }
  startRecordingCanvas() {
    const canvas = document.createElement("canvas"),
      aspect =
        this.document?.aspect === "square"
          ? 1
          : this.document?.aspect === "portrait"
            ? 3 / 4
            : 4 / 3;
    canvas.width = Math.round(aspect >= 1 ? 1080 : 1080 * aspect);
    canvas.height = Math.round(aspect >= 1 ? 1080 / aspect : 1080);
    this.recording = { canvas, context: canvas.getContext("2d")! };
    return canvas;
  }
  stopRecordingCanvas() {
    this.recording = null;
  }
  dispose() {
    this.disposed = true;
    this.worker.terminate();
    this.observer.disconnect();
    this.controls.dispose();
    this.canvas.removeEventListener("pointerdown", this.onDown);
    this.canvas.removeEventListener("pointermove", this.onMove);
    this.canvas.removeEventListener("pointerup", this.onUp);
    this.canvas.removeEventListener("pointercancel", this.onUp);
    this.canvas.removeEventListener("contextmenu", this.onContext);
    this.canvas.removeEventListener("webglcontextlost", this.onContextLost);
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material.dispose();
      }
      if (o instanceof THREE.DirectionalLight) o.shadow.dispose();
    });
    this.windBackground.dispose();
    this.environment.dispose();
    this.shadowTexture.dispose();
    this.renderer.dispose();
  }
}
