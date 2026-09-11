import type { Metadata } from 'next'
import HostedPrototypeViewer from '../../../components/gallery/HostedPrototypeViewer'

export const metadata: Metadata = {
  title: '2026 Digie Award — interactive 3D model',
  robots: { index: false, follow: false },
}

export default function DigieAwardViewerPage() {
  return (
    <HostedPrototypeViewer
      title="2026 Digie Award — interactive 3D model"
      src="/assets/work/digie-award/embed.html"
      backHref="/#work/microsoft-global-operations"
      backLabel="Back to case study"
      backViaHistory
      hideMobileFooter
      caption={
        <>
          The 2026 Digie Award, modeled in three.js —{' '}
          <a
            href="https://www.realcomm.com/realcomm-2026/digies/winners/"
            target="_blank"
            rel="noopener noreferrer"
          >
            RealComm Digie Awards 2026 winners
            <span aria-hidden="true"> ↗</span>
          </a>
        </>
      }
    />
  )
}
