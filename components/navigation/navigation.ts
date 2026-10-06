import type { ExperienceSceneKey } from '../../engine/types'
import type { SiteDestination } from '../../engine/homeNavigation'

/**
 * Shared site navigation model (homepage-redesign phase 5): the single list
 * the full-screen menu renders from, on the homepage experience and on the
 * gallery routes alike. Each item carries a typed destination; hrefs are
 * derived with engine/homeNavigation's destinationHref so the menu's anchors
 * always match what the coordinator would navigate to.
 */
export type NavigationItem = {
  id: 'home' | ExperienceSceneKey | 'gallery'
  label: string
  destination: SiteDestination
}

export const SITE_NAVIGATION: NavigationItem[] = [
  { id: 'home', label: 'Home', destination: { kind: 'home' } },
  { id: 'work', label: 'Work', destination: { kind: 'work' } },
  { id: 'vibe', label: 'Vibe', destination: { kind: 'scene', key: 'vibe' } },
  { id: 'gallery', label: 'Gallery', destination: { kind: 'route', href: '/gallery' } },
]

/** Display order shared by the homepage and gallery menus. */
export const SITE_MENU_ORDER: NavigationItem['id'][] = [
  'home',
  'work',
  'vibe',
  'gallery',
]
