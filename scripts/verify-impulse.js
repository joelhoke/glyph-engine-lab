#!/usr/bin/env node
/**
 * Deterministic verification for engine/impulse.ts: radial click/tap impulse
 * falloff, radius boundary, zero-distance guard, determinism, and the
 * affected-particle count.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const tmpDir = path.join(projectRoot, 'tmp-verify')

try {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  fs.mkdirSync(tmpDir, { recursive: true })
  execSync(
    `npx tsc "${path.join(projectRoot, 'engine', 'impulse.ts')}" --outDir "${tmpDir}" --module commonjs --target es2020 --strict false --esModuleInterop true`,
    { stdio: 'inherit', cwd: projectRoot },
  )
} catch (error) {
  console.error('Compilation failed:', error)
  process.exit(1)
}

const { applyRadialImpulse } = require(path.join(tmpDir, 'impulse.js'))

let failures = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failures += 1
  } else {
    console.log(`PASS: ${message}`)
  }
}

function closeTo(actual, expected, epsilon = 1e-9) {
  return Math.abs(actual - expected) <= epsilon
}

const makeParticle = (x, y) => ({ x, y, vx: 0, vy: 0 })

// --- Falloff: maximal at center, zero at/above radius ---
{
  const radius = 100
  const force = 10
  const distances = [1, 25, 50, 75, 99]
  const speeds = distances.map((d) => {
    const particles = [makeParticle(d, 0)]
    applyRadialImpulse(particles, 0, 0, radius, force)
    return Math.hypot(particles[0].vx, particles[0].vy)
  })
  // linear falloff: speed at dist d is (1 - d/radius) * force
  distances.forEach((d, i) => {
    assert(
      closeTo(speeds[i], (1 - d / radius) * force),
      `kick at dist ${d} matches linear falloff`,
    )
  })
  for (let i = 1; i < speeds.length; i += 1) {
    assert(speeds[i] < speeds[i - 1], `falloff is monotonic between ${distances[i - 1]} and ${distances[i]}`)
  }

  const atEdge = [makeParticle(radius, 0)]
  const beyond = [makeParticle(radius + 1, 0)]
  assert(applyRadialImpulse(atEdge, 0, 0, radius, force) === 0, 'particle exactly at radius is untouched (count)')
  assert(atEdge[0].vx === 0 && atEdge[0].vy === 0, 'particle exactly at radius keeps zero velocity')
  assert(applyRadialImpulse(beyond, 0, 0, radius, force) === 0, 'particle beyond radius is untouched (count)')
  assert(beyond[0].vx === 0 && beyond[0].vy === 0, 'particle beyond radius keeps zero velocity')
}

// --- Direction: kick points radially away from the impact point ---
{
  const particles = [makeParticle(30, 40)] // dist 50 from origin
  applyRadialImpulse(particles, 0, 0, 100, 10)
  const p = particles[0]
  assert(closeTo(p.vx / p.vy, 30 / 40), 'kick direction is radial (matches position vector)')
  assert(p.vx > 0 && p.vy > 0, 'kick pushes away from the impact point')
}

// --- Outside-radius particles in a mixed population are untouched ---
{
  const inside = makeParticle(10, 0)
  const outside = makeParticle(500, 500)
  const particles = [inside, outside]
  outside.vx = 3
  outside.vy = -2
  const affected = applyRadialImpulse(particles, 0, 0, 100, 10)
  assert(affected === 1, 'affected count covers only in-radius particles')
  assert(inside.vx !== 0, 'in-radius particle received the kick')
  assert(outside.vx === 3 && outside.vy === -2, 'outside particle keeps its prior velocity')
}

// --- Zero-distance guard: no throw, no NaN, not counted ---
{
  const particles = [makeParticle(0, 0)]
  let affected = -1
  let threw = false
  try {
    affected = applyRadialImpulse(particles, 0, 0, 100, 10)
  } catch {
    threw = true
  }
  assert(!threw, 'zero-distance particle does not throw')
  assert(affected === 0, 'zero-distance particle is skipped (not counted)')
  assert(
    Number.isFinite(particles[0].vx) && Number.isFinite(particles[0].vy) &&
      particles[0].vx === 0 && particles[0].vy === 0,
    'zero-distance particle keeps finite zero velocity (no NaN)',
  )
}

// --- Degenerate parameters are no-ops ---
{
  const particles = [makeParticle(10, 0)]
  assert(applyRadialImpulse(particles, 0, 0, 0, 10) === 0, 'zero radius affects nothing')
  assert(applyRadialImpulse(particles, 0, 0, -5, 10) === 0, 'negative radius affects nothing')
  assert(applyRadialImpulse(particles, 0, 0, 100, 0) === 0, 'zero force affects nothing')
  assert(particles[0].vx === 0 && particles[0].vy === 0, 'no-op parameters leave velocities untouched')
}

// --- Determinism: same inputs produce identical outputs ---
{
  const build = () => [
    makeParticle(10, 5),
    makeParticle(-40, 30),
    makeParticle(0, 0),
    makeParticle(200, 0),
  ]
  const a = build()
  const b = build()
  const countA = applyRadialImpulse(a, 3, -7, 120, 8)
  const countB = applyRadialImpulse(b, 3, -7, 120, 8)
  assert(countA === countB, 'affected count is deterministic')
  assert(JSON.stringify(a) === JSON.stringify(b), 'same inputs produce identical particle states')
}

// --- Kicks accumulate on top of existing velocity ---
{
  const particles = [makeParticle(50, 0)]
  applyRadialImpulse(particles, 0, 0, 100, 10)
  applyRadialImpulse(particles, 0, 0, 100, 10)
  assert(closeTo(particles[0].vx, 2 * (1 - 50 / 100) * 10), 'repeated impulses accumulate on vx')
}

if (failures > 0) {
  console.error(`\n${failures} verification(s) failed.`)
  process.exit(1)
}

console.log('\nAll impulse verifications passed.')
