'use client'

import type { HomePortrait } from '../../content/home'

/** Adapted from Joel's SpriteSamples PortraitTone display filter.
 *  Monotone maps black → selected ink → white; duotone maps between two inks.
 *  Both preserve the original cutout alpha. */
export default function HomeSpriteTone({ id, tone }: {
  id: string
  tone: NonNullable<HomePortrait['tone']>
}) {
  const channel = (hex: string, offset: number) => parseInt(hex.slice(offset, offset + 2), 16) / 255
  const tables = [1, 3, 5].map(offset => tone.mode === 'monotone'
    ? `0 ${channel(tone.color, offset)} 1`
    : `${channel(tone.shadow, offset)} ${channel(tone.highlight, offset)}`,
  )
  return <svg className="home-sprite-tone" width="0" height="0" aria-hidden="true" focusable="false">
    <defs>
      <filter id={id} colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
        <feColorMatrix type="saturate" values="0" />
        <feColorMatrix type="matrix" values="1.35 0 0 0 -0.175  0 1.35 0 0 -0.175  0 0 1.35 0 -0.175  0 0 0 1 0" />
        <feComponentTransfer result="toned">
          <feFuncR type="table" tableValues={tables[0]} />
          <feFuncG type="table" tableValues={tables[1]} />
          <feFuncB type="table" tableValues={tables[2]} />
          <feFuncA type="identity" />
        </feComponentTransfer>
      </filter>
    </defs>
  </svg>
}
