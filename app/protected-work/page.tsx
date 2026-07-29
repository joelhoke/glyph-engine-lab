import type { Metadata } from 'next'
import { Suspense } from 'react'
import ProtectedWorkViewer from './ProtectedWorkViewer'

export const metadata: Metadata = {
  title: 'Confidential work',
  robots: { index: false, follow: false },
}

/**
 * Confidential case-study viewer (Stage 4b). A branded static shell: the page
 * itself ships in the public export, but it carries no content — everything
 * renders from /api/protected/* behind Cloudflare Access. No analytics, no
 * third-party embeds, no trackers of any kind load on this route.
 */
export default function ProtectedWorkPage() {
  return (
    <Suspense fallback={null}>
      <ProtectedWorkViewer />
    </Suspense>
  )
}
