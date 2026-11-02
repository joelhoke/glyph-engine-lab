import type { Metadata } from 'next'
import GradientPlayground from '../../../components/gallery/three-gradient/GradientPlayground'

export const metadata: Metadata = {
  title: 'Three.Gradient — flower playground',
  description: 'Create a living gradient. Change colors, explore gradient types, and morph a flower with time or your scroll.',
  alternates: { canonical: '/gallery/three-gradient' },
  openGraph: { url: '/gallery/three-gradient' },
}

export default function GradientPlaygroundPage() {
  return <GradientPlayground />
}
