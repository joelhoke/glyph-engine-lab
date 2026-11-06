import type { Metadata } from 'next'
import GalleryHeader from '../../components/gallery/GalleryHeader'
import SphericalGallery from '../../components/gallery/SphericalGallery'
import { buildGalleryCatalog } from '../../components/gallery/galleryCatalog'

export const metadata: Metadata = {
  title: 'Gallery',
  description: 'An open collection of design, interactive experiments, and generative studies by Joel Hoke. Explore in every direction.',
  alternates: { canonical: '/gallery' },
  openGraph: { url: '/gallery' },
}

export default function GalleryPage() {
  return <><GalleryHeader /><SphericalGallery items={buildGalleryCatalog()} /></>
}
