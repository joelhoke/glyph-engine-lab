import * as THREE from 'three';

export type LayoutRect = { left: number; top: number; width: number; height: number };
export type StudyLayout = { heading: LayoutRect; artwork: LayoutRect; mobile: boolean };

export function pixelsPerMetre(camera: THREE.PerspectiveCamera, viewportHeight: number, z: number) {
  return viewportHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (camera.position.z - z));
}

export function projectedBounds(object: THREE.Object3D, points: THREE.Vector3[], camera: THREE.Camera, width: number, height: number) {
  object.updateWorldMatrix(true, true);
  camera.updateMatrixWorld(true);
  const bounds = new THREE.Box2();
  for (const point of points) {
    const p = point.clone().applyMatrix4(object.matrixWorld).project(camera);
    bounds.expandByPoint(new THREE.Vector2((p.x + 1) * width / 2, (1 - p.y) * height / 2));
  }
  return bounds;
}

/** Fit real geometry to a CSS slot. Correct perspective at the extruded front,
 * rather than aligning a text centre or the transparent padding of a PNG. */
export function fitToRect(object: THREE.Object3D, points: THREE.Vector3[], target: LayoutRect,
  camera: THREE.PerspectiveCamera, width: number, height: number, align: 'left' | 'center') {
  if (!points.length || !width || !height || !target.width || !target.height) return;
  object.position.x = object.position.y = 0;
  object.scale.setScalar(1);
  for (let i = 0; i < 6; i++) {
    let bounds = projectedBounds(object, points, camera, width, height);
    const size = bounds.getSize(new THREE.Vector2());
    const scale = Math.min(target.width / size.x, target.height / size.y);
    object.scale.multiplyScalar(scale);
    bounds = projectedBounds(object, points, camera, width, height);
    const center = bounds.getCenter(new THREE.Vector2());
    const z = object.getWorldPosition(new THREE.Vector3()).z;
    const ppm = pixelsPerMetre(camera, height, z);
    object.position.x += ((align === 'left' ? target.left - bounds.min.x : target.left + target.width / 2 - center.x)) / ppm;
    object.position.y -= (target.top + target.height / 2 - center.y) / ppm;
  }
}
