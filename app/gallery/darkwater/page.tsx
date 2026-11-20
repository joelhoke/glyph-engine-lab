import type { Metadata } from 'next'
import Playground from '../../../components/gallery/darkwater/DarkWaterPlayground'

export const metadata: Metadata = {
  title: 'DarkWater — interactive playground',
  description: 'Explore water, ripples, and colored light.',
  alternates: { canonical: '/gallery/darkwater' },
  openGraph: { url: '/gallery/darkwater' },
}

export default function Page() { return <Playground /> }
