'use client'

import type { SVGProps } from 'react'

/**
 * The JH monogram (the mark half of public/assets/JH-Logotype.svg) inlined
 * with currentColor so the theme sets it (near-white on dark, near-black on
 * light). Used as the site header's home lockup — the full logotype proved
 * illegible at header height.
 */
export default function JHMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="357 0 154 182"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="JH logo"
      {...props}
    >
      <path d="M381.685 42.9401H410.615L393.305 139.47C392.435 144.23 390.955 148.53 388.895 152.24C386.845 155.94 384.315 159.14 381.385 161.74C378.455 164.33 375.095 166.38 371.395 167.83C367.685 169.27 363.735 170.13 359.665 170.36L359.025 170.4L357.155 182.47L358.075 182.45C363.735 182.33 369.235 181.29 374.425 179.37C379.615 177.44 384.415 174.69 388.695 171.2C392.985 167.7 396.655 163.3 399.615 158.12C402.565 152.95 404.675 146.92 405.885 140.18L425.215 31.2101L425.375 30.3101H383.775L381.685 42.9401Z" fill="currentColor"/>
      <path d="M496.305 99.59C497.605 91.55 498.985 83.16 500.435 74.4C501.885 65.65 503.265 57.25 504.565 49.21C505.865 41.17 507.065 33.79 508.135 27.06C509.215 20.33 510.065 14.89 510.695 10.72H498.195L488.955 68.24H429.075L427.105 79.85H487.105L477.835 138.26H505.015L506.485 126.68H491.835C492.085 125.14 492.355 123.52 492.645 121.82C493.785 115.03 495.005 107.62 496.315 99.58L496.305 99.59Z" fill="currentColor"/>
    </svg>
  )
}
