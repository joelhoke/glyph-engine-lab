/** Established five-item dock occupies the former Smart-home-to-4Runner arc span. */
export function interestArcRange(width: number, _baseSize: number) {
  return { left: width * 5 / 12, right: width * 11 / 12 }
}
export function interestArcX(range: { left: number; right: number }, index: number, count: number) {
  return range.left + (range.right - range.left) * (count <= 1 ? .5 : index / (count - 1))
}
/** Match the hero carousel breakpoint, with a bottom dock on short landscape screens. */
export const INTEREST_MOBILE_QUERY = '(max-width: 767px), (max-height: 500px)'
export const isCompactInterestDock = (width: number, height: number) => width <= 767 || height <= 500
export const INTEREST_ARC = {
  apex: [0, .30] as const,
  direction: 163,
  bundle: { curve: 22, spread: 42, thickness: 65, comb: 110 },
}
