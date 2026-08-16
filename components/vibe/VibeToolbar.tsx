'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { BorderBeam } from 'border-beam'
import { PlaygroundConfig } from '../../engine/playgroundConfig'
import { PaintStatus, PaintToolConfig } from '../../engine/paint'
import { VibePreset } from '../../content/vibe'
import { SceneCanvasHandle } from '../SceneCanvas'
import {
  CategoryConfig,
  UtilityConfig,
  VIBE_TOOLBAR_CATEGORIES,
  VIBE_TOOLBAR_UTILITIES,
  VibeToolbarTool,
} from './toolbarConfig'
import { CLIP_DURATION_OPTIONS_SECONDS } from '../../engine/clipRecorder'
import UploadPanel from './UploadPanel'
import TextEffectsPanel from './TextEffectsPanel'
import ColorStylesPanel from './ColorStylesPanel'
import PaintPanel from './PaintPanel'
import type { ClipRecorderControls } from './useClipRecorder'

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
  /** Dev ?debug=true: exposes the clip diagnostics details in the preview. */
  debugMode?: boolean
  /** Clip recording state + actions (15-second canvas+soundtrack export).
   *  Session-only; the blob never leaves the browser without an explicit
   *  share/download. */
  clip?: ClipRecorderControls
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
  clip,
  id: externalId,
}: VibeToolbarProps) {
  const generatedId = useId().replace(/:/g, '-')
  const stableId = externalId ?? generatedId
  const panelId = `vibe-toolbar-panel-${stableId}`
  const shareChooserId = `vibe-share-chooser-${stableId}`
  const [mounted, setMounted] = useState(false)
  // No popout on activation: the toolbar opens with every category closed.
  const [selectedTool, setSelectedTool] = useState<VibeToolbarTool>(null)
  const [pointerLeft, setPointerLeft] = useState<number | null>(null)
  const [shareFeedback, setShareFeedback] = useState<string | null>(null)
  // Nonmodal share chooser (image vs 15-second clip).
  const [shareChooserOpen, setShareChooserOpen] = useState(false)
  // Roving tabindex: the button that owns Tab focus within each row.
  const [categoryFocusIndex, setCategoryFocusIndex] = useState(0)
  const [utilityFocusIndex, setUtilityFocusIndex] = useState(0)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const capsuleRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const shareChooserRef = useRef<HTMLDivElement>(null)
  const shareImageButtonRef = useRef<HTMLButtonElement>(null)
  const categoryButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const utilityButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const shareFeedbackTimeoutRef = useRef<number | null>(null)

  // The center toolbar is the simplified four-category set (Upload, Text,
  // Color, Paint); ambient, pond, and sound live in their own controls.
  const visibleCategories = VIBE_TOOLBAR_CATEGORIES

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

  // Recording (or finalizing) a clip locks the actions that would interrupt
  // it: Reset and a duplicate Share. (The Sound control's transport is locked
  // out by the parent on the same flag.)
  const clipRecordingActive = clip?.phase === 'recording' || clip?.phase === 'processing'

  const closeShareChooser = () => {
    setShareChooserOpen(false)
    utilityButtonRefs.current.share?.focus()
  }

  // Nonmodal share chooser: opening focuses "Share image"; Escape and
  // outside-click close and restore focus to the Share utility button.
  useEffect(() => {
    if (!shareChooserOpen) return
    shareImageButtonRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if ((event as unknown as { isComposing?: boolean }).isComposing) return
      event.preventDefault()
      event.stopPropagation()
      closeShareChooser()
    }
    const handlePointerDown = (event: MouseEvent | PointerEvent) => {
      const target = event.target as Node | null
      if (shareChooserRef.current?.contains(target as Node)) return
      if (utilityButtonRefs.current.share?.contains(target as Node)) return
      setShareChooserOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareChooserOpen])

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
  const handleShare = async () => {    if (typeof window === 'undefined') return
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

  // Share utility: with clip support the button opens the nonmodal chooser
  // (image vs 15-second clip); the PNG path itself is unchanged.
  const handleShareClick = () => {
    if (!clip) {
      handleShare()
      return
    }
    if (shareChooserOpen) {
      closeShareChooser()
    } else {
      setShareChooserOpen(true)
    }
  }

  // Clip export from the preview: native share ONLY from this button's fresh
  // transient activation; otherwise download. The preview is retained after
  // a canceled/failed share and released after a successful one.
  const downloadClip = () => {
    if (!clip?.preview) return
    const url = URL.createObjectURL(clip.preview.blob)
    const link = document.createElement('a')
    link.href = url
    link.download = clip.preview.filename
    link.click()
    URL.revokeObjectURL(url)
    flashShareFeedback('Clip downloaded')
  }

  const handleShareClip = async () => {
    if (!clip?.preview) return
    const file = new File([clip.preview.blob], clip.preview.filename, {
      type: clip.preview.mimeType,
    })
    const shareData = { files: [file] }
    if (navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData)
        clip.releasePreview()
      } catch (err) {
        // AbortError = visitor canceled: keep the preview, stay silent.
        if ((err as Error)?.name !== 'AbortError') {
          downloadClip()
        }
      }
    } else {
      downloadClip()
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
        disabled = clipRecordingActive
        label = 'Reset to the default vibe'
        onClick = onReset
        break
      case 'share':
      default:
        disabled = clipRecordingActive
        label = shareFeedback ?? 'Share'
        onClick = handleShareClick
        break
    }

    const rovingIndex = utilityIds.indexOf(utility.id)
    const isShare = utility.id === 'share' && clip
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
        aria-expanded={isShare ? shareChooserOpen : undefined}
        aria-controls={isShare && shareChooserOpen ? shareChooserId : undefined}
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
      {/* Restrained live status: recording started/paused/resumed/ready/
          canceled/failed — never countdown ticks. */}
      {clip && (
        <div className="visually-hidden" role="status">
          {clip.announcement ?? ''}
        </div>
      )}
      {renderPanel()}
      {clip && shareChooserOpen && (
        <div
          ref={shareChooserRef}
          id={shareChooserId}
          className="vibe-share-chooser"
          role="group"
          aria-label="Share options"
        >
          <button
            ref={shareImageButtonRef}
            type="button"
            className="vibe-share-choice"
            onClick={() => {
              closeShareChooser()
              handleShare()
            }}
          >
            Share image
          </button>
          {CLIP_DURATION_OPTIONS_SECONDS.map((seconds) => (
            <button
              key={seconds}
              type="button"
              className="vibe-share-choice"
              disabled={!clip.supported}
              onClick={() => {
                setShareChooserOpen(false)
                clip.start(seconds)
              }}
            >
              Share {seconds}s clip
            </button>
          ))}
          {!clip.supported && clip.unsupportedReason && (
            <p className="vibe-share-chooser-note">{clip.unsupportedReason}</p>
          )}
        </div>
      )}
      {clip && clipRecordingActive && (
        <div className="vibe-clip-status" role="group" aria-label="Clip recording">
          <span className="vibe-clip-countdown" aria-hidden="true">
            {formatClipCountdown(clip.remainingMs)}
          </span>
          <button
            type="button"
            className="vibe-clip-cancel"
            disabled={clip.phase === 'processing'}
            onClick={clip.cancel}
          >
            Cancel
          </button>
        </div>
      )}
      {clip && clip.phase === 'error' && clip.error && (
        <div className="vibe-clip-error" role="alert">
          <p className="vibe-clip-error-text">{clip.error}</p>
          <div className="vibe-clip-error-actions">
            <button type="button" className="vibe-clip-action" onClick={clip.retake}>
              Retake
            </button>
            <button type="button" className="vibe-clip-action" onClick={clip.closePreview}>
              Close
            </button>
          </div>
          {/* Always visible in the failure state: Safari users can copy this. */}
          {clip.diagnostics && (
            <details className="vibe-clip-diagnostics" open>
              <summary>Clip diagnostics</summary>
              <pre>{clip.diagnostics}</pre>
            </details>
          )}
        </div>
      )}
      {clip && clip.phase === 'ready' && clip.preview && (
        <div className="vibe-clip-preview" role="group" aria-label="Clip preview">
          {/* Non-autoplaying preview: the default post-record state. Decode
              failures surface into the visible error state (Safari). */}
          <video
            className="vibe-clip-preview-video"
            src={clip.preview.url}
            controls
            playsInline
            preload="metadata"
            onLoadedMetadata={(event) =>
              clip.reportPreviewInfo({
                videoWidth: event.currentTarget.videoWidth,
                videoHeight: event.currentTarget.videoHeight,
              })
            }
            onError={(event) =>
              clip.reportPreviewError(event.currentTarget.error?.code ?? -1)
            }
          />
          <div className="vibe-clip-preview-actions">
            <button type="button" className="vibe-clip-action" onClick={handleShareClip}>
              Share clip
            </button>
            <button type="button" className="vibe-clip-action" onClick={downloadClip}>
              Download
            </button>
            <button type="button" className="vibe-clip-action" onClick={clip.retake}>
              Retake
            </button>
            <button type="button" className="vibe-clip-action" onClick={clip.closePreview}>
              Close
            </button>
          </div>
          {debugMode && clip.diagnostics && (
            <details className="vibe-clip-diagnostics">
              <summary>Clip diagnostics</summary>
              <pre>{clip.diagnostics}</pre>
            </details>
          )}
        </div>
      )}
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

/** Active-time countdown chip text, mm:ss (aria-hidden — the live region
 *  carries the restrained announcements instead of every tick). */
function formatClipCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function getPanelLabel(tool: NonNullable<VibeToolbarTool>): string {  switch (tool) {
    case 'upload':
      return 'Upload'
    case 'text':
      return 'Text Effects'
    case 'colorStyles':
      return 'Color Styles'
    case 'paint':
      return 'Paint'
    default:
      return tool
  }
}
