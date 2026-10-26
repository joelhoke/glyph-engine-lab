import type { HomeGalleryProject } from '../components/home/galleryProjects'

/** Shared by the Gallery index and the homepage carousel. */
export const GALLERY_HIGHLIGHTS: (HomeGalleryProject & { action: string })[] = [
  {
    id: 'droplet', title: 'Droplet', collection: 'Games',
    summary: 'A little water, a whole world to explore. Guide your droplet through water worlds in Campaign or Endurance.',
    href: '/gallery/droplet', thumbnail: '/assets/gallery/droplet-home.webp',
    requiresPassword: false, action: 'Explore the preview →',
  },
  {
    id: 'cars', title: 'Vehicle playground', collection: 'Interactive 3D',
    summary: 'Take a closer look at the 4Runner and McLaren MP4/5. Turn them around, change the light, and explore the details.',
    href: '/gallery/cars', thumbnail: '/assets/gallery/vehicle-playground.webp',
    requiresPassword: false, action: 'Explore the playground →',
  },
]
