'use client'

type ConversationSurfaceProps = {
  selected: string | null
  message: string
  onReset: () => void
}

export default function ConversationSurface({ selected, message, onReset }: ConversationSurfaceProps) {
  return (
    <section className="conversation-surface">
      <div className="surface-copy">
        <p className="surface-label">{selected ? selected === 'make' ? 'Make Something' : selected.charAt(0).toUpperCase() + selected.slice(1) : 'Explore'}</p>
        <p>{message}</p>
      </div>
      {(selected || message !== "This isn't a portfolio. It's a place to explore my work, thinking and what we might create together.") && (
        <button type="button" className="reset-button" onClick={onReset}>
          Reset
        </button>
      )}
    </section>
  )
}
