'use client'

import { useEffect, useId, useState } from 'react'
import { BorderBeam } from 'border-beam'

type PrimaryActionProps = {
  label: string
  selected: boolean
  onClick: () => void
  hue?: string
  style?: React.CSSProperties
}

export default function PrimaryAction({ label, selected, onClick, hue, style }: PrimaryActionProps) {
  const stableId = useId().replace(/:/g, '-')
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const beamStyle: React.CSSProperties = { ...style }
  if (hue) (beamStyle as any)['--beam-hue-base'] = hue

  const button = (
    <button
      type="button"
      className={`primary-action-button ${selected ? 'selected' : ''}`}
      onClick={onClick}
    >
      {label}
    </button>
  )

  if (!mounted) {
    return button
  }

  return (
    <BorderBeam
      size="sm"
      colorVariant="colorful"
      staticColors
      hueRange={0}
      theme="auto"
      strength={selected ? 0.7 : 0.45}
      className="primary-action-beam"
      style={beamStyle}
      id={stableId}
    >
      {button}
    </BorderBeam>
  )
}
