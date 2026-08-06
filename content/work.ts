// =============================================================================
// Work content — single source of truth for the Work experience.
//
// Every case study's copy, links, structured narrative, media, source SVG,
// palette, and behavior overrides live in the WORK_STORIES array below. The
// collection is open-ended: any non-empty set of stories renders, in array
// order. content/work-template.md is the authoring template for new stories.
//
// Confidentiality rule: a story with access: 'protected' carries ONLY an
// approved non-sensitive teaser plus its opaque protectedId — never narrative
// details, media, or client-revealing copy. Confidential manifests and media
// live outside this repository (see docs/deployment.md, "Confidential work").
// =============================================================================

import { SceneDescriptor } from '../engine/sceneConfig'
import { GlyphColorMode } from '../engine/colorDistribution'
import { VisualSourceKind } from '../engine/visualSource'

export type WorkStoryLink = {
  /** External URL (https). Plain <a href> — works in the static export. */
  url: string
  /** Visible, descriptive link label (never "click here"). */
  label: string
  /** Optional inline icon/thumbnail shown before the link label. */
  iconSrc?: string
}

/**
 * Reusable per-slide brand-mark slot for the Work card header. Every slide
 * may show a mark (all current slides are Microsoft case studies); future
 * case studies can supply a different mark or omit the field entirely.
 */
export type WorkBrandMark = {
  /** Default (dark-theme) asset, under public/assets/work/. */
  src: string
  /** Optional light-theme variant, selected via a <picture> media query. */
  lightSrc?: string
  /** Accessible label. Omit for decorative marks (the brand is already named
   *  in the visible copy, as with Microsoft). */
  alt?: string
}

/** The shared Microsoft mark: white squares on dark, #101826 on light. */
export const MICROSOFT_BRAND_MARK: WorkBrandMark = {
  src: '/assets/work/microsoft-mark.svg',
  lightSrc: '/assets/work/microsoft-mark-light.svg',
}

/** Public image media (AVIF, WebP, JPEG, PNG). Dimensions and alt are required. */
export type WorkMediaImage = {
  kind: 'image'
  /** Stable, unique within the story — referenced from details sections. */
  id: string
  src: string
  width: number
  height: number
  alt: string
  caption?: string
  /** Optional smaller preview src; defaults to src. */
  thumbnail?: string
}

/** Hosted video (MP4/WebM). Captions/transcript metadata is required. */
export type WorkMediaVideo = {
  kind: 'video'
  id: string
  src: string
  width: number
  height: number
  /** Short accessible description of the video content. */
  alt: string
  caption?: string
  /** Poster frame (required for hosted video). */
  poster: string
  /** WebVTT captions track URL. */
  captionsSrc?: string
  /** Transcript: inline text or a URL to a transcript document. */
  transcript: string
}

/** Third-party embed — rendered only after explicit visitor interaction. */
export type WorkMediaEmbed = {
  kind: 'embed'
  id: string
  provider: 'youtube' | 'vimeo'
  videoId: string
  /** Accessible title for the embed facade and iframe. */
  title: string
  caption?: string
}

export type WorkMedia = WorkMediaImage | WorkMediaVideo | WorkMediaEmbed

export type WorkStoryAttachment = {
  label: string
  url: string
}

/** One ordered narrative section inside the expanded case study. */
export type WorkStoryDetailsSection = {
  heading: string
  paragraphs?: string[]
  /** Bullet list items (contributions, metrics, callouts). */
  items?: string[]
  /** Optional highlighted callout line. */
  callout?: string
  attachments?: WorkStoryAttachment[]
  /** IDs of media entries rendered within this section. */
  mediaIds?: string[]
}

export type WorkStory = {
  /** Stable, unique identifier — used as the React key and in diagnostics. */
  id: string
  /** Case study name. */
  title: string
  /** One-line thesis: what the project is and why it matters. */
  thesis: string
  /** The owner's role on the project. */
  role: string
  /** Client/team/timeframe context. */
  context: string
  /** Concise outcome statement. */
  outcome: string
  /** External references; may be empty. */
  links: WorkStoryLink[]
  /** Public stories render fully; protected stories show only the teaser. */
  access: 'public' | 'protected'
  /** Opaque protected ID — set only when access is 'protected'. The server
   *  maps it to private R2 keys; it reveals nothing by itself. */
  protectedId?: string
  /** Expanded narrative — public stories only. */
  details?: WorkStoryDetailsSection[]
  /** Gallery media — public stories only. */
  media?: WorkMedia[]
  /** Hero source sampled as the canvas target field, under public/assets/work/. */
  sourceUrl: string
  /** Optional light-theme hero variant (white marks would vanish on light). */
  lightSourceUrl?: string
  /** Optional glyph-text override for the story's field. */
  glyphText?: string
  /** Source asset kind — 'svg' by default; 'raster' for PNG/JPEG heroes. */
  sourceKind?: VisualSourceKind
  /** Optional per-story glyph palette override (hex colors). */
  palette?: string[]
  /** Optional per-story background gradient override. */
  background?: { color1: string; color2: string }
  /** Optional per-story color-distribution override (e.g. source-colors so the
   *  sampled brand colors paint the field instead of a palette). */
  colorMode?: GlyphColorMode
  /** Optional brand mark shown in the Work card header for this story. */
  mark?: WorkBrandMark
  /** Optional per-story simulation overrides (merged over the work scene). */
  behavior?: Partial<SceneDescriptor['behavior']>
}

export const WORK_STORIES: WorkStory[] = [
  {
    id: 'microsoft-global-operations',
    title: 'Global Operations',
    thesis:
      'Optimizing global campus operations through agentic building onboarding and mapping, paired with user-insight dashboards and agents.',
    role: 'Lead designer',
    context:
      'Microsoft · cross-functional team across design, product management, research, and engineering · 2025–2026',
    outcome:
      'Two agent-integrated operational dashboards that synthesized information spread across 48+ Power BI dashboards and SharePoint folders — and a foundation for an operational ecosystem of tools serving teams domestically and internationally.',
    links: [],
    access: 'public',
    mark: MICROSOFT_BRAND_MARK,
    details: [
      {
        heading: 'Two products, one operational stack',
        paragraphs: [
          'This project encompassed two business verticals. The first: direct operations teams onboarding and managing buildings and assets, and monitoring and acting on faults and alarms. The second: lobby hosts, facility managers, and district facility managers. Building Orchestrator supported the former while Live Campus supported the latter.',
        ],
      },
      {
        heading: 'The challenge',
        paragraphs: [
          'Building operations teams: vendor teams monitoring faults and alarms across a full campus of buildings with millions of devices and assets face an incredible challenge. Per year, hundreds of thousands of alarms and faults ring across those assets — hundreds per hour. That creates a huge scope of responsibility for small teams of only 8–12 people with tight budgets and response times that depend on the alarm. New devices and assets are onboarded daily, adding the overhead of completing that process and managing those assets across a variety of building management systems. Widely varying variables and inconsistent naming conventions create a seemingly overwhelming amount of data.',
          'Lobby hosts: the vendor hosts who support employees and visitors alike — ensuring smooth transitions in and out of buildings for all occupants, clear guidance to and from rooms and areas, and support with filing and reporting the status of building work orders, facilities requests, active construction projects, and general room comfort.',
          'Facility managers and district facility managers: facility managers oversee individual buildings, aiming for consistent operations with as few disruptions as possible across temperature, facilities, services, projects, and events — effectively owning responsibility for every building operation that lobby hosts simply monitor and support. District facility managers focus on financial operations across multiple buildings: operational cost, capital expenditures on construction projects — campus health where facility managers focus on the individual building.',
          'Each of these users needs an interface to support their day-to-day tasks, and many of those needs are grounded in gaining insight from the key data points and metrics across building operations.',
        ],
      },
      {
        heading: 'The approach',
        paragraphs: [
          'Deep user learning through multiple rounds of workshops and qualitative user research interviews and feedback sessions. We started by understanding the key jobs to be done by each user persona; that learning led deeper into the operational stack — buildings, devices, assets, faults, alarms, facilities requests, work orders based on faults and alarms to fix device or asset issues and failures, preventative maintenance, and more. With the key jobs and context in hand, we developed architectural models and interactive prototypes to solve those user needs. Wash, rinse, repeat with research and design development.',
        ],
      },
      {
        heading: 'My contributions',
        items: [
          'Building Orchestrator UX, strategy, and conference keynote — which led to Microsoft earning the 2026 Digie award for "Most Intelligent Corporate Headquarters".',
          'Live Campus UX and strategy.',
          'Shared architecture supporting the option of broad ecosystem development across operational tooling.',
        ],
      },
      {
        heading: 'The outcome',
        paragraphs: [
          'Two agent-integrated operational dashboards that synthesized information spread across 48+ Power BI dashboards and SharePoint folders. The work established a foundation for an operational ecosystem of tools to serve the many different operational teams domestically and internationally.',
        ],
      },
    ],
    media: [],
    // Microsoft project: the field takes the sampled brand colors straight
    // from the source SVG.
    sourceUrl: '/assets/work/building-multiple.svg',
    lightSourceUrl: '/assets/work/building-multiple-light.svg',
    glyphText: 'Do more with less ',
    colorMode: 'source-colors',
    // This story's field reacts to the pointer a little more than the
    // work-mode baseline.
    behavior: { particleRepel: 0.3 },
  },
  {
    id: 'microsoft-global-compensation',
    title: 'Microsoft Global Compensation',
    thesis:
      'Fortune 500 companies like Microsoft provide expansive pay packages composed of cash, stock and employee benefits. These comprehensive packages can lead to confusion around how much exactly they’re taking home as well as benefits going completely unused. A platform that clarifies those questions and connects employees to their benefits ensures employees get the most out of their compensation which reinforces employee satisfaction and reduces the likelihood of employee benefits going unused.',
    role: 'Lead Designer',
    context:
      'Microsoft · cross-functional team across design, product management, research, and engineering · 2021',
    outcome:
      'A first party platform that continues to be used to communicate employee compensation and benefits that helps a business like Microsoft ensure employees are reminded the value of their package in an ever changing and competitive market.',
    links: [
      {
        label: 'Helping Microsoft employees understand their value',
        url: 'https://www.microsoft.com/insidetrack/blog/helping-microsoft-employees-understand-their-value-with-the-total-rewards-portal/',
        iconSrc: '/assets/work/Stocks.png',
      },
    ],
    access: 'public',
    mark: MICROSOFT_BRAND_MARK,
    details: [
      {
        heading: 'The challenge',
        paragraphs: [
          'Moving from a 3rd party platform to a 1st party platform comes with a variety of challenges. What started as a simple lift and shift re-skin in addition to my primary workload became a full redesign. And a 6-month engagement expanded to closer to 12. Creating something new while aligning to established user expectations is a fine line to walk. There was clear need to better surface the total value of benefits and communicating stock awards, especially the ambiguity of their value over the long term.',
        ],
      },
      {
        heading: 'The approach',
        paragraphs: [
          'Start with the user and go where their needs dictate. An introductory research study to understand how employees used the 3rd party tool surfaced some clear needs for additional clarity, as the portal that was in place did the job of communicating the headlines: cash, stock, benefits. But once users started to scratch below the surface things started to fall apart. This led to follow up studies, where we tested design prototypes and got clarification around some of the key gaps between the 3rd party tool and employees’ understanding of their compensation and value.',
        ],
      },
      {
        heading: 'My contributions',
        items: [
          'Platform redesign',
          'Coordination across PM, research and engineering',
          'Scope expansion in service of the business and employee needs',
        ],
      },
      {
        heading: 'The outcome',
        paragraphs: [
          'A first party platform that continues to be used to communicate employee compensation and benefits that helps a business like Microsoft ensure employees are reminded the value of their package in an ever changing and competitive market.',
        ],
      },
    ],
    media: [],
    sourceUrl: '/assets/work/story-02.svg',
  },
  {
    id: 'microsoft-employee-experience',
    title: 'Microsoft Employee Experience',
    role: 'Junior to Senior Designer',
    context: 'Microsoft · cross-functional team across design, product management, research, and engineering · 2019–2026',
    thesis: 'Supporting efficiency across Microsoft by reducing fragmentation across internal tools, enabling employees to complete tasks more easily and return their focus to the work at hand.',
    outcome: 'I helped Microsoft move toward a more unified employee-experience ecosystem by aligning teams around shared patterns, reusable components, and a standardized design process.',
    links: [
      { label: 'Microsoft MyHub', url: 'https://apps.apple.com/us/app/microsoft-myhub/id1476326475' },
      { label: 'Microsoft Viva Connections', url: 'https://www.microsoft.com/en-us/microsoft-viva/connections' },
      { label: 'The People Powered Workplace — an Employee Experience Platform analysis', url: 'https://pulse.microsoft.com/wp-content/uploads/2023/11/Microsoft-Viva-Ebook.pdf' },
    ],
    access: 'public',
    sourceUrl: '/assets/work/MyHubTest.png',
    sourceKind: 'raster',
    colorMode: 'source-colors',
    mark: MICROSOFT_BRAND_MARK,
    glyphText: 'Defragmenting the Employee Experience ',
    media: [],
    details: [
      { heading: 'The thesis', paragraphs: [
        'Employee experience at the scale of a business like Microsoft — built over 50 years — presents challenges from many perspectives. The work ranged from helping employees commute, order lunch, and review compensation information to supporting broader business needs and engagement targets that help employees stay focused and efficient.',
      ] },
      { heading: 'The challenge', paragraphs: [
        'At Microsoft’s scale, employee experience was not a single product — it was an interconnected ecosystem of services owned by many different business groups. From pay, stock, and retirement benefits to commuter transportation, workplace reporting, and facilities support, employees expected a clear and consistent experience even when the systems behind it were highly distributed.',
        'The challenge was to make those organizational boundaries less visible: defragmenting journeys, aligning interaction patterns, and coordinating teams around a more coherent employee experience, while helping employees complete tasks efficiently and return to the work at hand.',
      ] },
      { heading: 'The approach', paragraphs: [
        'Every engagement was shaped by the needs of the business, project goals, and stakeholders involved, while defragmentation and user efficiency remained foundational priorities.',
        'Once we aligned on the problem, desired outcomes, and key constraints, we used the Double Diamond as a flexible framework for discovery, definition, development, and delivery. Research guided each iteration — first helping us understand challenges in the existing experience, and later evaluating prototypes or working solutions to identify remaining friction and opportunities.',
        'We used those insights to refine the experience, validate decisions, and repeat the process until we had addressed both employee needs and business objectives.',
      ] },
      { heading: 'My contributions, 2019–2024', items: [
        'Stock experience',
        'Pay preview',
        'Shuttles',
        'Connectors (private buses)',
        'Facilities requests',
        'Security: Report It Now',
        'Ecosystem alignment and transitions between platforms',
        'Component toolkits for use across tools and business verticals',
        'Lobby experience',
        'Return-to-work implementation and tracking',
      ] },
      { heading: 'The outcome', paragraphs: [
        'I helped Microsoft move toward a more unified employee-experience ecosystem by aligning teams around shared patterns, reusable components, and a standardized design process.',
        'As employee services transitioned from MyHub to Microsoft Viva Connections, our team created the EX Toolkit — a common design language and component library that reduced variation and duplicated implementation across teams, made platform capabilities and constraints clearer to developers, streamlined partner onboarding, and improved consistency across compensation, benefits, workplace services, and daily employee tasks.',
        'This work supported an employee platform deployed globally at Microsoft, established practices shared with other product teams and external customers, and contributed to the broader evolution from fragmented employee tools toward a centralized Viva experience. Microsoft later reported usage above 97% among employees across the Viva suite.',
      ] },
    ],
  },
]

export const WORK_STORY_COUNT = WORK_STORIES.length

/** Wrap-around navigation: index after `current`, clamped into [0, count). */
export function nextWorkStoryIndex(current: number, count: number = WORK_STORY_COUNT): number {
  if (count <= 0) return 0
  return (((current + 1) % count) + count) % count
}

/** Wrap-around navigation: index before `current`, clamped into [0, count). */
export function previousWorkStoryIndex(current: number, count: number = WORK_STORY_COUNT): number {
  if (count <= 0) return 0
  return (((current - 1) % count) + count) % count
}

/** Bounds-safe story lookup — out-of-range indices fall back to the first story. */
export function getWorkStory(index: number): WorkStory {
  return WORK_STORIES[index] ?? WORK_STORIES[0]
}

/** Media lookup within a story, by media ID. */
export function getWorkMedia(story: WorkStory, mediaId: string): WorkMedia | null {
  return story.media?.find((entry) => entry.id === mediaId) ?? null
}

/**
 * One Work slide. The intro slide opens the mode with the tenure summary and
 * its own hero source; project slides wrap a story from WORK_STORIES, so
 * appending a story automatically appends a project slide.
 */
export type WorkSlide =
  | {
      kind: 'intro'
      /** Stable, unique identifier — used as the React key and in diagnostics. */
      id: string
      title: string
      /** The Work introduction copy (formerly WORK_INTRO). */
      copy: string
      /** Hero SVG sampled as the canvas target field, under public/assets/work/. */
      sourceUrl: string
      /** Optional light-theme hero variant (white marks would vanish on light). */
      lightSourceUrl?: string
      /** Optional glyph-text override for the slide's field. */
      glyphText?: string
      /** Optional brand mark shown in the Work card header. */
      mark?: WorkBrandMark
      /** Optional color-distribution override (e.g. source-colors). */
      colorMode?: GlyphColorMode
    }
  | { kind: 'project'; story: WorkStory }

export const WORK_SLIDES: WorkSlide[] = [
  {
    kind: 'intro',
    id: 'microsoft',
    title: 'Microsoft',
    copy: 'Over nearly eight years at Microsoft, I had the privilege of helping shape the future of work by designing thoughtful experiences where people, business, and technology meet.',
    // The full-color Microsoft logo/wordmark SVG; the field takes the sampled
    // brand colors straight from the source.
    sourceUrl: '/assets/work/story-03.svg',
    lightSourceUrl: '/assets/work/story-03-light.svg',
    glyphText: 'culture eats strategy for breakfast ',
    mark: MICROSOFT_BRAND_MARK,
    colorMode: 'source-colors',
  },
  ...WORK_STORIES.map((story): WorkSlide => ({ kind: 'project', story })),
]

export const WORK_SLIDE_COUNT = WORK_SLIDES.length

/** Bounds-safe slide lookup — out-of-range indices fall back to the intro slide. */
export function getWorkSlide(index: number): WorkSlide {
  return WORK_SLIDES[index] ?? WORK_SLIDES[0]
}

/** Stable slide id (the story id for project slides) — analytics/diagnostics. */
export function getWorkSlideId(slide: WorkSlide): string {
  return slide.kind === 'project' ? slide.story.id : slide.id
}

/** Brand mark for either slide kind, or null when the slide has none. */
export function getWorkSlideMark(slide: WorkSlide): WorkBrandMark | null {
  return slide.kind === 'project' ? (slide.story.mark ?? null) : (slide.mark ?? null)
}

/** Slide display/document title (the story title for project slides). */
export function getWorkSlideTitle(slide: WorkSlide): string {
  return slide.kind === 'project' ? slide.story.title : slide.title
}

/**
 * Resolve the full scene descriptor for a story: the work scene's baseline
 * with the story's source, palette/background, and behavior merged on top.
 * The base descriptor is never mutated.
 */
export function resolveWorkScene(base: SceneDescriptor, story: WorkStory): SceneDescriptor {
  return {
    ...base,
    sourceUrl: story.sourceUrl,
    sourceKind: story.sourceKind ?? 'svg',
    playground: {
      ...base.playground,
      ...(story.glyphText ? { glyphText: story.glyphText } : {}),
      ...(story.palette ? { glyphPalette: story.palette } : {}),
      ...(story.background
        ? {
            backgroundColor1: story.background.color1,
            backgroundColor2: story.background.color2,
          }
        : {}),
      ...(story.colorMode ? { glyphColorMode: story.colorMode } : {}),
    },
    behavior: { ...base.behavior, ...story.behavior },
    sourceLayout: { ...base.sourceLayout },
    copy: { ...base.copy },
  }
}

/**
 * Resolve the full scene descriptor for either slide kind: project slides
 * resolve exactly like their story; the intro slide applies its own source
 * and color-mode override over the work baseline. The base descriptor is
 * never mutated.
 */
export function resolveWorkSlideScene(base: SceneDescriptor, slide: WorkSlide): SceneDescriptor {
  if (slide.kind === 'project') return resolveWorkScene(base, slide.story)
  return {
    ...base,
    sourceUrl: slide.sourceUrl,
    sourceKind: 'svg',
    playground: {
      ...base.playground,
      ...(slide.glyphText ? { glyphText: slide.glyphText } : {}),
      ...(slide.colorMode ? { glyphColorMode: slide.colorMode } : {}),
    },
    behavior: { ...base.behavior },
    sourceLayout: { ...base.sourceLayout },
    copy: { ...base.copy },
  }
}
