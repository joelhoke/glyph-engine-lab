'use client'

/**
 * Expand icon (companion control: open the full conversation page): two
 * arrows pushing the corners outward, matching the components/icons style.
 */
export default function ExpandIcon({ className }: { className?: string }) {
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
        d="M9 4H4V9M15 4H20V9M9 20H4V15M15 20H20V15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
