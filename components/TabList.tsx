'use client'

import type { KeyboardEvent } from 'react'

/** Shared roving-focus tabs. Panels use `${baseId}-panel-${id}`. */
export default function TabList<T extends string>({ items, selected, onSelect, baseId, label, className, tabClassName }: {
  items: readonly { id: T; label: string }[]
  selected: T
  onSelect: (id: T) => void
  baseId: string
  label: string
  className?: string
  tabClassName?: string
}) {
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number
    if (event.key === 'ArrowRight') next = (index + 1) % items.length
    else if (event.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = items.length - 1
    else return
    event.preventDefault()
    onSelect(items[next].id)
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
  }
  return <div role="tablist" aria-label={label} className={className}>
    {items.map((item, index) => <button key={item.id} type="button" role="tab"
      id={`${baseId}-tab-${item.id}`} aria-controls={`${baseId}-panel-${item.id}`}
      aria-selected={selected === item.id} tabIndex={selected === item.id ? 0 : -1}
      className={tabClassName} onClick={() => onSelect(item.id)} onKeyDown={event => onKeyDown(event, index)}>
      {item.label}
    </button>)}
  </div>
}
