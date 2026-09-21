/** One brief startup pulse, then a steady picture. A direct jump to 1
 *  (reduced motion) skips the pulse entirely. Power-down is a simple fade. */
export function crtPower(amount: number, rising: boolean) {
  const power = Math.max(0, Math.min(1, amount))
  return {
    picture: rising ? Math.max(0, (power - 0.5) * 2) : power,
    pulse: rising && power > 0.08 && power < 0.38 ? Math.sin((power - 0.08) / 0.3 * Math.PI) : 0,
  }
}
