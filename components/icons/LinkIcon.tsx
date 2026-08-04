'use client'

/**
 * Link icon (guide source chips).
 * Source: hand-drawn inline SVG, matching the components/icons stroke style.
 */
export default function LinkIcon({ className }: { className?: string }) {
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
        d="M10 13C10.4295 13.5741 10.9774 14.0491 11.6066 14.3929C12.2357 14.7367 12.9315 14.9411 13.6467 14.9923C14.3618 15.0435 15.0796 14.9403 15.7513 14.6897C16.4231 14.4392 17.0331 14.047 17.54 13.54L20.54 10.54C21.4508 9.59695 21.9548 8.33394 21.9434 7.02296C21.932 5.71198 21.4061 4.45791 20.4791 3.53087C19.5521 2.60383 18.298 2.07799 16.987 2.0666C15.676 2.0552 14.413 2.55918 13.47 3.46997L11.75 5.17997M14 11C13.5705 10.4259 13.0226 9.95083 12.3934 9.60706C11.7643 9.2633 11.0685 9.05889 10.3534 9.00768C9.63821 8.95646 8.92041 9.05964 8.24867 9.31018C7.57694 9.56073 6.96689 9.95294 6.46 10.46L3.46 13.46C2.54921 14.403 2.04524 15.666 2.05663 16.977C2.06802 18.288 2.59387 19.542 3.52091 20.4691C4.44795 21.3961 5.70201 21.9219 7.01299 21.9333C8.32397 21.9447 9.58699 21.4408 10.53 20.53L12.24 18.82"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
