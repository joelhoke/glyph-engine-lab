// =============================================================================
// Collaborate AI guide — approved knowledge pack (V1).
//
// Every fact and perspective the guide may speak from lives here as a reviewed
// ProfileEntry. The model receives ONLY this pack (plus bounded conversation
// history) on each turn; anything not in the pack must be abstained from and
// handed off to Joel directly. There is no fine-tuning and no retrieval over
// unreviewed source documents — the corpus is small enough to send whole.
//
// Content status: entries are seeded from material Joel has already published
// on the public portfolio (content/work.ts, content/collaborate.ts). Entries
// marked sourceType 'approved-profile' are viewpoints phrased for the guide
// from that same published material. The structured-interview import phase
// (see docs) will expand IC-craft, leadership, entrepreneurial, and logistics
// coverage; until then, thin areas are intentional and the guide must abstain.
//
// Sensitivity rule: `public` entries restate published portfolio material.
// `approved-abstract` entries are anonymized abstractions from protected work,
// approved line by line. No protected-project detail may ever enter this file —
// anything model-addressable is treated as public.
// =============================================================================

/** Canvas topics shared with the backend structured output and the client-side
 *  canvas-treatment map. The model must choose exactly one per answer. */
export const COLLABORATE_TOPICS = [
  'craft',
  'leadership',
  'collaboration',
  'career-fit',
  'entrepreneurial-fit',
  'logistics',
  'unknown',
] as const

export type CollaborateTopic = (typeof COLLABORATE_TOPICS)[number]

export type ProfileCategory =
  | 'ic-craft'
  | 'design-leadership'
  | 'ambiguity'
  | 'research'
  | 'systems-thinking'
  | 'ai-product'
  | 'cross-functional'
  | 'conflict'
  | 'career-interests'
  | 'entrepreneurial'
  | 'logistics'

export type ProfileSourceType =
  /** Restates published portfolio material; evidence links to the Work story. */
  | 'portfolio'
  /** Interview-derived or curated viewpoint; evidence shows a labeled
   *  approved-profile excerpt (no URL). */
  | 'approved-profile'

export type ProfileSensitivity =
  /** Published portfolio material. */
  | 'public'
  /** Anonymized, line-by-line-approved abstraction from protected work. */
  | 'approved-abstract'

export type ProfileEntry = {
  /** Stable, unique identifier — referenced by model sourceIds and evals. */
  id: string
  category: ProfileCategory
  /** The approved statement, exactly as the guide may assert it. Third person. */
  statement: string
  /** Example phrasings of questions this entry answers — prompt grounding only. */
  aliases: string[]
  /** Short label shown on the source card returned to the visitor. */
  evidenceLabel: string
  /** Portfolio entries link directly to the relevant Work story deep link. */
  evidenceUrl?: string
  tags: string[]
  /** The authored canvas treatment keyed by this entry's answer topic. */
  canvasTopic: CollaborateTopic
  sourceType: ProfileSourceType
  sensitivity: ProfileSensitivity
  /** ISO date (YYYY-MM-DD) the statement was reviewed and approved. */
  reviewDate: string
  /** Optional ISO date after which the entry must no longer be used. */
  expiryDate?: string
}

export const PROFILE_ENTRIES: ProfileEntry[] = [
  // -- IC craft / portfolio facts -------------------------------------------------
  {
    id: 'msft-employee-experience',
    category: 'ic-craft',
    statement:
      'From 2019 to 2026 Joel worked at Microsoft on employee experience, growing from junior to senior designer. He helped move a fragmented set of internal tools toward a unified ecosystem — aligning teams around shared patterns, reusable components, and a standardized design process — including the EX Toolkit, a common design language and component library. Microsoft later reported usage above 97% among employees across the Viva suite.',
    aliases: [
      'What did Joel do at Microsoft?',
      'What is Joel’s experience with design systems?',
      'Tell me about Joel’s employee experience work.',
    ],
    evidenceLabel: 'Work — Microsoft Employee Experience',
    evidenceUrl: '#work/microsoft-employee-experience',
    tags: ['microsoft', 'design-systems', 'employee-experience', 'components'],
    canvasTopic: 'craft',
    sourceType: 'portfolio',
    sensitivity: 'public',
    reviewDate: '2026-08-03',
  },
  {
    id: 'msft-global-operations',
    category: 'ic-craft',
    statement:
      'As lead designer for Microsoft’s Global Operations work (2025–2026), Joel designed two agent-integrated operational dashboards — Building Orchestrator and Live Campus — that synthesized information spread across 48+ Power BI dashboards and SharePoint folders. His Building Orchestrator UX, strategy, and conference keynote contributed to Microsoft earning the 2026 Digie award for "Most Intelligent Corporate Headquarters".',
    aliases: [
      'What is Joel’s most recent work?',
      'Has Joel designed dashboards or data-heavy tools?',
      'What has Joel shipped as a lead designer?',
    ],
    evidenceLabel: 'Work — Global Operations',
    evidenceUrl: '#work/microsoft-global-operations',
    tags: ['microsoft', 'dashboards', 'lead-designer', 'operations', 'award'],
    canvasTopic: 'craft',
    sourceType: 'portfolio',
    sensitivity: 'public',
    reviewDate: '2026-08-03',
  },
  {
    id: 'ai-product-work',
    category: 'ai-product',
    statement:
      'Joel has designed AI-enabled products hands-on: agentic building onboarding and mapping, and dashboards with integrated agents that help small operations teams triage hundreds of alarms and faults per hour across millions of devices and assets.',
    aliases: [
      'Has Joel worked on AI products?',
      'What is Joel’s experience with agents or agentic UX?',
      'Has Joel designed with AI?',
    ],
    evidenceLabel: 'Work — Global Operations',
    evidenceUrl: '#work/microsoft-global-operations',
    tags: ['ai', 'agents', 'agentic-ux', 'microsoft'],
    canvasTopic: 'craft',
    sourceType: 'portfolio',
    sensitivity: 'public',
    reviewDate: '2026-08-03',
  },

  // -- Approach / perspective ----------------------------------------------------
  {
    id: 'approach-ambiguity',
    category: 'ambiguity',
    statement:
      'Joel is most energized by problems that are still a little undefined — figuring out what the thing wants to be, not just decorating what it already is. In practice he starts with deep user learning: workshops, qualitative research interviews, and feedback sessions to understand the key jobs to be done, then develops architectural models and interactive prototypes, iterating research and design together.',
    aliases: [
      'How does Joel approach ambiguous product problems?',
      'How does Joel handle undefined problems?',
      'What is Joel’s process for messy problems?',
    ],
    evidenceLabel: 'Approved profile — working style',
    tags: ['ambiguity', 'process', 'research', 'prototyping'],
    canvasTopic: 'craft',
    sourceType: 'approved-profile',
    sensitivity: 'public',
    reviewDate: '2026-08-03',
  },
  {
    id: 'approach-process',
    category: 'research',
    statement:
      'Joel uses the Double Diamond as a flexible framework — discovery, definition, development, delivery — shaped to the needs of the business, the project goals, and the stakeholders involved. Research guides each iteration: first to understand the existing experience, later to evaluate prototypes and working solutions and identify remaining friction.',
    aliases: [
      'What design process does Joel use?',
      'How does Joel use research?',
      'How does Joel structure a project?',
    ],
    evidenceLabel: 'Work — Microsoft Employee Experience',
    evidenceUrl: '#work/microsoft-employee-experience',
    tags: ['process', 'double-diamond', 'research', 'iteration'],
    canvasTopic: 'craft',
    sourceType: 'portfolio',
    sensitivity: 'public',
    reviewDate: '2026-08-03',
  },
  {
    id: 'approach-systems',
    category: 'systems-thinking',
    statement:
      'Joel thinks in ecosystems rather than isolated screens: shared architecture that supports broad tooling development, common design languages, and component toolkits used across teams and business verticals — work aimed at reducing fragmentation and duplicated effort at organizational scale.',
    aliases: [
      'Does Joel do systems thinking?',
      'How does Joel handle design at scale?',
      'What is Joel’s experience with design systems and platforms?',
    ],
    evidenceLabel: 'Approved profile — systems work',
    tags: ['systems', 'ecosystem', 'platforms', 'scale'],
    canvasTopic: 'craft',
    sourceType: 'approved-profile',
    sensitivity: 'public',
    reviewDate: '2026-08-03',
  },

  // -- Leadership / collaboration --------------------------------------------------
  {
    id: 'leadership-craft',
    category: 'design-leadership',
    statement:
      'Joel has led as a hands-on lead designer: owning UX and strategy while staying in the craft himself — developing architectural models and interactive prototypes, presenting at conference level, and aligning cross-functional teams around shared patterns rather than directing from a distance.',
    aliases: [
      'How does Joel lead without losing the craft?',
      'Is Joel a hands-on leader?',
      'What is Joel’s leadership style?',
    ],
    evidenceLabel: 'Approved profile — leadership',
    tags: ['leadership', 'hands-on', 'strategy', 'lead-designer'],
    canvasTopic: 'leadership',
    sourceType: 'approved-profile',
    sensitivity: 'public',
    reviewDate: '2026-08-03',
  },
  {
    id: 'collaboration-cross-functional',
    category: 'cross-functional',
    statement:
      'Joel’s projects run cross-functionally across design, product management, research, and engineering. His toolkit and platform work explicitly made capabilities and constraints clearer to developers and streamlined partner onboarding — he treats alignment with engineering and product as part of the design work, not a handoff.',
    aliases: [
      'How does Joel work with engineers and PMs?',
      'Is Joel cross-functional?',
      'How does Joel collaborate?',
    ],
    evidenceLabel: 'Work — Microsoft Employee Experience',
    evidenceUrl: '#work/microsoft-employee-experience',
    tags: ['cross-functional', 'engineering', 'product', 'alignment'],
    canvasTopic: 'collaboration',
    sourceType: 'portfolio',
    sensitivity: 'public',
    reviewDate: '2026-08-03',
  },

  // -- Career fit ------------------------------------------------------------------
  {
    id: 'career-interests',
    category: 'career-interests',
    statement:
      'Joel is focused on senior and lead individual-contributor design roles and design-leadership opportunities — work where the problem is still a little undefined and the team gets to figure out what the thing wants to be. The collaborations that energize him most pair curiosity with real constraints.',
    aliases: [
      'What kind of role and team brings out Joel’s best work?',
      'What is Joel looking for?',
      'Is Joel open to new roles?',
    ],
    evidenceLabel: 'Approved profile — career interests',
    tags: ['career', 'senior-ic', 'lead', 'design-leadership'],
    canvasTopic: 'career-fit',
    sourceType: 'approved-profile',
    sensitivity: 'public',
    reviewDate: '2026-08-03',
  },

  // -- Entrepreneurial section (secondary path) -------------------------------------
  {
    id: 'entrepreneurial-interest',
    category: 'entrepreneurial',
    statement:
      'Alongside senior IC and design-leadership roles, Joel welcomes serious exploratory conversations about early-stage products, startups, advisory work, and new ventures — especially where the problem is still undefined and design can shape what the thing becomes. Whether any specific involvement makes sense is always a conversation with Joel directly.',
    aliases: [
      'Is Joel interested in startups?',
      'Would Joel advise an early-stage company?',
      'Is Joel open to founding or advisory conversations?',
    ],
    evidenceLabel: 'Approved profile — entrepreneurial interests',
    tags: ['startups', 'advisory', 'early-stage', 'ventures'],
    canvasTopic: 'entrepreneurial-fit',
    sourceType: 'approved-profile',
    sensitivity: 'public',
    reviewDate: '2026-08-03',
  },
  {
    id: 'entrepreneurial-boundaries',
    category: 'entrepreneurial',
    statement:
      'The guide cannot speak to Joel’s availability, compensation, equity, conflicts of interest, or any commitment to a role or venture. Those questions are exactly the kind Joel handles personally — the right move is to email him directly.',
    aliases: [
      'Is Joel available to join a startup?',
      'What equity would Joel want?',
      'Can Joel commit to advising us?',
    ],
    evidenceLabel: 'Approved profile — conversation boundaries',
    tags: ['boundaries', 'availability', 'equity', 'commitments'],
    canvasTopic: 'entrepreneurial-fit',
    sourceType: 'approved-profile',
    sensitivity: 'public',
    reviewDate: '2026-08-03',
  },

  // -- Logistics -------------------------------------------------------------------
  {
    id: 'logistics-contact',
    category: 'logistics',
    statement:
      'The best way to reach Joel is email: hello@joelhoke.me. Anything the guide cannot answer — compensation, equity, availability, contractual questions, confidential contexts, or anything time-sensitive — should go straight to him.',
    aliases: [
      'How do I contact Joel?',
      'What is Joel’s email?',
      'How do I follow up?',
    ],
    evidenceLabel: 'Approved profile — contact',
    tags: ['contact', 'email', 'logistics'],
    canvasTopic: 'logistics',
    sourceType: 'approved-profile',
    sensitivity: 'public',
    reviewDate: '2026-08-03',
  },
]

// -- Helpers ---------------------------------------------------------------------

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Structural validation of the pack itself — exercised by verify scripts. */
export function validateProfileEntries(entries: ProfileEntry[]): string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  for (const entry of entries) {
    if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(entry.id)) errors.push(`${entry.id}: bad id`)
    if (ids.has(entry.id)) errors.push(`${entry.id}: duplicate id`)
    ids.add(entry.id)
    if (!entry.statement.trim()) errors.push(`${entry.id}: empty statement`)
    if (entry.aliases.length === 0) errors.push(`${entry.id}: no aliases`)
    if (entry.aliases.some((a) => !a.trim())) errors.push(`${entry.id}: empty alias`)
    if (!entry.evidenceLabel.trim()) errors.push(`${entry.id}: empty evidence label`)
    if (entry.sourceType === 'portfolio' && !entry.evidenceUrl)
      errors.push(`${entry.id}: portfolio entry needs an evidence URL`)
    if (entry.evidenceUrl && !entry.evidenceUrl.startsWith('#work/'))
      errors.push(`${entry.id}: evidence URL must be a #work/<storyId> deep link`)
    if (!COLLABORATE_TOPICS.includes(entry.canvasTopic))
      errors.push(`${entry.id}: unknown canvas topic`)
    if (!ISO_DATE.test(entry.reviewDate)) errors.push(`${entry.id}: bad review date`)
    if (entry.expiryDate && !ISO_DATE.test(entry.expiryDate))
      errors.push(`${entry.id}: bad expiry date`)
  }
  return errors
}

/** Entries usable right now: not past their expiry date. `today` is YYYY-MM-DD. */
export function getActiveProfileEntries(today: string, entries: ProfileEntry[] = PROFILE_ENTRIES): ProfileEntry[] {
  return entries.filter((entry) => !entry.expiryDate || entry.expiryDate >= today)
}

export function getProfileEntry(id: string): ProfileEntry | null {
  return PROFILE_ENTRIES.find((entry) => entry.id === id) ?? null
}

/**
 * Serialize the active pack for the system prompt. Compact on purpose: the
 * whole pack travels with every turn, and the model must cite IDs verbatim.
 */
export function buildProfilePackPrompt(entries: ProfileEntry[]): string {
  const lines = entries.map((entry) => {
    const alias = entry.aliases.map((a) => `"${a}"`).join('; ')
    return `- id: ${entry.id} | topic: ${entry.canvasTopic} | ${entry.statement} | answers questions like: ${alias}`
  })
  return ['APPROVED PROFILE (the only facts and viewpoints you may use):', ...lines].join('\n')
}
