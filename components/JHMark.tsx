'use client'

import type { SVGProps } from 'react'
import { JH_MARK_PATHS, JH_MARK_VIEWBOX } from './JHMarkPaths'

/**
 * The JH monogram (the mark half of public/assets/JH-Logotype.svg) inlined
 * with currentColor so the theme sets it (near-white on dark, near-black on
 * light). Used as the site header's home lockup — the full logotype proved
 * illegible at header height. The path data lives in components/JHMarkPaths
 * (shared with the three.js hero extrusion).
 */
export default function JHMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox={JH_MARK_VIEWBOX}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="JH logo"
      {...props}
    >
      {JH_MARK_PATHS.map((d) => (
        <path key={d.slice(0, 16)} d={d} fill="currentColor" />
      ))}
    </svg>
  )
}
