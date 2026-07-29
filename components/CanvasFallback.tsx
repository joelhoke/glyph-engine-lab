/**
 * Static branded fallback rendered behind the canvas layer. It is visible
 * whenever the canvas never paints — JavaScript disabled/failed, or no 2D
 * context — because an unpainted canvas is transparent. When the engine runs,
 * its first opaque frame covers this layer completely.
 *
 * aria-hidden: the semantic, crawlable copy already lives in the visually
 * hidden per-mode digests rendered by PortfolioExperience; this layer is the
 * visual-only counterpart and must not duplicate that content for assistive
 * tech.
 */
export default function CanvasFallback() {
  return (
    <div className="canvas-fallback" aria-hidden="true">
      <img
        className="canvas-fallback-logo"
        src="/JHLogo-180.png"
        alt=""
        width={90}
        height={90}
      />
      <p className="canvas-fallback-title">joel hoke design</p>
      <p className="canvas-fallback-copy">
        Work · Vibe · Collaborate — enable JavaScript to explore the full experience.
      </p>
    </div>
  )
}
