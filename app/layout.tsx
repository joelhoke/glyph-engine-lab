import type { Metadata } from 'next'
import { Cabin } from 'next/font/google'
import './globals.css'

// Cabin Bold for primary display headings only (Vibe/Collaborate headings,
// Work slide titles, protected case-study titles). next/font self-hosts the
// font at build time — no runtime request to Google. Everything else keeps
// the Cutive Mono stack.
const cabin = Cabin({
  weight: '700',
  subsets: ['latin'],
  variable: '--font-display',
})

// Production origin. Used for metadataBase (resolves relative OG/icon URLs)
// and the canonical link.
const SITE_URL = 'https://joelhoke.me'

const SITE_TITLE = 'joel hoke design'
const SITE_DESCRIPTION =
  'Design portfolio of Joel Hoke — selected work, experiments in motion and type, and ways to collaborate.'

/**
 * Minimal inline fallback styling (M9 launch hardening). When the external
 * stylesheet fails to load — tunnel interstitials, blocked assets, strict
 * MIME rejection — these rules keep the branded no-JavaScript/error state,
 * the skip link, and the visually hidden semantic digests presentable. This
 * deliberately covers ONLY the chrome that must never appear as raw
 * unstyled content; the full design lives in globals.css and is not
 * duplicated here.
 */
const CRITICAL_FALLBACK_CSS = `
body{margin:0;background:#090c12;color:#ccc;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.visually-hidden{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.skip-link{position:fixed;top:.75rem;left:.75rem;z-index:100;padding:.6rem 1rem;border-radius:8px;background:#0e1620;color:#f7fbff;text-decoration:none;transform:translateY(-300%)}
.skip-link:focus-visible{transform:none;outline:2px solid #8abaff;outline-offset:3px}
.canvas-fallback{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.9rem;padding:2rem 1.5rem;text-align:center;background:radial-gradient(circle at 50% 45%,#141026 0%,#090c12 75%)}
.canvas-fallback-logo{width:90px;height:90px}
.canvas-fallback-title{font-size:1.25rem;letter-spacing:.08em;color:#f5f7fb;margin:0}
.canvas-fallback-copy{font-size:.85rem;line-height:1.7;color:#c5d4ea;margin:0}
.noscript-note{position:fixed;left:50%;bottom:1.25rem;transform:translateX(-50%);max-width:32rem;margin:0;padding:.75rem 1.1rem;border:1px solid rgba(143,227,245,.35);border-radius:10px;background:rgba(14,22,32,.92);color:#d8edf2;font-size:.8rem;line-height:1.6;text-align:center;z-index:60}
`

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s — ${SITE_TITLE}`,
  },
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: '/',
    siteName: SITE_TITLE,
    type: 'website',
    images: [
      {
        url: '/assets/og-1200x630.png',
        width: 1200,
        height: 630,
        alt: 'joel hoke design — selected work, motion and type experiments',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ['/assets/og-1200x630.png'],
  },
  icons: {
    icon: { url: '/favicon-32x32.png', type: 'image/png', sizes: '28x32' },
    apple: { url: '/apple-icon-180x180.png', type: 'image/png', sizes: '161x180' },
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body className={cabin.variable}>
        {/* Inline first so the branded chrome never flashes unstyled when the
            external stylesheet is slow, blocked, or rejected. */}
        <style dangerouslySetInnerHTML={{ __html: CRITICAL_FALLBACK_CSS }} />
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        {children}
        <noscript>
          <p className="noscript-note">
            JavaScript is disabled, so the interactive canvas is offline. The
            work, vibe, and collaborate summaries on this page remain readable
            — enable JavaScript to explore the full experience.
          </p>
        </noscript>
      </body>
    </html>
  )
}
