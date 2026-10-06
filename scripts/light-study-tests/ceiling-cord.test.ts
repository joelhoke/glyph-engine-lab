import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CordSimulation } from '../../components/home/light-study/physics';
import { CORD } from '../../components/home/light-study/config';

function advance(simulation: CordSimulation, seconds: number) {
  for (let i = 0; i < seconds / CORD.timestep; i++) simulation.advance(CORD.timestep);
}

test('a desktop pull moves the entire cord below the ceiling, with no fixed middle joint', () => {
  for (const extension of [0.05, 0.25, 0.6]) {
    const simulation = new CordSimulation();
    const anchor = { x: 0, y: CORD.anchor.y + extension };
    const length = CORD.length + extension;
    simulation.setSuspension(anchor, length);
    assert.ok(Math.abs(simulation.end.y - (CORD.anchor.y - CORD.length)) < 1e-10, 'resting bulb position stays unchanged');
    assert.equal(simulation.points.filter(p => p.weight === 0).length, 1, 'only the ceiling is pinned');
    simulation.beginDrag(0);
    simulation.dragTo({ x: length * 0.6, y: anchor.y - length * 0.8 }, 100);
    advance(simulation, 3);
    assert.equal(simulation.points[0].x, anchor.x);
    assert.equal(simulation.points[0].y, anchor.y);
    assert.ok(simulation.points[1].x > 0.002, 'the cord moves immediately below the actual ceiling');
    const oldAnchor = simulation.points.reduce((nearest, p) => Math.abs(p.y - CORD.anchor.y) < Math.abs(nearest.y - CORD.anchor.y) ? p : nearest);
    assert.ok(oldAnchor.x > 0.01, 'the former midair anchor follows the pull');
    for (let i = 1; i < simulation.points.length; i++) {
      const a = simulation.points[i - 1], b = simulation.points[i];
      assert.ok(Math.hypot(b.x - a.x, b.y - a.y) <= simulation.segmentRestLength(i - 1) * (1 + CORD.maxStretch) + 1e-8);
    }
    assert.ok(simulation.segmentCount <= simulation.maxSegments);
    simulation.release(4000);
    advance(simulation, 30);
    assert.equal(simulation.awake, false);
    assert.ok(Math.abs(simulation.end.x) < CORD.sleepOffset);
    assert.equal(simulation.deployedLength, length);
  }
});

test('unchanged layout preserves an ongoing pull; returning to mobile restores upstream suspension', () => {
  const simulation = new CordSimulation();
  simulation.setSuspension({ x: 0, y: 0.9 }, 0.56);
  simulation.beginDrag(0);
  simulation.dragTo({ x: 0.3, y: 0.5 }, 100);
  advance(simulation, 0.5);
  const end = { ...simulation.end };
  assert.equal(simulation.setSuspension({ x: 0, y: 0.9 }, 0.56), false);
  assert.equal(simulation.dragging, true);
  assert.deepEqual(simulation.end, end);
  simulation.setSuspension(CORD.anchor, CORD.length);
  assert.equal(simulation.segmentCount, CORD.segments);
  assert.equal(simulation.points[0].y, CORD.anchor.y);
  assert.equal(simulation.end.y, CORD.anchor.y - CORD.length);
  assert.equal(simulation.awake, false);
});
