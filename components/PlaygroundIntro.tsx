'use client'

import { RefObject } from 'react'

type PlaygroundIntroProps = {
  taglineRef?: RefObject<HTMLElement | null>
}

export default function PlaygroundIntro({ taglineRef }: PlaygroundIntroProps) {
  return (
    <section
      className="intro-copy tagline-hidden"
      aria-hidden="true"
      ref={taglineRef as React.RefObject<HTMLElement>}
    >
      <h1>The vibe field is open — make it yours</h1>
    </section>
  )
}
