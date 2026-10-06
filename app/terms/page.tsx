import type { Metadata } from 'next'
import LegalPage from '../../components/legal/LegalPage'

const description = 'Terms for using Joel Hoke’s portfolio, demos, playground, and AI guide.'
export const metadata: Metadata = {
  title: 'Terms — Joel Hoke', description,
  alternates: { canonical: '/terms' },
  openGraph: { title: 'Terms — Joel Hoke', description, url: '/terms', images: ['/assets/og-1200x630.png'] },
}

export default function TermsPage() {
  return <LegalPage title="Terms of use">
    <p>Updated September 21, 2026</p>
    <p>You are welcome to browse the portfolio and experiment with its interactive tools. These terms explain how the site and visitor contributions may be used. Questions can be sent to <a href="mailto:create@joelhoke.me">create@joelhoke.me</a>.</p>
    <h2>Portfolio and third-party material</h2>
    <p>Portfolio work, names, logos, and other material remain the property of their respective owners. Viewing a case study does not grant permission to reuse its contents. Third-party models and assets retain their original licenses; their credits are available through the homepage’s question-mark button. Protected work is shared for review only and should not be redistributed.</p>
    <h2>Your creations</h2>
    <p>You retain any rights you hold in the material you contribute. Only upload or submit content you have permission to use and share. The Vibe playground saves qualifying editing sessions and exports to the site; read the <a href="/privacy">privacy notice</a> before uploading personal or confidential material.</p>
    <p>By submitting a creation, you permit Joel to store, process, and display it as needed to operate the playground and, following review, the creations gallery. This permission does not transfer ownership. To request removal, email Joel with the creation link or identifying details. Content may be declined or removed for privacy, rights, safety, or operational reasons.</p>
    <h2>Responsible use</h2>
    <p>Do not submit unlawful material, impersonate others, send spam, bypass access controls, or disrupt the site. Request limits and moderation help keep the interactive features available. Please report a problem privately rather than accessing someone else’s information.</p>
    <h2>Demos and the AI guide</h2>
    <p>Experiments and demos may change or be unavailable. Keep your own copies of anything you want to retain; the playground archive is limited. AI answers can be incomplete or inaccurate and do not create a commitment on Joel’s behalf. Contact Joel directly to confirm availability, project details, or an agreement.</p>
    <h2>Availability and applicable rights</h2>
    <p>The site is provided as available, without a promise that every feature will be uninterrupted or error-free. Nothing in these terms limits rights or remedies that cannot lawfully be excluded. These terms may be updated as the site changes.</p>
  </LegalPage>
}
