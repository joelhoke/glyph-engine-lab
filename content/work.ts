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

export type WorkStoryLink = {
  /** External URL (https). Plain <a href> — works in the static export. */
  url: string
  /** Visible, descriptive link label (never "click here"). */
  label: string
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
  /** Hero SVG sampled as the canvas target field, under public/assets/work/. */
  sourceUrl: string
  /** Optional per-story glyph palette override (hex colors). */
  palette?: string[]
  /** Optional per-story background gradient override. */
  background?: { color1: string; color2: string }
  /** Optional per-story color-distribution override (e.g. source-colors so the
   *  sampled brand colors paint the field instead of a palette). */
  colorMode?: GlyphColorMode
  /** Optional per-story simulation overrides (merged over the work scene). */
  behavior?: Partial<SceneDescriptor['behavior']>
}

/** Optional Work-mode introduction, shown under the mode heading. */
export const WORK_INTRO =
  'Over nearly eight years at Microsoft, I had the privilege of helping shape the future of work by designing thoughtful experiences where people, business, and technology meet.'

export const WORK_STORIES: WorkStory[] = [
  {
    id: 'microsoft-global-operations',
    title: 'Building Orchestrator & Live Campus',
    thesis:
      'Optimizing global campus operations through agentic building onboarding and mapping, paired with user-insight dashboards and agents.',
    role: 'Lead designer',
    context:
      'Microsoft · cross-functional team across design, product management, research, and engineering · 2025–2026',
    outcome:
      'Two agent-integrated operational dashboards that synthesized information spread across 48+ Power BI dashboards and SharePoint folders — and a foundation for an operational ecosystem of tools serving teams domestically and internationally.',
    links: [],
    access: 'public',
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
    // Microsoft story: the field takes the sampled brand colors (colored
    // squares, white wordmark) straight from the source SVG.
    sourceUrl: '/assets/work/story-03.svg',
    colorMode: 'source-colors',
    // This story's field reacts to the pointer a little more than the
    // work-mode baseline.
    behavior: { particleRepel: 0.3 },
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
 * Resolve the full scene descriptor for a story: the work scene's baseline
 * with the story's source, palette/background, and behavior merged on top.
 * The base descriptor is never mutated.
 */
export function resolveWorkScene(base: SceneDescriptor, story: WorkStory): SceneDescriptor {
  return {
    ...base,
    sourceUrl: story.sourceUrl,
    playground: {
      ...base.playground,
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
