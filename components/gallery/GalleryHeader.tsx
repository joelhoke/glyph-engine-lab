import SiteHeader from '../SiteHeader'

/**
 * Thin adapter rendering the shared header/menu (components/SiteHeader.tsx,
 * phase 5) on the gallery routes (/gallery, /p/*, viewer pages) with
 * active="gallery". No navigation coordinator off the homepage experience —
 * every link is a plain anchor; the homepage experience settles into each
 * scene from the URL hash (engine/experienceHash.ts). SiteHeader is a client
 * component; this adapter stays a server component.
 */
export default function GalleryHeader() {
  return <SiteHeader active="gallery" />
}
