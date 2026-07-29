import { ConversationStarter as ConversationStarterModel } from '../../content/collaborate'

type ConversationStarterProps = {
  starter: ConversationStarterModel
  selected: boolean
  onSelect: (id: string) => void
}

/**
 * One conversation starter: a toggle-style button (aria-pressed) that reports
 * its id upward. Selection state is controlled by CollaborateExperience /
 * PortfolioExperience so the same state can also drive the canvas descriptor.
 * Selecting a starter never moves focus — the reply is announced via the
 * parent's aria-live region instead.
 */
export default function ConversationStarter({
  starter,
  selected,
  onSelect,
}: ConversationStarterProps) {
  return (
    <button
      type="button"
      className="conversation-starter"
      aria-pressed={selected}
      onClick={() => onSelect(starter.id)}
    >
      {starter.label}
    </button>
  )
}
