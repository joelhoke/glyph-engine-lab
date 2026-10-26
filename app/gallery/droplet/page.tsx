import type { Metadata } from 'next'
import HostedPrototypeViewer from '../../../components/gallery/HostedPrototypeViewer'

export const metadata: Metadata = {
  title: 'Droplet',
  description: 'Explore Droplet’s live home screen, then choose a mode to play on droplet.digital.',
  alternates: { canonical: '/gallery/droplet' },
  openGraph: { url: '/gallery/droplet', images: ['/assets/gallery/droplet-home.webp'] },
}

export default function DropletPage() {
  // Local release review runs both sites; deployed builds use Droplet's origin.
  const origin = process.env.DROPLET_PREVIEW_ORIGIN || 'https://droplet.digital'
  return <HostedPrototypeViewer
    title="Droplet — interactive preview"
    src={`${origin}/preview`}
    backHref="/gallery"
    backLabel="Back to gallery"
    backViaHistory
    allowExternalNavigation
    caption={<>Choose a mode or menu option to continue on droplet.digital. <a href="https://droplet.digital/">Open the full game ↗</a></>}
  />
}
