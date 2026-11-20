import type { ReactNode, RefObject } from 'react'
import styles from './playground.module.css'

export function Preview({ canvas, viewport, ready, error, label, hint, children }: { canvas: RefObject<HTMLCanvasElement | null>; viewport: RefObject<HTMLDivElement | null>; ready: boolean; error: string; label: string; hint: string; children?: ReactNode }) {
  return <>
    <div ref={viewport} className={styles.viewport} data-render-state={error ? 'unavailable' : ready ? 'ready' : 'loading'}>
      <canvas ref={canvas} className={styles.interactiveCanvas} aria-label={label} />
      {children}
    </div>
    <div className={styles.timeline}><p className={styles.hint}>{hint}</p></div>
    {(!ready || error) && <p className={styles.status} role="status">{error || 'Preparing your playground…'}</p>}
  </>
}
