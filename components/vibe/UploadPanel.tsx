'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { VibePreset } from '../../content/vibe'

export type UploadPanelProps = {
  presets: VibePreset[]
  onSelectPreset: (id: string) => void
  privacyNote: string
  uploadPending: boolean
  uploadPendingLabel: string
  uploadError: string | null
  uploadedFilename: string
  onUpload: (file: File) => void
}

export default function UploadPanel({
  presets,
  onSelectPreset,
  privacyNote,
  uploadPending,
  uploadPendingLabel,
  uploadError,
  uploadedFilename,
  onUpload,
}: UploadPanelProps) {
  const stableId = useId().replace(/:/g, '-')
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const firstPresetRef = useRef<HTMLButtonElement>(null)
  const wellRef = useRef<HTMLDivElement>(null)
  const uploadDescriptionId = `upload-desc-${stableId}`
  const uploadErrorId = `upload-error-${stableId}`
  const [isDragOver, setIsDragOver] = useState(false)

  useEffect(() => {
    firstPresetRef.current?.focus()
  }, [])

  const processFile = (file: File) => {
    onUpload(file)
    if (uploadInputRef.current) {
      uploadInputRef.current.value = ''
    }
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    processFile(file)
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragOver(false)
    const file = event.dataTransfer.files?.[0]
    if (!file) return
    processFile(file)
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (!uploadPending) setIsDragOver(true)
  }

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (event.currentTarget.contains(event.relatedTarget as Node)) return
    setIsDragOver(false)
  }

  const handleChooseClick = () => {
    uploadInputRef.current?.click()
  }

  return (
    <div className="vibe-upload-panel">
      <div className="vibe-panel-section">
        <span className="vibe-panel-section-label">Presets</span>
        <div className="vibe-presets-row" role="group" aria-label="Presets">
          {presets.map((preset, index) => (
            <button
              key={preset.id}
              ref={index === 0 ? firstPresetRef : undefined}
              type="button"
              className="vibe-preset-button"
              onClick={() => onSelectPreset(preset.id)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
      <div
        ref={wellRef}
        className={['vibe-upload-well', isDragOver && 'vibe-upload-well-active']
          .filter(Boolean)
          .join(' ')}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        aria-label="Upload image. Drag and drop or choose file."
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            handleChooseClick()
          }
        }}
        onClick={handleChooseClick}
      >
        <input
          ref={uploadInputRef}
          id={`upload-${stableId}`}
          type="file"
          accept=".svg,image/svg+xml,image/png,image/webp,.png,.webp"
          onChange={handleFileChange}
          disabled={uploadPending}
          aria-describedby={uploadDescriptionId}
          aria-errormessage={uploadError ? uploadErrorId : undefined}
          aria-invalid={uploadError ? 'true' : undefined}
          className="vibe-file-input visually-hidden"
        />
        <span className="vibe-upload-label">Upload Image</span>
        <p className="vibe-upload-hint" id={uploadDescriptionId}>
          Drag and drop or choose file — {privacyNote.toLowerCase()}
        </p>
        <button
          type="button"
          className="vibe-upload-choose-button"
          onClick={(event) => {
            event.stopPropagation()
            handleChooseClick()
          }}
          disabled={uploadPending}
        >
          Choose file
        </button>
        <span className="vibe-upload-filename" aria-live="polite">
          {uploadedFilename}
        </span>
        {uploadPending && uploadPendingLabel && (
          <span role="status" aria-live="polite" className="vibe-upload-status">
            {uploadPendingLabel}
          </span>
        )}
        {uploadError && (
          <span id={uploadErrorId} role="alert" aria-live="polite" className="vibe-upload-error">
            {uploadError}
          </span>
        )}
      </div>
    </div>
  )
}
