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
  /** Optional action link rendered on the lightbox caption line (e.g. open a
   *  captured composition back in the playground). */
  captionAction?: { href: string; label: string }
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
  /** Optional action link rendered on the lightbox caption line. */
  captionAction?: { href: string; label: string }
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
  /** Optional additional outcome narrative, rendered after `outcome` in the
   *  case study's opening Outcome section. */
  outcomeParagraphs?: string[]
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
      'Operating Microsoft’s global campus requires teams to onboard, understand, and manage complex building environments at scale. I helped design agentic onboarding, mapping, and insight tools that gave teams better visibility into their spaces, streamlined operations, and enabled faster, more informed decisions.',
    role: 'Lead designer',
    context:
      'Microsoft · cross-functional team across design, product management, research, and engineering · 2025–2026',
    outcome:
      'Two agent-integrated operational dashboards that synthesized information spread across 48+ Power BI dashboards and SharePoint folders — and a foundation for an operational ecosystem of tools serving teams domestically and internationally.',
    links: [
      {
        label: 'Realcomm IBcon 2026 Digie award winners announcement',
        url: 'https://realcomm.com/news/1224/1/realcomm-ibcon-2026-digie-award-winners-announced',
      },
    ],
    access: 'public',
    mark: MICROSOFT_BRAND_MARK,
    details: [
      {
        heading: 'The challenge',
        paragraphs: [
          'A Microsoft campus runs on millions of devices and assets, and it never sits still. Hundreds of thousands of alarms and faults ring across those assets each year — hundreds per hour — while new devices are onboarded daily into a variety of building management systems, each with its own variables and inconsistent naming conventions. The vendor operations teams responsible for responding are only 8–12 people with tight budgets and alarm-dependent response times, and the signals they needed were scattered across 48+ Power BI dashboards and SharePoint folders.',
          'Each of these user groups needed an interface that turns scattered data points and metrics into day-to-day operational insight:',
        ],
        items: [
          'Building operations teams — vendor teams onboarding and managing buildings and assets, and monitoring and acting on faults and alarms. Served by Building Orchestrator.',
          'Lobby hosts — supporting employees and visitors with smooth transitions in and out of buildings, clear wayfinding, and reporting on work orders, facilities requests, construction projects, and room comfort. Served by Live Campus.',
          'Facility managers — owning consistent, disruption-free operations for individual buildings across temperature, facilities, services, projects, and events. Served by Live Campus.',
          'District facility managers — owning campus health: operational cost and capital expenditure across multiple buildings. Served by Live Campus.',
        ],
      },
      {
        heading: 'The approach',
        paragraphs: [
          'Deep user learning anchored everything: multiple rounds of workshops, qualitative research interviews, and feedback sessions to understand the key jobs to be done by each user group. That learning led deeper into the operational stack — buildings, devices, assets, faults, alarms, facilities requests, work orders, preventative maintenance — and into architectural models and interactive prototypes that the team validated and refined through repeated research cycles.',
          'The result was two products on one operational stack: Building Orchestrator for operations teams, and Live Campus for lobby hosts and facility managers — on a shared architecture that keeps the door open to a broader ecosystem of operational tooling.',
        ],
      },
      {
        heading: 'My contributions',
        items: [
          'Building Orchestrator UX, strategy, and conference keynote — work that contributed to Microsoft earning the 2026 Digie award for "Most Intelligent Corporate Headquarters".',
          'Live Campus UX and strategy.',
          'Shared architecture supporting the option of broad ecosystem development across operational tooling.',
        ],
        mediaIds: ['realcomm-keynote'],
      },
    ],
    media: [
      {
        kind: 'video',
        id: 'realcomm-keynote',
        src: '/assets/work/RealComm-Keynote.mp4',
        width: 1920,
        height: 1080,
        alt: 'Excerpt from the Realcomm conference keynote “Microsoft’s AI Frontier Transformation” — a speaker on stage with the keynote title slide behind him.',
        caption: 'An excerpt from Microsoft’s RealComm 2026 Keynote presentation, which I supported by developing slide content while collaborating on the strategic story and vision. This work led to Microsoft winning the 2026 Digie award for "Most Intelligent Corporate Headquarters".',
        poster: '/assets/work/RealComm-Keynote-poster.jpg',
        // TODO: replace with the excerpt's spoken transcript before launch.
        transcript: 'Transcript for this excerpt is being prepared.',
      },
    ],
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
    id: 'microsoft-employee-experience',
    title: 'Employee Experience',
    role: 'Junior to Senior Designer',
    context: 'Microsoft · cross-functional team across design, product management, research, and engineering · 2019–2026',
    thesis: 'Supporting Microsoft’s global workforce requires an ecosystem spanning everything from personal finance and compensation to security, facilities, and workplace services. Across two technology platforms, I helped reduce fragmentation and shape their respective design systems, making employee experiences easier to use and more consistent at enterprise scale.',
    outcome: 'I helped Microsoft move toward a more unified employee-experience ecosystem by aligning teams around shared patterns, reusable components, and a standardized design process.',
    outcomeParagraphs: [
      'As employee services transitioned from MyHub to Microsoft Viva Connections, our team created the EX Toolkit — a common design language and component library that reduced variation and duplicated implementation across teams, made platform capabilities and constraints clearer to developers, streamlined partner onboarding, and improved consistency across compensation, benefits, workplace services, and daily employee tasks.',
      'This work supported an employee platform deployed globally at Microsoft, established practices shared with other product teams and external customers, and contributed to the broader evolution from fragmented employee tools toward a centralized Viva experience. Microsoft later reported usage above 97% among employees across the Viva suite — a company-wide figure from Microsoft’s later Viva context, reflecting the work of many teams rather than a result attributable to this design work alone.',
    ],
    links: [
      { label: 'Microsoft MyHub', url: 'https://apps.apple.com/us/app/microsoft-myhub/id1476326475' },
      { label: 'Microsoft Viva Connections', url: 'https://www.microsoft.com/en-us/microsoft-viva/connections' },
      { label: 'The People Powered Workplace — an Employee Experience Platform analysis', url: 'https://pulse.microsoft.com/wp-content/uploads/2023/11/Microsoft-Viva-Ebook.pdf' },
      { label: 'Accelerating our cultural transformation at Microsoft with Viva and AI — Microsoft Inside Track', url: 'https://www.microsoft.com/insidetrack/blog/accelerating-our-cultural-transformation-at-microsoft-with-viva-and-ai/' },
      { label: 'Deploying Microsoft Viva Connections internally at Microsoft — Microsoft Inside Track', url: 'https://www.microsoft.com/insidetrack/blog/deploying-microsoft-viva-connections-internally-at-microsoft/' },
    ],
    access: 'public',
    sourceUrl: '/assets/work/MyHubTest.png',
    sourceKind: 'raster',
    colorMode: 'source-colors',
    mark: MICROSOFT_BRAND_MARK,
    glyphText: 'Defragmenting the Employee Experience ',
    media: [
      {
        kind: 'image',
        id: 'myhub-viva',
        src: '/assets/work/EmployeeExperience-MyHub+Viva.png',
        width: 899,
        height: 963,
        alt: 'Two iPhone screens: the MyHub dashboard with tiles for booking a space, booking a connector, dining, maintenance, parking, and directions, alongside the Microsoft Viva Connections dashboard with paystub, holiday, and on-site cards.',
        caption: 'MyHub and Viva Connections — the employee-experience platforms this work spanned.',
      },
      {
        kind: 'image',
        id: 'viva-connections-dashboard',
        src: '/assets/work/EmployeeExperience-VivaConnections-Dashboard.png',
        width: 1500,
        height: 884,
        alt: 'Microsoft Viva Connections dashboard for a Microsoft employee, with cards for Viva Learning, Paystub, Stock awards, Perks+, Perspectives, Holiday, Cafe, Facility request, Digital TechLink, Feedback, and Viva Topics, alongside a company news feed.',
        caption: 'Microsoft’s internal Viva Connections dashboard as published by Microsoft Inside Track — cards for pay, stock awards, facilities requests, tech support, and workplace services this design work supported.',
      },
      {
        kind: 'image',
        id: 'viva-connections',
        src: '/assets/work/EmployeeExperience-VivaConnections.jpg',
        width: 1600,
        height: 900,
        alt: 'Microsoft Viva Connections home dashboard inside Teams, showing a news carousel, a greeting, and dashboard cards for Tasks, Viva Learning, Events, and Copilot.',
        caption: 'Microsoft’s published Viva Connections dashboard in Teams — the current public product surface that grew out of the employee-experience platform this design work contributed to.',
      },
    ],
    details: [
      { heading: 'The challenge', paragraphs: [
        'Employee experience at Microsoft’s scale was never a single product — it was an interconnected ecosystem of services owned by many different business groups. From pay, stock, and retirement benefits to commuter transportation, workplace reporting, and facilities support, employees expected a clear and consistent experience even when the systems behind it were highly distributed.',
        'The challenge was to make those organizational boundaries less visible: defragmenting journeys, aligning interaction patterns, and coordinating teams around a more coherent employee experience, while helping employees complete tasks efficiently and return to the work at hand.',
      ], mediaIds: ['myhub-viva'] },
      { heading: 'The approach', paragraphs: [
        'Every engagement was shaped by the needs of the business, project goals, and stakeholders involved, while defragmentation and user efficiency remained foundational priorities. Once we aligned on the problem, desired outcomes, and key constraints, we used the Double Diamond as a flexible framework for discovery, definition, development, and delivery.',
        'Research guided each iteration — first helping us understand challenges in the existing experience, and later evaluating prototypes or working solutions to identify remaining friction and opportunities. We used those insights to refine the experience, validate decisions, and repeat the process until we had addressed both employee needs and business objectives.',
      ] },
      { heading: 'My contributions, 2019–2024', paragraphs: [
        'I joined this team as a junior designer and grew into a senior designer role over the course of the work, taking on broader ownership across the ecosystem. The engagements spanned:',
      ], items: [
        'Compensation clarity: the stock experience and pay preview.',
        'Commute and mobility: shuttles and Connectors (private buses).',
        'Workplace services: facilities requests, the lobby experience, and Security’s Report It Now.',
        'Return-to-work implementation and tracking.',
        'Ecosystem alignment and transitions between platforms, including MyHub to Viva Connections.',
        'Component toolkits for use across tools and business verticals — the through-line that became the EX Toolkit.',
      ], mediaIds: ['viva-connections-dashboard', 'viva-connections'] },
    ],
  },
  {
    id: 'microsoft-global-compensation',
    title: 'Global Compensation',
    thesis:
      'Fortune 500 companies like Microsoft offer complex compensation packages spanning cash, stock, and benefits. I helped create a platform that clearly explained total compensation and connected employees to available benefits, helping them maximize their earnings, improve satisfaction, and reduce unused benefits.',
    role: 'Lead Designer',
    context:
      'Microsoft · cross-functional team across design, product management, research, and engineering · 2021',
    outcome:
      'I drove the design of a first-party platform that Microsoft continues to use to communicate compensation and benefits, helping employees understand the full value of their package in an increasingly competitive market.',
    links: [
      {
        label: 'Helping Microsoft employees understand their value',
        url: 'https://www.microsoft.com/insidetrack/blog/helping-microsoft-employees-understand-their-value-with-the-total-rewards-portal/',
      },
    ],
    access: 'public',
    mark: MICROSOFT_BRAND_MARK,
    details: [
      {
        heading: 'The challenge',
        paragraphs: [
          'Microsoft brought its compensation portal in-house in 2021, moving from a third-party platform to a first-party one that Microsoft has since described as serving more than 220,000 users. What started as a simple lift-and-shift re-skin alongside my primary workload became a full redesign — and a six-month engagement grew to closer to twelve.',
          'The root problem was user understanding. The existing portal communicated the headlines — cash, stock, benefits — but once employees scratched below the surface, things fell apart. The clearest gaps were surfacing the total value of benefits and communicating stock awards, whose long-term value stayed ambiguous. Getting this right mattered: a platform that clearly explains total compensation helps employees maximize their earnings, improves satisfaction, and reduces unused benefits. Creating something new while aligning to expectations the old tool had set was a fine line to walk.',
        ],
      },
      {
        heading: 'The approach',
        paragraphs: [
          'Start with the user and go where their needs dictate. An introductory research study into how employees used the third-party tool surfaced clear needs for additional clarity. Follow-up studies tested design prototypes and pinned down the key gaps between the tool and employees’ understanding of their compensation and value.',
          'Those findings drove the pivotal decision: expanding the re-skin into a full redesign. Each research phase built on the last — understanding existing behavior, testing interpretations of the new platform, and refining toward a ship-ready design. Prototypes moved from low to high fidelity as confidence grew, with engineering involved early enough to keep the ambition buildable. The added scope served both the business and employees.',
        ],
        mediaIds: ['total-rewards'],
      },
      {
        heading: 'My contributions',
        paragraphs: [
          'The redesigned first-party platform shipped and remains the way Microsoft communicates compensation and benefits to its employees.',
        ],
        items: [
          'Platform redesign, owned end to end — from research synthesis and information architecture through interaction design and the shipped product.',
          'Coordination across product management, research, and engineering.',
          'The scope expansion itself: advocating for and shaping the pivot from re-skin to redesign in service of business and employee needs.',
        ],
        mediaIds: ['total-rewards-employee', 'total-rewards-manager'],
      },
    ],
    media: [
      {
        kind: 'image',
        id: 'total-rewards',
        src: '/assets/work/GlobalCompensation-TotalRewards.png',
        width: 1002,
        height: 566,
        alt: 'The Microsoft Total Rewards portal overview page, showing the employee’s total rewards figure with breakdown cards for cash, stock, and benefits.',
        caption: 'The Total Rewards portal — Microsoft’s first-party platform for communicating compensation and benefits.',
      },
      {
        kind: 'image',
        id: 'total-rewards-employee',
        src: '/assets/work/GlobalCompensation-TotalRewards-Employee.png',
        width: 1160,
        height: 877,
        alt: 'Total Rewards portal employee overview showing a total rewards figure of 225,000 USD broken into Cash, Stock, and Benefits cards, with a compensation history bar chart.',
        caption: 'The employee view of Microsoft’s Total Rewards portal as published by Microsoft Inside Track — a public product view reflecting the compensation platform this design work contributed to.',
      },
      {
        kind: 'image',
        id: 'total-rewards-manager',
        src: '/assets/work/GlobalCompensation-TotalRewards-Manager.png',
        width: 1379,
        height: 759,
        alt: 'Total Rewards portal manager Team dashboard showing direct-report snapshot cards and a searchable organization list with employee names and roles.',
        caption: 'The manager team-dashboard view of Microsoft’s Total Rewards portal as published by Microsoft Inside Track — a public product view reflecting the compensation platform this design work contributed to.',
      },
    ],
    sourceUrl: '/assets/work/Money.png',
    sourceKind: 'raster',
    colorMode: 'source-colors',
    glyphText: 'Employee Compensation and Benefits ',
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

/** How a slide's hero source is fitted into the canvas target region:
 *  'stage' contains the source inside the measured .work-glyph-stage bounds;
 *  'viewport' samples viewport-sized bounds centered on the stage (the wide
 *  Microsoft wordmark treatment); 'balanced' (the project-story default)
 *  interpolates halfway between the two — larger than stage fit, smaller
 *  than viewport fit, still centered on the stage. */
export type WorkHeroFit = 'viewport' | 'stage' | 'balanced'

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
      /** Hero fit override — defaults to 'balanced' like the project stories. */
      heroFit?: WorkHeroFit
    }
  | { kind: 'project'; story: WorkStory }

export const WORK_SLIDES: WorkSlide[] = [
  {
    kind: 'intro',
    id: 'microsoft',
    title: 'Microsoft',
    copy: 'Over nearly seven years at Microsoft, I had the privilege of helping shape the future of work by designing thoughtful experiences where people, business, and technology meet.',
    // The full-color Microsoft logo/wordmark SVG; the field takes the sampled
    // brand colors straight from the source.
    sourceUrl: '/assets/work/story-03.svg',
    lightSourceUrl: '/assets/work/story-03-light.svg',
    glyphText: 'culture eats strategy for breakfast ',
    mark: MICROSOFT_BRAND_MARK,
    colorMode: 'source-colors',
    // The wide wordmark keeps main's full-viewport sampling size (centered on
    // the stage); project stories stay contained in the stage bounds.
    heroFit: 'viewport',
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

/** Hero fit for either slide kind. Project stories always use 'balanced' so
 *  future case studies never inherit the oversized viewport treatment — only
 *  an intro slide may opt into 'viewport'. */
export function getWorkSlideHeroFit(slide: WorkSlide): WorkHeroFit {
  return slide.kind === 'intro' ? (slide.heroFit ?? 'balanced') : 'balanced'
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
