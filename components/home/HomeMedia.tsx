import type { HomeImage } from '../../content/home'
import JHMark from '../JHMark'

type HomeMediaProps = {
  /** The real asset. When absent (or missing `src`), an intentional branded
   *  placeholder renders in the same reserved box — swapping in the image
   *  later needs no layout changes. */
  image?: HomeImage
  /** Reserved box ratio when there is no image (600×400 ≈ the doorway
   *  stills). Ignored once an image with dimensions exists. */
  width?: number
  height?: number
  /** Placeholder caption (and monogram companion). Decorative when the media
   *  sits inside a labeled link; pass the visible label. */
  label: string
  /** Above-the-fold media (the hero, the portrait) skips lazy loading. */
  priority?: boolean
  className?: string
}

/**
 * Reusable media wrapper with a stable aspect ratio from explicit
 * width/height. Below-fold media lazy-loads; missing images render a
 * correctly sized branded placeholder (theme-token surface + label/monogram
 * motif), never a broken <img>.
 */
export default function HomeMedia({
  image,
  width = 600,
  height = 400,
  label,
  priority = false,
  className,
}: HomeMediaProps) {
  const w = image?.width ?? width
  const h = image?.height ?? height
  return (
    <div
      className={`home-media${className ? ` ${className}` : ''}`}
      style={{ aspectRatio: `${w} / ${h}` }}
    >
      {image?.src ? (
        <img
          src={image.src}
          alt={image.alt}
          width={w}
          height={h}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          style={image.objectPosition ? { objectPosition: image.objectPosition } : undefined}
        />
      ) : (
        <div className="home-media-placeholder" aria-hidden="true">
          <JHMark className="home-media-monogram" />
          <span className="home-media-label">{label}</span>
        </div>
      )}
    </div>
  )
}
