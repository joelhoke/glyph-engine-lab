import type { Metadata } from 'next'
import Playground from '../../../components/gallery/loonz/LoonzPlayground'

export const metadata: Metadata = {
  title: 'Loonz — interactive playground',
  description: 'Create, color, and float foil balloons.',
  alternates: { canonical: '/gallery/loonz' },
  openGraph: { url: '/gallery/loonz' },
}

export default function Page() { return <Playground /> }
