export type PhoneModelKey = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '*' | '0' | '#'
  | 'send' | 'backspace' | 'chat' | 'popout'

/** Printed key regions on the original GLTF's texture atlas (V grows down
 *  the source image). Used only after a ray hits the visible keypad mesh.
 *  The original ABC/DEF/... labels and key surfaces are left untouched. */
export type PhoneModelKeyRegion = { key: PhoneModelKey; u: number; v: number; halfWidth: number; halfHeight: number }
export const PHONE_MODEL_KEYS: PhoneModelKeyRegion[] = [
  ...(['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'] as const).map((key, index) => ({
    key,
    u: [0.433, 0.506, 0.579][index % 3],
    v: [0.75, 0.695, 0.64, 0.583][Math.floor(index / 3)],
    halfWidth: 0.030,
    halfHeight: 0.023,
  })),
  { key: 'send', u: 0.506, v: 0.87, halfWidth: 0.043, halfHeight: 0.042 }, // OK
  { key: 'send', u: 0.441, v: 0.807, halfWidth: 0.036, halfHeight: 0.020 }, // Green call
  { key: 'backspace', u: 0.583, v: 0.87, halfWidth: 0.029, halfHeight: 0.026 }, // Return arrow
  { key: 'chat', u: 0.433, v: 0.87, halfWidth: 0.026, halfHeight: 0.026 }, // Message icon
  { key: 'popout', u: 0.579, v: 0.807, halfWidth: 0.034, halfHeight: 0.020 }, // Red end
  { key: 'chat', u: 0.435, v: 0.931, halfWidth: 0.035, halfHeight: 0.022 }, // Left soft key
  { key: 'backspace', u: 0.577, v: 0.931, halfWidth: 0.035, halfHeight: 0.022 }, // Right soft key
]

export function phoneModelKeyAtUv(uv: { x: number; y: number }): PhoneModelKey | null {
  return phoneModelRegionAtUv(uv)?.key ?? null
}

export function phoneModelRegionAtUv(uv: { x: number; y: number }): PhoneModelKeyRegion | null {
  return PHONE_MODEL_KEYS.find(region => Math.abs(uv.x - region.u) <= region.halfWidth &&
    Math.abs(uv.y - region.v) <= region.halfHeight) ?? null
}
