'use client'

import { useMobileDock } from '../useMobileDock'
import { DOCK_SLOTS } from './heroDock'
import { MOBILE_INITIAL_SLOT } from './mobileHero'
import type { HeroSlotId } from '../../content/home'

const focusTarget = (slot: HeroSlotId) => `[data-slot="${slot}"] .home-hero-slot-link`
export function useMobileHero(hero: HTMLElement | null, active: boolean) {
  return useMobileDock(hero, active, { slots: DOCK_SLOTS, initialSlot: MOBILE_INITIAL_SLOT, focusTarget })
}
