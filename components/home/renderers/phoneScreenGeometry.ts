/** Glass rectangle measured from the shipped phone's texture atlas. */
export const PHONE_SCREEN_RECT = { left: 0.11, right: 0.11, top: 0.238, bottom: 0.23 }

export function phoneScreenCorners(THREE: typeof import('three'), lid: import('three').Mesh) {
  const box = lid.geometry.boundingBox!
  const w = box.max.x - box.min.x, h = box.max.y - box.min.y
  const left = box.min.x + PHONE_SCREEN_RECT.left * w
  const right = box.max.x - PHONE_SCREEN_RECT.right * w
  const top = box.max.y - PHONE_SCREEN_RECT.top * h
  const bottom = box.min.y + PHONE_SCREEN_RECT.bottom * h
  // The shipped lid's front LCD face, just above its glass, in local space.
  const z = -0.85987 + 0.006
  return [[left, top], [right, top], [right, bottom], [left, bottom]]
    .map(([x, y]) => lid.localToWorld(new THREE.Vector3(x, y, z)))
}
