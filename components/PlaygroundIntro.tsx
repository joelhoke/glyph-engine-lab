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
      <h1>This space is under construction</h1>
    </section>
  )
}
