import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { prepareFilament, setFilamentEmission } from '../../components/home/light-study/filament';

test('switching off removes emission while preserving an opaque, ambient-lit coil', () => {
  const material = new THREE.MeshStandardMaterial({ name: 'glow', color: '#191310' });
  prepareFilament(material);
  const wireColor = material.color.clone();
  const originalGeometry = new THREE.TorusGeometry(1, 0.05);
  const wire = new THREE.Mesh(originalGeometry, material);
  for (const color of ['#8abaff', '#528ed1', '#ffe5ab']) {
    setFilamentEmission(material, new THREE.Color(color), 2);
    assert.ok(material.emissiveIntensity > 0);
    setFilamentEmission(material, new THREE.Color(color), 0);
    assert.equal(material.emissiveIntensity, 0);
    assert.ok(material.color.equals(wireColor));
    assert.ok(Math.min(material.color.r, material.color.g, material.color.b) > 0.25, 'wire retains a visible diffuse surface');
    assert.equal(material.opacity, 1);
    assert.equal(material.transparent, false);
    assert.equal(material.visible && wire.visible, true);
    assert.equal(wire.geometry, originalGeometry);
  }
  material.dispose(); originalGeometry.dispose();
});
