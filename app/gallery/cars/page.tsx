import type { Metadata } from 'next'
import CarGallery from '../../../components/gallery/CarGallery'

export const metadata: Metadata = {
  title: 'Vehicle playground',
  description: 'Explore the Toyota 4Runner and McLaren MP4/5 in an interactive vehicle playground.',
  alternates: { canonical: '/gallery/cars' },
  openGraph: { url: '/gallery/cars', images: ['/assets/gallery/vehicle-playground.webp'] },
}
export default function CarGalleryPage() { return <CarGallery /> }
