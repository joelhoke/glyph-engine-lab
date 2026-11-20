'use client'

import { Children, isValidElement, type ReactNode } from 'react'
import styles from './playground.module.css'

export function PaletteControl({ colors, onChange, disabled = false, label = 'Color palette' }: { colors: readonly string[]; onChange(colors: string[]): void; disabled?: boolean; label?: string }) {
  return <fieldset disabled={disabled} className={styles.palette}>
    <legend>{label}</legend>
    <div className={styles.swatches} style={{ gridTemplateColumns: `repeat(${colors.length}, minmax(0, 1fr))` }}>
      {colors.map((color, index) => <label key={index} className={styles.swatch}>
        <span className={styles.srOnly}>{label} color {index + 1}</span>
        <input type="color" value={color} onChange={event => onChange(colors.map((value, i) => i === index ? event.target.value : value))} />
        <span>{color.toUpperCase()}</span>
      </label>)}
    </div>
  </fieldset>
}

export function RangeControl({ label, value, onChange, min = 0, max = 1, step = 0.01, display }: { label: string; value: number; onChange(value: number): void; min?: number; max?: number; step?: number; display?: string }) {
  return <label>{label}<span>{display ?? Number(value.toFixed(2))}</span>
    <input type="range" aria-label={label} min={min} max={max} step={step} value={value} aria-valuetext={display} onChange={event => onChange(Number(event.target.value))} />
  </label>
}

type OptionProps = { value?: string | number; disabled?: boolean; children: ReactNode }

export function SelectControl({ label, value, onChange, children, buttons, icon }: {
  label: string
  value: string | number
  onChange(value: string): void
  children: ReactNode
  buttons?: boolean
  icon?(value: string): ReactNode
}) {
  const options = Children.toArray(children).flatMap(option => {
    if (!isValidElement<OptionProps>(option) || option.type !== 'option') return []
    const { value, children: name, disabled } = option.props
    return value === '' ? [] : [{ id: String(value ?? name), name, disabled }]
  })
  if (options.length && (buttons || options.length <= 4)) {
    return <div className={styles.choiceGroup} role="group" aria-label={label}>
      <span>{label}</span>
      <div className={styles.choiceButtons} data-columns={options.length === 4 ? 2 : Math.min(options.length, 3)}>
        {options.map(option => <button key={option.id} type="button" disabled={option.disabled}
          aria-pressed={String(value) === option.id} onClick={() => onChange(option.id)}>
          {icon?.(option.id)}{option.name}
        </button>)}
      </div>
    </div>
  }
  return <label>{label}<select aria-label={label} value={value} onChange={event => onChange(event.target.value)}>{children}</select></label>
}

export function PlaybackControls({ running, onToggle, onReset, disabled = false }: { running: boolean; onToggle(): void; onReset(): void; disabled?: boolean }) {
  return <div className={styles.actions}>
    <button type="button" disabled={disabled} onClick={onToggle}>{running ? 'Pause animation' : 'Play animation'}</button>
    <button type="button" onClick={onReset}>Reset</button>
  </div>
}

export function UndoButton({ canUndo, onUndo }: { canUndo: boolean; onUndo(): void }) {
  return <button type="button" disabled={!canUndo} onClick={onUndo} aria-keyshortcuts="Control+Z Meta+Z" title="Undo the last edit (⌘Z or Ctrl+Z)">Undo</button>
}
