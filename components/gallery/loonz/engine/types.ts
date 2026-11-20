export type Vec2 = [number, number];
export type Vec3 = [number, number, number];
/** Unit inward normal and constant: dot(normal, point) + constant >= 0. */
export type ViewportWall = { normal: Vec3; constant: number };
export interface Balloon {
  id: string;
  name: string;
  outline: Vec2[];
  color: string;
  position: Vec3;
  rotation: Vec3;
  scale: number;
  inflation: number;
  roughness: number;
}
export interface SceneDocument {
  version: 1;
  name: string;
  balloons: Balloon[];
  background: string;
  backgroundPalette?: { colors: string[]; holdSeconds: number };
  aspect: "landscape" | "square" | "portrait";
  camera: { position: Vec3; target: Vec3 };
  physics: { drift: number; attraction: number; softness: number };
}
export interface MeshData {
  positions: Float32Array;
  indices: Uint32Array;
  boundary: number[];
  seam: Float32Array;
}
export type WorkerInput =
  | {
      type: "init";
      balloons: Balloon[];
      physics: SceneDocument["physics"];
      generation: number;
    }
  | { type: "play"; playing: boolean }
  | { type: "settings"; physics: SceneDocument["physics"] }
  | { type: "drag"; id: string; point: Vec3; vertex: number }
  | { type: "grab"; id: string; point: Vec3 }
  | { type: "release"; velocity?: Vec3 }
  | { type: "step"; dt: number; walls?: ViewportWall[] };
export type WorkerOutput =
  | { type: "placement"; generation: number; id: string; delta: Vec3 }
  | {
      type: "frame";
      generation: number;
      bodies: { id: string; positions: Float32Array }[];
      ms: number;
    }
  | { type: "error"; message: string };
export const MAX_BALLOONS = 12;
export const cloneScene = (s: SceneDocument): SceneDocument =>
  structuredClone(s);
