export type VibeToolCategory =
  | 'upload'
  | 'text'
  | 'colorStyles'
  | 'paint'
  | 'motion'
  | 'ambient'
  /** Debug-only (dev ?debug=true): the Private Pond experiment. The toolbar
   *  filters this category out unless its debugMode prop is set. */
  | 'pond'
  /** Debug-only (dev ?debug=true): the Visual Sonification experiment. The
   *  toolbar filters this category out unless its debugMode prop is set. */
  | 'sound'

export type VibeUtilityAction = 'undo' | 'redo' | 'refresh' | 'share'

export type CategoryConfig = {
  id: VibeToolCategory
  label: string
  icon: string
  disabled: boolean
  unavailableReason?: string
}

export type UtilityConfig = {
  id: VibeUtilityAction
  label: string
  icon: string
}

export const VIBE_TOOLBAR_CATEGORIES: CategoryConfig[] = [
  { id: 'upload', label: 'Upload', icon: '/toolbar/Upload-icon.svg', disabled: false },
  { id: 'text', label: 'Text Effects', icon: '/toolbar/TextEffects-icon.svg', disabled: false },
  { id: 'colorStyles', label: 'Color Styles', icon: '/toolbar/ColorStyles-icon.png', disabled: false },
  { id: 'paint', label: 'Paint', icon: '/toolbar/Paint-icon.svg', disabled: false },
  { id: 'motion', label: 'Motion Effects', icon: '/toolbar/MotionEffects-icon.png', disabled: false },
  { id: 'ambient', label: 'Ambient', icon: '/toolbar/Ambient-icon.svg', disabled: false },
  { id: 'pond', label: 'Pond', icon: '/toolbar/Pond-icon.svg', disabled: false },
  { id: 'sound', label: 'Sound', icon: '/toolbar/Sound-icon.svg', disabled: false },
]

/** Debug-only categories (dev ?debug=true experiments): filtered out of the
 *  toolbar entirely — never merely disabled, never rendered — unless
 *  VibeToolbar's debugMode prop is set. */
export const DEBUG_ONLY_CATEGORIES: ReadonlySet<VibeToolCategory> = new Set(['pond', 'sound'])

export const VIBE_TOOLBAR_UTILITIES: UtilityConfig[] = [
  { id: 'undo', label: 'Undo', icon: '/toolbar/undo-icon.svg' },
  { id: 'redo', label: 'Redo', icon: '/toolbar/redo-icon.png' },
  { id: 'refresh', label: 'Refresh', icon: '/toolbar/refresh-icon.svg' },
  { id: 'share', label: 'Share', icon: '/toolbar/share-icon.svg' },
]

export type VibeToolbarTool = VibeToolCategory | null
