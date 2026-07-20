'use client'

import { RefObject } from 'react'

type IntroProps = {
  taglineRef?: RefObject<HTMLElement | null>
}

export default function Intro({ taglineRef }: IntroProps) {
  return (
    <section
      className="intro-copy tagline-hidden"
      aria-hidden="true"
      ref={taglineRef as React.RefObject<HTMLElement>}
    >
      <h1>This isn't a portfolio.</h1>
      <p>It's a place to explore my work, thinking and what we might create together.</p>
    </section>
  )
}
