/** One persistent track sized from the displayed cars and their travel distance. */
export function garageRoadBounds(entries, cameraFit = 1) {
  const travel = 14 * cameraFit;
  return {
    left: Math.min(...entries.map(entry => entry.x - 2.1 * entry.scale)),
    right: Math.max(...entries.map(entry => entry.x + 2.1 * entry.scale)),
    far: Math.floor((Math.min(...entries.map(entry => entry.z - 2.4 * entry.scale)) - travel - 4) / 2) * 2,
    near: Math.ceil((Math.max(...entries.map(entry => entry.z + 2.4 * entry.scale)) + travel * 1.35 + 4) / 2) * 2,
  };
}
export function createGarageRoad(THREE, scene, entries) {
  const object = new THREE.Group(); object.name = 'garage-road'; scene.add(object);
  const geometry = new THREE.PlaneGeometry(.065, 1);
  const material = new THREE.MeshStandardMaterial({ color: 0xc4d9ef, roughness: .8, transparent: true, opacity: .35 });
  let marks, fit;
  return { object,
    setFit(next) {
      if (fit === next) return;
      fit = next;
      const {left,right,far,near} = garageRoadBounds(entries,fit);
      if (marks) { object.remove(marks); marks.dispose(); }
      const rows = (near - far) / 2 + 1;
      // Extending the track keeps one draw call, rather than adding a mesh per dash.
      marks = new THREE.InstancedMesh(geometry, material, rows * 2);
      marks.name = 'road-markings';
      const transform = new THREE.Object3D(); transform.rotation.x = -Math.PI / 2;
      for (let i = 0; i < rows; i++) for (let edge = 0; edge < 2; edge++) {
        transform.position.set(edge ? right : left, -.005, far + i * 2);
        transform.updateMatrix(); marks.setMatrixAt(i * 2 + edge, transform.matrix);
      }
      marks.instanceMatrix.needsUpdate = true; object.add(marks);
    },
    dispose() { marks?.dispose(); }, // Shared scene disposal owns geometry/material.
  };
}
