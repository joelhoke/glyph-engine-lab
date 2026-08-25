import Link from 'next/link'
import { RECRUITER_LINKS } from '../../content/site'
import JHMark from '../JHMark'

const NAV_ITEMS: { href: string; label: string; current?: boolean }[] = [
  // The homepage experience settles into each scene from the URL hash
  // (engine/experienceHash.ts), so plain links work from any gallery route.
  { href: '/#work', label: 'Work' },
  { href: '/#vibe', label: 'Vibe' },
  { href: '/#collaborate', label: 'Collaborate' },
  { href: '/gallery', label: 'Gallery', current: true },
]

/**
 * Persistent site frame for the hosted-prototypes routes (/gallery, /p/*):
 * the same header the homepage experience wears (components/SiteHeader.tsx
 * on feature/persistent-header), but as plain links — these pages have no
 * canvas scene to drive, so the tabs route home into each experience hash.
 * Server component: no client state, no interactivity beyond navigation.
 *
 * On phones (≤560px) the recruiter links move to a fixed bottom bar — the
 * header can't fit them — leaving the lockup and tabs on one row.
 */
export default function GalleryHeader() {
  const recruiterLinks = (
    <>
      <a href={RECRUITER_LINKS.resume.url} target="_blank" rel="noopener noreferrer">
        {RECRUITER_LINKS.resume.label}
      </a>
      <a href={RECRUITER_LINKS.linkedin.url} target="_blank" rel="noopener noreferrer">
        {RECRUITER_LINKS.linkedin.label}
        <span aria-hidden="true"> ↗</span>
      </a>
      <a href={RECRUITER_LINKS.email.url}>{RECRUITER_LINKS.email.label}</a>
    </>
  )

  return (
    <>
      <header className="site-header">
        <Link
          href="/"
          className="site-header-home"
          aria-label="joel hoke design — back to home"
        >
          {/* The monogram is the whole lockup: inlined with currentColor so
              the theme sets it (near-white on dark, near-black on light). */}
          <JHMark className="site-header-mark" aria-hidden="true" />
        </Link>
        <nav className="site-header-nav" aria-label="Experience">
          <ul className="experience-nav-list">
            {NAV_ITEMS.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="experience-nav-button"
                  aria-current={item.current ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="site-header-links">{recruiterLinks}</div>
      </header>
      {/* Phone-only bottom bar: the recruiter links that don't fit the
          header. Hidden on wider viewports (display:none removes it from
          focus order and AT, so the header copy is the only one). */}
      <footer className="site-footer">
        <div className="site-footer-links">{recruiterLinks}</div>
      </footer>
    </>
  )
}
