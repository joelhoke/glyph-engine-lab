import type { PageIllumination } from '../home/light-study/illumination'

// A newly mounted hero must receive the current lights even when reduced motion
// has parked the background renderer. Keep one snapshot owned by that page.
const latest = new WeakMap<Element, PageIllumination>()
export function publishPageIllumination(source: Element, lights: PageIllumination) {
  const page = source.closest('[data-lighting-page], [data-about-desktop]') ?? source
  latest.set(page, lights)
  source.dispatchEvent(new CustomEvent('study-illumination', { bubbles: true, detail: lights }))
}
export function currentPageIllumination(page: Element): PageIllumination {
  return latest.get(page) ?? []
}
