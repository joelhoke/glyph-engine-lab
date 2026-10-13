import type { Metadata } from 'next'
import CarGallery from '../../../components/gallery/CarGallery'
export const metadata: Metadata = {
  title: 'Car gallery', description: 'A rolling collection of cars: 4Runner, Formula 1, and Lancia Stratos.',
  alternates: { canonical: '/gallery/cars' }, openGraph: { url: '/gallery/cars' },
}
export default function CarGalleryPage() { return <CarGallery /> }
