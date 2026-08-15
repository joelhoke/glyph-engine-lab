'use client'

/**
 * Condense icon (full-chat pop-out control): two arrows collapsing inward
 * along the diagonal — the conversation condenses into the docked pane.
 * Matches the components/icons stroke style.
 */
export default function CondenseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M4 14H10V20M20 10H14V4M14 10L21 3M3 21L10 14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
