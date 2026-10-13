import type { HomeImage } from './home'
import appleCollection from './apple-tv-collection.json'
import xboxCollection from './xbox-collection.json'
import profiles from './media-profiles.json'
import musicCollection from './apple-music-collection.json'

/** Only intentionally shared titles belong here, never raw account exports. */
export type MediaPick = {
  id: string
  title: string
  source: string
  note?: string
  url?: string
  image?: HomeImage
}

export const MEDIA_VIEWS = [
  { id: 'comics', label: 'Comics' },
  { id: 'watching', label: 'Movies' },
  { id: 'gaming', label: 'Games' },
  { id: 'listening', label: 'Music' },
] as const
export type MediaView = typeof MEDIA_VIEWS[number]['id']

export const MEDIA_PROFILES = profiles

// Generated locally from the TV library; profile handles are not activity feeds.
export const WATCHING_PICKS: readonly MediaPick[] = appleCollection
export const GAMING_PICKS: readonly MediaPick[] = xboxCollection
export const LISTENING_PICKS: readonly MediaPick[] = musicCollection
