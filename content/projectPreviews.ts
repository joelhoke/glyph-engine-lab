/** Public promotional media only. Never resolve protected prototype bundles here. */
export type ProjectPreview = { poster: string; video?: string; darkPoster?: string; darkVideo?: string }
const clip = (name: string) => `/assets/gallery/previews/${name}.mp4?v=3`
const poster = (name: string) => `/assets/gallery/previews/${name}.webp?v=3`
const preview = (name: string): ProjectPreview => ({ poster: poster(name), video: clip(name) })

export const PROJECT_PREVIEWS: Record<string, ProjectPreview> = {
  '/gallery/cars': { ...preview('cars'), darkPoster: poster('cars-dark'), darkVideo: clip('cars-dark') },
  '/p/joelops/demo': {
    ...preview('global-operations-demo'),
    darkPoster: poster('global-operations-demo-dark'), darkVideo: clip('global-operations-demo-dark'),
  },
  '/gallery/three-gradient': preview('three-gradient'),
  '/gallery/droplet': preview('droplet'),
  '/p/type-lab/orbit-toy': preview('orbit-toy'),
  '/p/type-lab/glass-playground': preview('glass-playground'),
  '/p/type-lab/logo-studio': preview('logo-studio'),
  '/p/golden-age-collectables/mild': preview('golden-age-mild'),
  '/p/golden-age-collectables/medium': preview('golden-age-medium'),
}

/** Source aliases cover collection cards whose destination is the parent collection. */
export function getProjectPreview(href?: string, source?: string): ProjectPreview | undefined {
  const path = href?.split(/[?#]/)[0].replace(/\/$/, '')
  if (path && PROJECT_PREVIEWS[path]) return PROJECT_PREVIEWS[path]
  const asset = source?.split('?')[0]
  if (asset === '/assets/gallery/vehicle-playground.webp' || asset?.endsWith('/previews/cars.webp')) return PROJECT_PREVIEWS['/gallery/cars']
  if (asset === '/assets/work/global-operations-thumbnail.webp' || asset?.endsWith('/previews/global-operations-demo.webp')) return PROJECT_PREVIEWS['/p/joelops/demo']
  return undefined
}
