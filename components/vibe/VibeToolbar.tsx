'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { BorderBeam } from 'border-beam'
import { PlaygroundConfig } from '../../engine/playgroundConfig'
import { PaintStatus, PaintToolConfig } from '../../engine/paint'
import { PondConfig } from '../../engine/pondConfig'
import { SonificationConfig } from '../../engine/sonificationConfig'
import type { SonificationPlaybackState } from '../../engine/sonificationEngine'
import { VibePreset } from '../../content/vibe'
import { SceneCanvasHandle } from '../SceneCanvas'
import {
  CategoryConfig,
  DEBUG_ONLY_CATEGORIES,
  UtilityConfig,
  VIBE_TOOLBAR_CATEGORIES,
  VIBE_TOOLBAR_UTILITIES,
  VibeToolbarTool,
} from './toolbarConfig'
import UploadPanel from './UploadPanel'
import TextEffectsPanel from './TextEffectsPanel'
import ColorStylesPanel from './ColorStylesPanel'
import PaintPanel from './PaintPanel'
import MotionEffectsPanel from './MotionEffectsPanel'
import AmbientPanel from './AmbientPanel'
import PondPanel from './PondPanel'
import SoundPanel from './SoundPanel'

export type VibeToolbarProps = {
  open: boolean
  config: PlaygroundConfig
  onChange: (patch: Partial<PlaygroundConfig>, historyKey?: string) => void
  onCommitGlyphText: (text: string) => void
  presets: VibePreset[]
  onSelectPreset: (id: string) => void
  onUpload: (file: File) => void
  privacyNote: string
  uploadPending: boolean
  uploadPendingLabel: string
  uploadError: string | null
  uploadedFilename: string
  paintTool: PaintToolConfig
  onPaintToolChange: (patch: Partial<PaintToolConfig>, historyKey?: string) => void
  paintStatus: PaintStatus | null
  /** Unified vibe-history flags (already gated on uploadPending). */
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  /** Refresh: full curated reset (config, paint, paint tool, source, history). */
  onReset: () => void
  /** Paint popout action: clear the paint overlay (one history transaction). */
  onClearPaint: () => void
  /** Scene canvas handle for the share PNG export. */
  canvasRef: React.RefObject<SceneCanvasHandle>
  /** Dev ?debug=true: reveals debug-only categories (DEBUG_ONLY_CATEGORIES —
   *  e.g. Visual Sonification). Production visitors never see them — the
   *  category is not rendered at all. */
  debugMode?: boolean
  /** Session-only Private Pond experiment config (debug-only); never enters
   *  history/presets/sharing. */
  pond?: PondConfig
  onPondChange?: (next: PondConfig) => void
  /** Session-only Visual Sonification experiment state (debug-only). */
  sound?: {
    config: SonificationConfig
    playback: SonificationPlaybackState
    error: string | null
  }
  onSoundConfigChange?: (next: SonificationConfig) => void
  onSoundPlay?: () => void
  onSoundPause?: () => void
  id?: string
}

const TOUCH_TARGET_MIN_PX = 44

/** Icons render as CSS masks over currentColor, so SVG and PNG assets share
 *  size, color, and disabled/hover/focus states driven from CSS. */
const iconMaskStyle = (icon: string): React.CSSProperties => ({
  WebkitMaskImage: `url(${icon})`,
  maskImage: `url(${icon})`,
})

export default function VibeToolbar({
  open,
  config,
  onChange,
  onCommitGlyphText,
  presets,
  onSelectPreset,
  onUpload,
  privacyNote,
  uploadPending,
  uploadPendingLabel,
  uploadError,
  uploadedFilename,
  paintTool,
  onPaintToolChange,
  paintStatus,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onReset,
  onClearPaint,
  canvasRef,
  debugMode = false,
  pond,
  onPondChange,
  sound,
  onSoundConfigChange,
  onSoundPlay,
  onSoundPause,
  id: externalId,
}: VibeToolbarProps) {
  const generatedId = useId().replace(/:/g, '-')
  const stableId = externalId ?? generatedId
  const panelId = `vibe-toolbar-panel-${stableId}`
  const [mounted, setMounted] = useState(false)
  // No popout on activation: the toolbar opens with every category closed.
  const [selectedTool, setSelectedTool] = useState<VibeToolbarTool>(null)
  const [pointerLeft, setPointerLeft] = useState<number | null>(null)
  const [shareFeedback, setShareFeedback] = useState<string | null>(null)
  // Roving tabindex: the button that owns Tab focus within each row.
  const [categoryFocusIndex, setCategoryFocusIndex] = useState(0)
  const [utilityFocusIndex, setUtilityFocusIndex] = useState(0)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const capsuleRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const categoryButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const utilityButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const shareFeedbackTimeoutRef = useRef<number | null>(null)

  // Debug-only categories (DEBUG_ONLY_CATEGORIES — Visual Sonification) are
  // filtered out entirely unless the dev ?debug=true mode is on — never
  // merely disabled, never rendered.
  const visibleCategories = useMemo(
    () => VIBE_TOOLBAR_CATEGORIES.filter((category) => !DEBUG_ONLY_CATEGORIES.has(category.id) || debugMode),
    [debugMode],
  )

  useEffect(() => {
    setMounted(true)
    return () => {
      if (shareFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(shareFeedbackTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    // Every appearance starts with no popout open; focus lands on the first
    // available category button.
    setSelectedTool(null)
    if (!open) return
    const firstIndex = visibleCategories.findIndex((c) => !c.disabled)
    if (firstIndex >= 0) {
      setCategoryFocusIndex(firstIndex)
      const firstId = visibleCategories[firstIndex].id
      categoryButtonRefs.current[firstId]?.focus()
    }
  }, [open, visibleCategories])

  const activeCategoryButton = selectedTool ? categoryButtonRefs.current[selectedTool] : null

  const computePointer = () => {
    const button = activeCategoryButton
    const panel = panelRef.current
    if (!button || !panel) {
      setPointerLeft(null)
      return
    }
    const buttonRect = button.getBoundingClientRect()
    const panelRect = panel.getBoundingClientRect()
    const buttonCenter = buttonRect.left + buttonRect.width / 2
    const left = buttonCenter - panelRect.left
    const min = 18
    const max = Math.max(min, panelRect.width - min)
    setPointerLeft(Math.min(max, Math.max(min, left)))
  }

  useEffect(() => {
    computePointer()
    const handleResize = () => computePointer()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTool])

  // Escape closes the open popout and returns focus to its invoking button.
  // With no popout open Escape does NOTHING — the toolbar deliberately has no
  // collapse affordance.
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      const isComposing = (event as any).isComposing === true
      if (isComposing) return
      if (!selectedTool) return
      event.preventDefault()
      closePanel()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedTool])

  useEffect(() => {
    if (!selectedTool) return
    const handlePointerDown = (event: MouseEvent | PointerEvent) => {
      const target = event.target as Node | null
      const panel = panelRef.current
      const button = activeCategoryButton
      if (button && button.contains(target as Node)) return
      if (panel && panel.contains(target as Node)) return
      closePanel()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTool, activeCategoryButton])

  const closePanel = () => {
    setSelectedTool(null)
    activeCategoryButton?.focus()
  }

  const handleCategoryClick = (category: CategoryConfig) => {
    if (category.disabled) return
    if (selectedTool === category.id) {
      closePanel()
      return
    }
    setSelectedTool(category.id)
  }

  // Roving arrow-key focus across the row: ArrowLeft/ArrowRight (and
  // Home/End) move focus between the enabled buttons; Tab enters the row on
  // the roving index only.
  const handleRowKeyDown = (
    event: React.KeyboardEvent,
    ids: string[],
    refs: Record<string, HTMLButtonElement | null>,
    focusIndex: number,
    setFocusIndex: (index: number) => void,
  ) => {
    let nextIndex: number | null = null
    if (event.key === 'ArrowRight') {
      nextIndex = ids.length === 0 ? null : (focusIndex + 1) % ids.length
    } else if (event.key === 'ArrowLeft') {
      nextIndex = ids.length === 0 ? null : (focusIndex - 1 + ids.length) % ids.length
    } else if (event.key === 'Home') {
      nextIndex = ids.length === 0 ? null : 0
    } else if (event.key === 'End') {
      nextIndex = ids.length === 0 ? null : ids.length - 1
    }
    if (nextIndex === null) return
    event.preventDefault()
    setFocusIndex(nextIndex)
    refs[ids[nextIndex]]?.focus()
  }

  const enabledCategoryIds = visibleCategories.filter((c) => !c.disabled).map((c) => c.id)
  const utilityIds = VIBE_TOOLBAR_UTILITIES.map((u) => u.id)

  const renderCategoryButton = (category: CategoryConfig) => {
    const isActive = selectedTool === category.id && !category.disabled
    const label = category.disabled
      ? `${category.label} (${category.unavailableReason ?? 'unavailable'})`
      : category.label
    const rovingIndex = enabledCategoryIds.indexOf(category.id)
    return (
      <button
        key={category.id}
        ref={(el) => {
          categoryButtonRefs.current[category.id] = el
        }}
        type="button"
        disabled={category.disabled}
        tabIndex={category.disabled ? -1 : rovingIndex === categoryFocusIndex ? 0 : -1}
        aria-expanded={category.disabled ? undefined : isActive}
        aria-controls={isActive ? panelId : undefined}
        aria-label={label}
        title={label}
        className={[
          'vibe-toolbar-category',
          isActive && 'vibe-toolbar-category-active',
          category.disabled && 'vibe-toolbar-category-disabled',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={() => handleCategoryClick(category)}
        onFocus={() => {
          if (rovingIndex >= 0) setCategoryFocusIndex(rovingIndex)
        }}
        style={{ minWidth: TOUCH_TARGET_MIN_PX, minHeight: TOUCH_TARGET_MIN_PX }}
      >
        <span
          className="vibe-toolbar-icon"
          style={iconMaskStyle(category.icon)}
          aria-hidden="true"
        />
      </button>
    )
  }

  const flashShareFeedback = (message: string) => {
    setShareFeedback(message)
    if (shareFeedbackTimeoutRef.current !== null) {
      window.clearTimeout(shareFeedbackTimeoutRef.current)
    }
    shareFeedbackTimeoutRef.current = window.setTimeout(() => {
      setShareFeedback(null)
      shareFeedbackTimeoutRef.current = null
    }, 2500)
  }

  // Share the rendered field: native share sheet with a PNG first (ported
  // from the old dock), falling back to a PNG download. Creates no history.
  const handleShare = async () => {
    if (typeof window === 'undefined') return
    const canvas = canvasRef.current?.getCanvas()
    if (!canvas) {
      flashShareFeedback('Canvas is not ready')
      return
    }

    setShareFeedback('Preparing…')
    try {
      const blob = await new Promise<Blob | null>((resolve, reject) => {
        try {
          canvas.toBlob((b) => resolve(b), 'image/png')
        } catch (err) {
          reject(err)
        }
      })

      if (!blob) {
        throw new Error('Canvas export returned an empty image.')
      }

      const file = new File([blob], 'joel-hoke-vibe.png', { type: 'image/png' })
      const shareData = { files: [file] }

      if (navigator.canShare?.(shareData)) {
        await navigator.share(shareData)
        setShareFeedback(null)
      } else {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = 'joel-hoke-vibe.png'
        link.click()
        URL.revokeObjectURL(url)
        flashShareFeedback('Image downloaded')
      }
    } catch (err) {
      // Canceling the native share sheet throws an AbortError; keep it silent.
      if ((err as Error)?.name === 'AbortError') {
        setShareFeedback(null)
      } else {
        flashShareFeedback('Could not share')
      }
    }
  }

  const renderUtilityButton = (utility: UtilityConfig) => {
    let disabled = false
    let label = utility.label
    let onClick: (() => void) | undefined

    switch (utility.id) {
      case 'undo':
        disabled = !canUndo
        label = canUndo ? 'Undo' : 'Undo (nothing to undo)'
        onClick = onUndo
        break
      case 'redo':
        disabled = !canRedo
        label = canRedo ? 'Redo' : 'Redo (nothing to redo)'
        onClick = onRedo
        break
      case 'refresh':
        label = 'Reset to the default vibe'
        onClick = onReset
        break
      case 'share':
      default:
        label = shareFeedback ?? 'Share'
        onClick = handleShare
        break
    }

    const rovingIndex = utilityIds.indexOf(utility.id)
    return (
      <button
        key={utility.id}
        ref={(el) => {
          utilityButtonRefs.current[utility.id] = el
        }}
        type="button"
        disabled={disabled}
        tabIndex={disabled ? -1 : rovingIndex === utilityFocusIndex ? 0 : -1}
        aria-label={label}
        title={label}
        className="vibe-toolbar-utility"
        onClick={onClick}
        onFocus={() => {
          if (!disabled) setUtilityFocusIndex(rovingIndex)
        }}
        style={{ minWidth: TOUCH_TARGET_MIN_PX, minHeight: TOUCH_TARGET_MIN_PX }}
      >
        <span
          className="vibe-toolbar-utility-icon"
          style={iconMaskStyle(utility.icon)}
          aria-hidden="true"
        />
      </button>
    )
  }

  const renderPanel = () => {
    if (!selectedTool) return null
    return (
      <div
        ref={panelRef}
        id={panelId}
        className="vibe-toolbar-panel"
        role="region"
        aria-label={`${getPanelLabel(selectedTool)} panel`}
        style={
          pointerLeft !== null
            ? ({ '--vibe-panel-pointer-left': `${pointerLeft}px` } as React.CSSProperties)
            : undefined
        }
      >
        <div className="vibe-toolbar-panel-scroll">
          {selectedTool === 'upload' && (
            <UploadPanel
              presets={presets}
              onSelectPreset={onSelectPreset}
              privacyNote={privacyNote}
              uploadPending={uploadPending}
              uploadPendingLabel={uploadPendingLabel}
              uploadError={uploadError}
              uploadedFilename={uploadedFilename}
              onUpload={onUpload}
            />
          )}
          {selectedTool === 'text' && (
            <TextEffectsPanel
              config={config}
              onChange={onChange}
              onCommitText={onCommitGlyphText}
            />
          )}
          {selectedTool === 'colorStyles' && (
            <ColorStylesPanel config={config} onChange={onChange} />
          )}
          {selectedTool === 'paint' && (
            <PaintPanel
              config={paintTool}
              onChange={onPaintToolChange}
              onClearPaint={onClearPaint}
              clearDisabled={!paintStatus || paintStatus.strokeCount === 0}
            />
          )}
          {selectedTool === 'motion' && (
            <MotionEffectsPanel config={config} onChange={onChange} />
          )}
          {selectedTool === 'ambient' && (
            <AmbientPanel config={config.ambient} onChange={onChange} />
          )}
          {selectedTool === 'pond' && pond && onPondChange && (
            <PondPanel pond={pond} onPondChange={onPondChange} />
          )}
          {selectedTool === 'sound' && sound && onSoundConfigChange && (
            <SoundPanel
              config={sound.config}
              playback={sound.playback}
              error={sound.error}
              onPlay={onSoundPlay ?? (() => {})}
              onPause={onSoundPause ?? (() => {})}
              onConfigChange={onSoundConfigChange}
            />
          )}
        </div>
      </div>
    )
  }

  if (!open) return null

  const capsule = (
    <div
      ref={capsuleRef}
      className="vibe-toolbar-capsule"
      role="toolbar"
      aria-label="Vibe tools"
      onKeyDown={(event) =>
        handleRowKeyDown(
          event,
          enabledCategoryIds,
          categoryButtonRefs.current,
          categoryFocusIndex,
          setCategoryFocusIndex,
        )
      }
    >
      {visibleCategories.map(renderCategoryButton)}
    </div>
  )

  return (
    <div ref={toolbarRef} className="vibe-toolbar" id={`vibe-toolbar-${stableId}`}>
      {renderPanel()}
      <div className="vibe-toolbar-capsule-wrapper">
        {mounted ? (
          <BorderBeam
            size="md"
            colorVariant="colorful"
            staticColors
            hueRange={0}
            theme="auto"
            strength={0.45}
            className="vibe-toolbar-capsule-beam"
            id={`vibe-toolbar-beam-${stableId}`}
          >
            {capsule}
          </BorderBeam>
        ) : (
          capsule
        )}
      </div>
      <div
        className="vibe-toolbar-utility-tray"
        role="group"
        aria-label="Utility actions"
        onKeyDown={(event) =>
          handleRowKeyDown(
            event,
            utilityIds,
            utilityButtonRefs.current,
            utilityFocusIndex,
            setUtilityFocusIndex,
          )
        }
      >
        {VIBE_TOOLBAR_UTILITIES.map(renderUtilityButton)}
      </div>
    </div>
  )
}

function getPanelLabel(tool: NonNullable<VibeToolbarTool>): string {
  switch (tool) {
    case 'upload':
      return 'Upload'
    case 'text':
      return 'Text Effects'
    case 'colorStyles':
      return 'Color Styles'
    case 'paint':
      return 'Paint'
    case 'motion':
      return 'Motion Effects'
    case 'ambient':
      return 'Ambient'
    case 'pond':
      return 'Pond'
    case 'sound':
      return 'Sound'
    default:
      return tool
  }
}
