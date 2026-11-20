import { Simulation } from "./physics";
import type { WorkerInput, WorkerOutput } from "./types";
let simulation: Simulation | null = null,
  playing = false,
  generation = 0,
  accumulator = 0;
const send = (data: WorkerOutput, transfer: Transferable[] = []) =>
  self.postMessage(data, { transfer });
self.onmessage = (event: MessageEvent<WorkerInput>) => {
  const m = event.data;
  try {
    if (m.type === "init") {
      simulation = new Simulation(m.balloons, m.physics);
      generation = m.generation;
      accumulator = 0;
    }
    if (m.type === "play") {
      playing = m.playing;
      accumulator = 0;
    }
    if (!simulation) return;
    if (m.type === "settings") simulation.settings = m.physics;
    if (m.type === "drag")
      simulation.drag = { id: m.id, point: m.point, vertex: m.vertex };
    if (m.type === "grab") simulation.grab = { id: m.id, point: m.point };
    if (m.type === "release") {
      const placement = simulation.release(m.velocity);
      if (placement) send({ type: "placement", generation, ...placement });
    }
    if (m.type === "step") {
      if (m.walls) simulation.walls = m.walls;
      const start = performance.now();
      if (playing) {
        accumulator = Math.min(1 / 30, accumulator + Math.max(0, m.dt));
        while (accumulator >= 1 / 60 - 1e-6) {
          simulation.step(1 / 60);
          accumulator -= 1 / 60;
        }
      }
      const bodies = simulation.bodies.map((b) => ({
        id: b.id,
        positions: b.p.slice(),
      }));
      send(
        { type: "frame", generation, bodies, ms: performance.now() - start },
        bodies.map((b) => b.positions.buffer),
      );
    }
  } catch (e) {
    playing = false;
    send({
      type: "error",
      message: e instanceof Error ? e.message : "Simulation could not start.",
    });
  }
};
