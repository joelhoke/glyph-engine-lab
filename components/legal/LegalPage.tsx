import type { ReactNode } from 'react'
import SiteHeader from '../SiteHeader'
import './legal.css'

export default function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="legal-page">
      <SiteHeader active="home" />
      <main id="main-content" className="legal-content">
        <h1>{title}</h1>
        {children}
        <nav className="legal-links" aria-label="Site information">
          <a href="/">Home</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a>
          <a href="mailto:create@joelhoke.me">Contact Joel</a>
        </nav>
      </main>
    </div>
  )
}
