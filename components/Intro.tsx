'use client'

import Logo from './Logo'

export default function Intro() {
  return (
    <section className="intro-copy">
      <div className="intro-brand">
        <Logo className="intro-logo" />
      </div>
      <h1> This isn't a portfolio.</h1>
      <p>It's a place to explore my work, thinking and what we might create together.</p>
    </section>
  )
}
