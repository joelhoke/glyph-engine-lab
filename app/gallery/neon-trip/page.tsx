import type { Metadata } from 'next'
import Playground from '../../../components/gallery/neon/NeonPlayground'

export const metadata: Metadata = {
  title: 'Neon Trip — interactive playground',
  description: 'Shape luminous color and animated light.',
  alternates: { canonical: '/gallery/neon-trip' },
  openGraph: { url: '/gallery/neon-trip' },
}

export default function Page() { return <Playground /> }
