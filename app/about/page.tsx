import type { Metadata } from 'next'
import AboutDesktop from '../../components/about/AboutDesktop'

const description = 'The other side of Joel Hoke: family, creative media, smart homes, personal finance, and cars.'
export const metadata: Metadata = {
  title: 'About me', description,
  alternates: { canonical: '/about' },
  openGraph: { title: 'The other side of Joel', description, url: '/about' },
  twitter: { title: 'The other side of Joel', description },
}

export default function AboutPage() {
  return <AboutDesktop />
}
