import { COLLABORATE_CONTACT } from './collaborate'

/**
 * Site-level identity and recruiter links. Single source for the persistent
 * header (SiteHeader) and the homepage (content/home.ts consumes
 * SITE_IDENTITY for the portrait placeholder and introduction).
 *
/* Phase 0 placeholders still owed before launch:
 * - AVATAR: the ~48px header avatar still points at the monogram.
 * - RESUME: replace the placeholder public/resume.pdf with the final file.
 * - LINKEDIN: confirm the profile URL below.
 */
export const SITE_IDENTITY = {
  name: 'Joel Hoke',
  role: 'Senior Product Designer',
  positioning:
    'Seven years at Microsoft designing the future of work, from employee experience to agentic operations tools.',
  /** ~200px homepage portrait (treated cutout WebP). */
  portraitSrc: '/assets/home/portrait.webp',
  /** ~48px header avatar (placeholder: monogram). */
  avatarSrc: '/JHLogo-180.png',
  portraitAlt: 'Joel Hoke smiling with arms outstretched',
} as const

export const RECRUITER_LINKS = {
  resume: { url: '/resume.pdf', label: 'Résumé' },
  // TODO: confirm — guessed from the handle pattern, never verified.
  linkedin: { url: 'https://www.linkedin.com/in/joelhoke/', label: 'LinkedIn' },
  email: { url: COLLABORATE_CONTACT.mailtoUrl, label: 'Email' },
} as const

export const PORTRAIT_CREDIT = 'Portrait sprites from Joel Hoke’s SpriteSamples: AI-generated pencil-sketch head angles and hands, shown in #3B9EC8 blue monotone at rest and fading to matching watercolor sprites during hero interaction.'

export type ModelCredit = {
  title: string
  author: string
  authorUrl: string
  sourceUrl: string
  licenseUrl: string
  licenseLabel?: string
  /** Where the model appears on the site. */
  usedFor: string
  /** Identify our adaptations alongside the original author attribution. */
  modifications: string
}

/**
 * Licensed 3D models used on the homepage (public/assets/home/models/;
 * each folder keeps its Sketchfab license.txt). Rendered in the Privacy and
 * feedback panel's Credits tab — the license requires naming the author.
 */
export const MODEL_CREDITS: ModelCredit[] = [
  {
    title: 'Apple iPhone 18 Pro Max Black 2026',
    author: 'extraakash',
    authorUrl: 'https://sketchfab.com/AakashMansukhani',
    sourceUrl: 'https://sketchfab.com/3d-models/apple-iphone-18-pro-max-black-2026-8fd804a9b0ea49249de3f1e0450fbc9c',
    licenseUrl: 'https://sketchfab.com/licenses',
    licenseLabel: 'Sketchfab Standard',
    usedFor: 'Work',
    modifications: 'Blue frame accents, cursor-reactive orientation, and a supplied employee experience dashboard mapped to the original screen geometry.',
  },
  {
    title: 'CRT Computer Monitor',
    author: 'Dan (fizyman)',
    authorUrl: 'https://sketchfab.com/fizyman',
    sourceUrl:
      'https://sketchfab.com/3d-models/crt-computer-monitor-f2ff0013f86e4cd0a2aee183a23bdfee',
    licenseUrl: 'http://creativecommons.org/licenses/by/4.0/',
    usedFor: 'Work',
    modifications: 'Recolored with custom logo and highlight-reel screens; textures resized and compressed for the web.',
  },
  {
    title: "Dandys World Brusha's PaintBrush",
    author: 'NotThatGuy™',
    authorUrl: 'https://sketchfab.com/Ngboy111111111',
    sourceUrl:
      'https://sketchfab.com/3d-models/dandys-world-brushas-paintbrush-19397f41ab1847b8b5391e5896e19d63',
    licenseUrl: 'http://creativecommons.org/licenses/by/4.0/',
    usedFor: 'Vibe',
    modifications: 'Smoothed geometry and recolored paint tip; paired with a separate splatter backdrop.',
  },
  {
    title: 'Fancy Picture Frame',
    author: 'Jamie McFarlane',
    authorUrl: 'https://sketchfab.com/jamiemcfarlane',
    sourceUrl:
      'https://sketchfab.com/3d-models/fancy-picture-frame-b54984abe2394345a81621719bf8bf1a',
    licenseUrl: 'http://creativecommons.org/licenses/by/4.0/',
    usedFor: 'Gallery',
    modifications: 'Recolored.',
  },
  {
    title: 'Flip Phone',
    author: 'Daniel_litt',
    authorUrl: 'https://sketchfab.com/Daniel_litt',
    sourceUrl:
      'https://sketchfab.com/3d-models/flip-phone-7772aca6cc7545dcb47c03b2ceac675f',
    licenseUrl: 'http://creativecommons.org/licenses/by/4.0/',
    usedFor: 'Collaborate',
    modifications: 'Recolored with an animated hinge, custom invitation and interactive chat screens, clickable original keypad buttons with multi-tap input, illuminated legends, and press feedback, and a pixelated JH standby display.',
  },
  {
    title: 'Notebook_Material',
    author: 'tinderboxh',
    authorUrl: 'https://sketchfab.com/tinderboxh',
    sourceUrl:
      'https://sketchfab.com/3d-models/notebook-material-e573304fce364cf299027494fc1afede',
    licenseUrl: 'http://creativecommons.org/licenses/by/4.0/',
    usedFor: 'Introduction',
    modifications: 'Recolored with an added opening cover and a watercolor welcome page supplied by Joel Hoke.',
  },
]
