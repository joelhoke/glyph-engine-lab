// =============================================================================
// Home content — single source of truth for the homepage (the `/` landing).
//
// The hero slots, the oversized statement, and the five scroll sections
// (Work / Vibe / Gallery / Collaborate / About me) are all editable config below. This
// file is serializable data only: custom hero preview renderers are named by
// string here and resolved against the registry in components/home/HeroObject.
//
// The Work section features derive from content/work.ts (titles and theses
// stay in sync with the case studies). Gallery carousel entries are projected
// into public metadata by app/page.tsx on the server — do NOT import
// functions/lib/prototypesManifest here: this module ships in the client
// bundle and the manifest carries password hashes.
// =============================================================================

import { GLOBAL_OPERATIONS_THUMBNAIL } from './workMedia'
import { SITE_IDENTITY } from './site'
import { WORK_STORIES } from './work'

export const HOME_SECTIONS = ['work', 'vibe', 'gallery', 'collaborate', 'about'] as const
export type HomeSectionId = (typeof HOME_SECTIONS)[number]
export type HeroSlotId = Exclude<HomeSectionId, 'about'> | 'intro'

export const HOME_NOTEBOOK_PAGE = {
  src: '/assets/home/notebook-introduction.webp',
  alt: 'Pink, purple, and blue watercolor with handwritten text: Hi, I’m Joel. Thanks for stopping by!',
}

export type HomeImage = {
  src: string
  alt: string
  width: number
  height: number
  objectPosition?: string
}

export type HomeHand = HomeImage & { flexSrc?: string; watercolorSrc?: string; watercolorFlexSrc?: string }

export type HomePortrait = HomeImage & {
  watercolorPath?: string
  spritePath?: string
  tone?: { mode: 'monotone'; color: string } | { mode: 'duotone'; shadow: string; highlight: string }
  hands?: { left: HomeHand; right: HomeHand }
}

export type HeroContent =
  | { kind: 'card'; title: string; body?: string }
  | { kind: 'image'; image: HomeImage }
  | { kind: 'custom'; renderer: string; fallback: HomeImage | null }

export type HeroSlot = {
  id: HeroSlotId
  label: string
  /** Homepage section this slot navigates to (`/#home/<section>`). */
  destination: HomeSectionId | null
  content: HeroContent
}

export type HomeFeature = {
  id: string
  title: string
  description: string
  href: string
  image?: HomeImage
}

export type HomeSectionContent = {
  heading: string
  lede?: string
  introduction: string
  paragraphs?: string[]
  features: HomeFeature[]
  action: { label: string; href: string }
}

export type HomeContent = {
  portrait?: HomePortrait
  introduction: string
  statement: Array<{ text: string; tone?: 'default' | 'accent' | 'warm' }>
  heroSlots: HeroSlot[]
  sections: Record<HomeSectionId, HomeSectionContent>
}

/** The current public Work stories as homepage features. The first story
 *  renders large (odd feature count → the section grid's leading slot spans
 *  both columns); the other two sit side by side. Global Operations shares
 *  its supplied thumbnail with the gallery; other previews use doorway art. */
const WORK_STORY_PREVIEWS: Record<string, HomeImage> = {
  'microsoft-global-operations': {
    src: GLOBAL_OPERATIONS_THUMBNAIL,
    alt: 'Microsoft logo over a blurred Global Operations dashboard',
    width: 3920,
    height: 2240,
  },
  'microsoft-employee-experience': {
    src: '/assets/doorways/work-employee-experience.jpg',
    alt: 'Employee Experience — Viva Connections dashboard',
    width: 600,
    height: 400,
  },
  'microsoft-global-compensation': {
    src: '/assets/doorways/work-global-compensation.jpg',
    alt: 'Global Compensation — Total Rewards portal',
    width: 600,
    height: 400,
  },
}

const workFeatures: HomeFeature[] = WORK_STORIES.filter(
  (story) => story.access === 'public',
).map((story) => ({
  id: story.id,
  title: story.title,
  description: story.thesis,
  href: `/#work/${story.id}`,
  ...(WORK_STORY_PREVIEWS[story.id] ? { image: WORK_STORY_PREVIEWS[story.id] } : {}),
}))

export const HOME_CONTENT: HomeContent = {
  // Pencil-sketch SpriteSamples head and hands, tinted site blue at rest.
  portrait: {
    src: '/assets/home/sprites/pencil/head-center.png',
    alt: 'A portrait of Joel Hoke, in blue pencil sketch at rest and watercolor during interaction',
    width: 640,
    height: 800,
    spritePath: '/assets/home/sprites/pencil',
    watercolorPath: '/assets/home/sprites/watercolor',
    tone: { mode: 'monotone', color: '#3B9EC8' },
    hands: {
      left: { src: '/assets/home/sprites/pencil/hand-left.png', flexSrc: '/assets/home/sprites/pencil/hand-left-flex.png', watercolorSrc: '/assets/home/sprites/watercolor/hand-left.png', watercolorFlexSrc: '/assets/home/sprites/watercolor/hand-left-flex.png', alt: '', width: 560, height: 545 },
      right: { src: '/assets/home/sprites/pencil/hand-right.png', flexSrc: '/assets/home/sprites/pencil/hand-right-flex.png', watercolorSrc: '/assets/home/sprites/watercolor/hand-right.png', watercolorFlexSrc: '/assets/home/sprites/watercolor/hand-right-flex.png', alt: '', width: 560, height: 492 },
    },
  },
  introduction: SITE_IDENTITY.positioning,
  statement: [
    { text: 'Designing thoughtful experiences where people, business, and technology meet.' },
    { text: 'Seven years at Microsoft,', tone: 'accent' },
    { text: 'from employee experience to agentic operations tools.' },
    { text: 'Looking for the next' },
    { text: 'interesting problem.', tone: 'accent' },
  ],
  // Five hero slots in fan order (left to right): Work, Vibe, Introduction,
  // Collaborate, Gallery. The object destinations render the
  // three.js section objects (registry keys resolve in
  // components/home/renderers/HeroThreeObject.tsx); each keeps its doorway
  // image as the WebGL-failure fallback.
  heroSlots: [
    {
      id: 'work',
      label: 'Work — selected Microsoft case studies',
      destination: 'work',
      content: {
        kind: 'custom',
        renderer: 'three:work',
        fallback: WORK_STORY_PREVIEWS['microsoft-global-operations'],
      },
    },
    {
      id: 'vibe',
      label: 'Vibe — the playground for this site’s glyph engine',
      destination: 'vibe',
      content: {
        kind: 'custom',
        renderer: 'three:vibe',
        fallback: {
          src: '/assets/doorways/vibe-signature.svg',
          alt: 'The playground in the Signature theme',
          width: 600,
          height: 400,
        },
      },
    },
    {
      id: 'intro',
      label: 'Introduction',
      destination: 'about',
      content: {
        kind: 'card',
        title: SITE_IDENTITY.name,
        body: SITE_IDENTITY.role,
      },
    },
    {
      id: 'collaborate',
      label: 'Collaborate — ask the guide or email Joel',
      destination: 'collaborate',
      content: {
        kind: 'custom',
        renderer: 'three:collaborate',
        fallback: {
          src: '/assets/doorways/collaborate-guide.svg',
          alt: 'A typographic card inviting a question for the guide',
          width: 600,
          height: 400,
        },
      },
    },
    {
      id: 'gallery',
      label: 'Gallery — prototypes and experiments',
      destination: 'gallery',
      content: { kind: 'custom', renderer: 'three:gallery', fallback: null },
    },
  ],
  sections: {
    about: {
      heading: 'About me',
      lede: 'Hey, I’m Joel.',
      introduction: 'I’m a product designer in Seattle. I spent seven years at Microsoft working on the ways people experience work — from employee tools to campus operations.',
      paragraphs: [
        'This site is a little introduction to me, and a place to try things out. You’ll find the work, a few experiments, and plenty of things to play with.',
        'I’m looking for the next interesting problem. If something here catches your eye, I’d love to hear from you.',
      ],
      features: [],
      action: { label: 'Say hello', href: '/#home/collaborate' },
    },
    work: {
      heading: 'Work',
      lede: 'From a complex problem to a product people rely on.',
      introduction:
        'I spent seven years at Microsoft designing AI-powered tools and employee experiences that make complex work easier. Along the way, my work contributed to Microsoft’s 2026 Digie Award win, and I placed third in its 2022 Global Hackathon.',
      features: workFeatures,
      action: { label: 'See how I work', href: '/#work' },
    },
    vibe: {
      heading: 'Vibe',
      lede: 'Create something of your own',
      introduction:
        'Play with type, color, and motion. You can even open one of the latest playground creations and build from there!',
      features: [
        {
          id: 'vibe-playground',
          title: 'The playground',
          description:
            'Everything is editable, reversible, and local — compositions save in your browser, and saved pieces can join the public creations archive.',
          href: '/#vibe',
        },
      ],
      action: { label: 'Open the playground', href: '/#vibe' },
    },
    gallery: {
      heading: 'Gallery',
      introduction:
        'A collection of demos, explorations, and working ideas',
      features: [
        {
          id: 'type-lab',
          title: 'Type & motion explorations',
          description:
            'Small self-contained studies in motion and interaction — a place for experiments that do not fit a case study.',
          href: '/gallery',
        },
        {
          id: 'golden-age-collectables',
          title: 'Golden Age Collectables',
          description:
            'Two website options for the Pike Place comic shop — both affordable, one just a little fancier than the other.',
          href: '/gallery',
        },
      ],
      action: { label: 'Browse the gallery', href: '/gallery' },
    },
    collaborate: {
      heading: 'Collaborate',
      lede: 'Good work starts with a hello.',
      introduction:
        'Let’s build something interesting together. The collaborations that energize me most are the ones where the problem is still a little undefined — ask the AI guide anything, or go straight to my inbox.',
      features: [],
      action: { label: 'Start the conversation', href: '/#home/collaborate' },
    },
  },
}
