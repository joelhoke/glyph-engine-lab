// Side-by-side reference composition: F1 left, 4Runner right, on one road.
export const GARAGE_COMPOSITION = [
  { id: 'lighting', scale: 1, x: 1.9, z: -1.93 },
  { id: 'mclaren', scale: .82, x: -1.85, z: .01 },
];
export function placeGarageVehicle(vehicle, { scale, x, z }) {
  // Scale the canonical centering/ground offset together with the object.
  vehicle.scale.multiplyScalar(scale);
  vehicle.position.multiplyScalar(scale);
  vehicle.position.x += x;
  vehicle.position.z += z;
  vehicle.updateMatrixWorld(true);
}
