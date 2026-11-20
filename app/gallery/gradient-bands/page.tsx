import type { Metadata } from 'next'
import Playground from '../../../components/gallery/gradient-bands/BandsPlayground'

export const metadata: Metadata = {
  title: 'Gradient Bands — interactive playground',
  description: 'Draw luminous ribbons and animate their colors.',
  alternates: { canonical: '/gallery/gradient-bands' },
  openGraph: { url: '/gallery/gradient-bands' },
}

export default function Page() { return <Playground /> }
