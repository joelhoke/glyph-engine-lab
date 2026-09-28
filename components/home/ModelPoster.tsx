import { HOME_HERO_POSTERS } from '../../content/home'

/** Decorative: the surrounding slot owns the accessible name and navigation. */
export default function ModelPoster({ variant }: { variant: string }) {
  const poster = HOME_HERO_POSTERS[variant]
  if (!poster) return null
  return <picture className="home-model-poster" aria-hidden="true">
    <source media="(prefers-color-scheme: light)" srcSet={poster.light} />
    <img src={poster.dark} width={poster.width} height={poster.height}
      alt="" draggable={false} decoding="async" loading={variant.endsWith('-section') ? 'lazy' : 'eager'} />
  </picture>
}
