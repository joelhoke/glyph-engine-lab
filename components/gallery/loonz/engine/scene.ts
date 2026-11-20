import { prepareOutline, validateOutline } from "./geometry";
import {
  MAX_BALLOONS,
  type Balloon,
  type SceneDocument,
  type Vec2,
} from "./types";
export const PALETTE = [
  "#e9e5e7",
  "#f54180",
  "#e8ae38",
  "#214bea",
  "#9dc99a",
  "#b08bdd",
  "#ec7236",
];
export function shape(
  kind: "heart" | "flower" | "blob" | "circle" | "star",
): Vec2[] {
  const points: Vec2[] = [];
  for (let i = 0; i < 100; i++) {
    const t = (i / 100) * Math.PI * 2;
    if (kind === "heart")
      points.push([
        Math.pow(Math.sin(t), 3),
        (13 * Math.cos(t) -
          5 * Math.cos(2 * t) -
          2 * Math.cos(3 * t) -
          Math.cos(4 * t)) /
          17,
      ]);
    else {
      const r =
        kind === "flower"
          ? 0.77 + 0.24 * Math.cos(5 * t)
          : kind === "star"
            ? 0.72 + 0.25 * Math.cos(4 * t)
            : kind === "blob"
              ? 0.85 + 0.13 * Math.sin(3 * t + 0.4) + 0.08 * Math.cos(2 * t)
              : 0.85;
      points.push([Math.cos(t) * r, Math.sin(t) * r]);
    }
  }
  return prepareOutline(points);
}
export function newBalloon(outline: Vec2[], index: number): Balloon {
  return {
    id: crypto.randomUUID(),
    name: `Balloon ${String(index + 1).padStart(2, "0")}`,
    outline,
    color: PALETTE[index % PALETTE.length],
    position: [0, 0.8, 1],
    rotation: [0, 0, 0],
    scale: 0.85,
    inflation: 1,
    roughness: 0.16,
  };
}
export function defaultScene(): SceneDocument {
  const configs: {
    name: string;
    kind: Parameters<typeof shape>[0];
    color: string;
    p: [number, number, number];
    s: number;
    r: [number, number, number];
  }[] = [
    {
      name: "Silver spark",
      kind: "star",
      color: PALETTE[0],
      p: [-0.78, 1.6, -0.28],
      s: 0.78,
      r: [5, -15, 17],
    },
    {
      name: "Golden flower",
      kind: "flower",
      color: PALETTE[2],
      p: [0.78, 1.52, -0.16],
      s: 0.82,
      r: [-8, -15, 20],
    },
    {
      name: "Love note",
      kind: "heart",
      color: PALETTE[1],
      p: [-0.12, 0.36, 0.35],
      s: 0.76,
      r: [5, -5, -12],
    },
  ];
  return {
    version: 1,
    name: "A little lighter",
    balloons: configs.map((c, i) => ({
      ...newBalloon(shape(c.kind), i),
      id: `starter-${c.kind}`,
      name: c.name,
      color: c.color,
      position: c.p,
      scale: c.s,
      rotation: c.r,
    })),
    background: "#e9adca",
    aspect: "landscape",
    camera: { position: [0, 1.3, 9], target: [0, 0.95, 0] },
    physics: { drift: 0.55, attraction: 0.5, softness: 0.4 },
  };
}
const num = (x: unknown, min: number, max: number): x is number =>
  typeof x === "number" && Number.isFinite(x) && x >= min && x <= max;
const vec = (x: unknown, min: number, max: number) =>
  Array.isArray(x) && x.length === 3 && x.every((v) => num(v, min, max));
const color = (x: unknown) =>
  typeof x === "string" && /^#[0-9a-f]{6}$/i.test(x);
export function parseScene(text: string): SceneDocument {
  if (text.length > 2_000_000) throw new Error("This scene file is too large.");
  const s = JSON.parse(text);
  if (s?.version !== 1) throw new Error("This scene version is not supported.");
  if (
    typeof s.name !== "string" ||
    s.name.length > 100 ||
    !Array.isArray(s.balloons) ||
    s.balloons.length > MAX_BALLOONS ||
    !color(s.background) ||
    !["landscape", "square", "portrait"].includes(s.aspect)
  )
    throw new Error("This file is not a valid Loonz scene.");
  const ids = new Set<string>();
  if (
    s.backgroundPalette !== undefined &&
    (!s.backgroundPalette ||
      !Array.isArray(s.backgroundPalette.colors) ||
      s.backgroundPalette.colors.length < 2 ||
      s.backgroundPalette.colors.length > 8 ||
      !s.backgroundPalette.colors.every(color) ||
      !num(s.backgroundPalette.holdSeconds, 0, 8))
  )
    throw new Error(
      "The background palette needs 2–8 valid colors and a hold time from 0 to 8 seconds.",
    );
  for (const b of s.balloons) {
    if (
      typeof b.id !== "string" ||
      ids.has(b.id) ||
      typeof b.name !== "string" ||
      b.name.length > 100 ||
      !color(b.color) ||
      !vec(b.position, -5, 5) ||
      !vec(b.rotation, -360, 360) ||
      !num(b.scale, 0.25, 2) ||
      !num(b.inflation, 0.3, 1.8) ||
      !num(b.roughness, 0.08, 0.5) ||
      !Array.isArray(b.outline)
    )
      throw new Error("A balloon in this file has invalid settings.");
    validateOutline(b.outline);
    ids.add(b.id);
  }
  if (
    !vec(s.camera?.position, -30, 30) ||
    !vec(s.camera?.target, -5, 5) ||
    Math.hypot(
      ...s.camera.position.map(
        (v: number, i: number) => v - s.camera.target[i],
      ),
    ) < 1 ||
    !["drift", "attraction", "softness"].every((k) => num(s.physics?.[k], 0, 1))
  )
    throw new Error("The scene camera or physics settings are invalid.");
  // Whitelist fields so imported metadata never enters application state.
  return {
    version: 1,
    name: s.name,
    background: s.background,
    ...(s.backgroundPalette === undefined
      ? {}
      : {
          backgroundPalette: {
            colors: [...s.backgroundPalette.colors],
            holdSeconds: s.backgroundPalette.holdSeconds,
          },
        }),
    aspect: s.aspect,
    camera: { position: s.camera.position, target: s.camera.target },
    physics: {
      drift: s.physics.drift,
      attraction: s.physics.attraction,
      softness: s.physics.softness,
    },
    balloons: s.balloons.map((b: Balloon) => ({
      id: b.id,
      name: b.name,
      outline: b.outline,
      color: b.color,
      position: b.position,
      rotation: b.rotation,
      scale: b.scale,
      inflation: b.inflation,
      roughness: b.roughness,
    })),
  };
}
function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("loonz", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("scenes");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function saveLocal(scene: SceneDocument) {
  const d = await db();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = d.transaction("scenes", "readwrite");
      tx.objectStore("scenes").put(JSON.stringify(scene), "current");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    d.close();
  }
}
export async function loadLocal(): Promise<SceneDocument | null> {
  const d = await db();
  try {
    return await new Promise((resolve, reject) => {
      const req = d.transaction("scenes").objectStore("scenes").get("current");
      req.onsuccess = () => {
        try {
          resolve(req.result ? parseScene(req.result) : null);
        } catch (e) {
          reject(e);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } finally {
    d.close();
  }
}
export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
