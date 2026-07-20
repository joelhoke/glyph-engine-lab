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
      <h1>The portfolio is under construction.</h1>
      <p>The playground is open. Upload a shape, change the type, and make the field your own.</p>
    </section>
  )
}
