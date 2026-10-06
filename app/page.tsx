import PortfolioExperience from '../components/PortfolioExperience'
import { listedStacks } from '../functions/lib/prototypesManifest'
import type { HomeGalleryProject } from '../components/home/galleryProjects'

export default function Home() {
  // Explicit projection: never serialize access hashes or unlisted stacks
  // across the client boundary. Project access still runs through /p/.
  const galleryProjects: HomeGalleryProject[] = listedStacks().flatMap((stack) =>
    stack.prototypes.map((project) => ({
      id: `${stack.slug}/${project.slug}`,
      title: project.title,
      collection: stack.title,
      summary: project.summary,
      href: `/p/${stack.slug}/${project.slug}`,
      thumbnail: project.publicThumbnail ?? `/p/${stack.slug}/${project.slug}/${project.thumb}`,
      requiresPassword: stack.access.mode !== 'public',
    })),
  )
  return <PortfolioExperience galleryProjects={galleryProjects} />
}
