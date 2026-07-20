'use client'

import { BorderBeam } from 'border-beam'

type PrimaryActionProps = {
  label: string
  selected: boolean
  onClick: () => void
  actionIndex: number
  hue?: string
  style?: React.CSSProperties
}

export default function PrimaryAction({ label, selected, onClick, actionIndex, hue, style }: PrimaryActionProps) {
  const beamStyle: React.CSSProperties = { ...style }
  if (hue) (beamStyle as any)['--beam-hue-base'] = hue

  return (
    <BorderBeam
      size="sm"
      colorVariant="colorful"
      staticColors
      hueRange={0}
      theme="auto"
      strength={selected ? 0.7 : 0.45}
      className="primary-action-beam"
      data-action-index={actionIndex}
      style={beamStyle}
    >
      <button
        type="button"
        className={`primary-action-button ${selected ? 'selected' : ''}`}
        onClick={onClick}
      >
        {label}
      </button>
    </BorderBeam>
  )
}
