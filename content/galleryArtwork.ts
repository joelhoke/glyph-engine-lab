import type { GalleryPalette } from '../components/gallery/galleryTypes'

/** Supplied starter palettes. Each study stays inside one complete palette. */
export const GALLERY_PALETTES: readonly GalleryPalette[] = [
  { id: 'electric', name: 'Electric', colors: ['#4ACDFF', '#00ACFF', '#5899FF', '#B281FF', '#FA46FF'] },
  { id: 'twilight', name: 'Twilight', colors: ['#F2C9E4', '#C2C4F2', '#5B9ED9', '#7754F5', '#46718C'] },
  { id: 'botanical', name: 'Botanical', colors: ['#DEE8C3', '#C3E8C6', '#CFE9C3', '#E8E6C3', '#C3E8D3', '#DAE8D3'] },
  { id: 'soft-contrast', name: 'Soft Contrast', colors: ['#ACE6E2', '#DCEDC1', '#FFD3B6', '#B3718B', '#E2C2EA'] },
  { id: 'dusk', name: 'Dusk', colors: ['#682E4D', '#384B8D', '#727CB8', '#292D57', '#CAC9D1'] },
  { id: 'sunset', name: 'Sunset', colors: ['#FA8952', '#FABF52', '#FAA652', '#FAA596', '#FAD352', '#FAD3AD'] },
  { id: 'neon-tide', name: 'Neon Tide', colors: ['#F0028D', '#8A278D', '#3A336A', '#054674', '#12CAB5'] },
]
/** Preview experiment: switch back to 'pixels' to restore the original mesh. */
export const GALLERY_ARTWORK_RENDERER: 'ascii' | 'pixels' = 'ascii'
