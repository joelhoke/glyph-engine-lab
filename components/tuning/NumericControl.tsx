'use client'

import { useEffect, useId, useState } from 'react'
import {
  commitNumericInput,
  formatNumericValue,
  isPotentiallyValidDraft,
  NumericControlDefinition,
  stepNumericValue,
} from './tuningConfig'

type NumericControlProps = {
  id?: string
  label: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  showSlider?: boolean
  disabled?: boolean
  onChange: (value: number) => void
}

export default function NumericControl({
  id: externalId,
  label,
  value,
  min,
  max,
  step,
  unit,
  showSlider = false,
  disabled = false,
  onChange,
}: NumericControlProps) {
  const generatedId = useId()
  const id = externalId ?? generatedId
  const [draft, setDraft] = useState(() => formatNumericValue(value, step))
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    if (!isEditing) {
      setDraft(formatNumericValue(value, step))
    }
  }, [value, step, isEditing])

  const commit = () => {
    const committed = commitNumericInput(draft, value, min, max, step)
    if (committed === null) {
      setDraft(formatNumericValue(value, step))
    } else {
      setDraft(formatNumericValue(committed, step))
      if (committed !== value) {
        onChange(committed)
      }
    }
  }

  const handleNumberChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setDraft(event.target.value)
  }

  const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const committed = commitNumericInput(event.target.value, value, min, max, step)
    if (committed !== null) {
      setDraft(formatNumericValue(committed, step))
      setIsEditing(false)
      onChange(committed)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      setIsEditing(false)
      commit()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setIsEditing(false)
      setDraft(formatNumericValue(value, step))
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      // ±1 step interval, ±10 with Shift — committed immediately.
      event.preventDefault()
      const direction = event.key === 'ArrowUp' ? 1 : -1
      const next = stepNumericValue(value, direction, min, max, step, event.shiftKey ? 10 : 1)
      setDraft(formatNumericValue(next, step))
      setIsEditing(false)
      if (next !== value) {
        onChange(next)
      }
    }
  }

  const displayUnit = unit ? ` ${unit}` : ''
  const draftInvalid = !isPotentiallyValidDraft(draft)

  return (
    <div className={`numeric-control ${draftInvalid ? 'numeric-control-invalid' : ''}`}>
      <label htmlFor={id} className="numeric-control-label">
        {label}
      </label>
      <div className="numeric-control-row">
        {showSlider && (
          <input
            id={`${id}-slider`}
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            disabled={disabled}
            aria-label={`${label} slider`}
            onChange={handleSliderChange}
            onKeyDown={handleKeyDown}
            className="numeric-control-slider"
          />
        )}
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={draft}
          disabled={disabled}
          aria-invalid={draftInvalid}
          aria-describedby={unit ? `${id}-unit` : undefined}
          onChange={handleNumberChange}
          onFocus={() => setIsEditing(true)}
          onBlur={() => {
            setIsEditing(false)
            commit()
          }}
          onKeyDown={handleKeyDown}
          className="numeric-control-input"
        />
        {unit && (
          <span id={`${id}-unit`} className="numeric-control-unit" aria-hidden="true">
            {unit}
          </span>
        )}
      </div>
    </div>
  )
}
