/** Public, listed project metadata only. The manifest stays on the server. */
export type HomeGalleryProject = {
  id: string
  title: string
  collection: string
  summary: string
  href: string
  thumbnail: string
  requiresPassword: boolean
}
