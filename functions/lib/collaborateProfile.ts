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
  | 'values'
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
    id: 'values-business-human',
    category: 'values',
    statement:
      'Joel believes business value and human value reinforce each other — the best products strengthen both rather than trading one off against the other. He treats curiosity as more valuable than certainty, and quality as the product of iteration, honest feedback, and shared ownership.',
    aliases: [
      'What does Joel value in product work?',
      'How does Joel balance business goals and user needs?',
      'What principles guide Joel’s work?',
    ],
    evidenceLabel: 'Approved profile — values',
    tags: ['values', 'business-value', 'human-value', 'principles'],
    canvasTopic: 'craft',
    sourceType: 'approved-profile',
    sensitivity: 'public',
    reviewDate: '2026-08-07',
  },
  {
    id: 'approach-decision-making',
    category: 'research',
    statement:
      'Joel believes research should reshape the problem, not simply validate a solution. When evaluating ideas he weighs four things together — business outcomes, human outcomes, technical feasibility, and long-term maintainability — and treats proposals that consider only one of them with skepticism.',
    aliases: [
      'How does Joel evaluate ideas?',
      'What role does research play in Joel’s decisions?',
      'How does Joel decide what to build?',
    ],
    evidenceLabel: 'Approved profile — decision making',
    tags: ['research', 'decision-making', 'feasibility', 'outcomes'],
    canvasTopic: 'craft',
    sourceType: 'approved-profile',
    sensitivity: 'public',
    reviewDate: '2026-08-07',
  },
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
    id: 'ai-philosophy',
    category: 'ai-product',
    statement:
      'Joel views AI as leverage rather than replacement: a thinking partner that enables broader exploration, faster prototyping, and deeper thinking. Human judgment stays responsible for synthesizing, prioritizing, and making final decisions.',
    aliases: [
      'How does Joel think about AI?',
      'Does Joel use AI in his process?',
      'What is Joel’s AI philosophy?',
    ],
    evidenceLabel: 'Approved profile — AI philosophy',
    tags: ['ai', 'philosophy', 'leverage', 'judgment'],
    canvasTopic: 'craft',
    sourceType: 'approved-profile',
    sensitivity: 'public',
    reviewDate: '2026-08-07',
  },
  {
    id: 'leadership-alignment',
    category: 'design-leadership',
    statement:
      'Joel leads by creating alignment. He measures leadership by influence and shared understanding rather than title or authority — he does not seek leadership for status, but steps into it when a project benefits from clear direction, aiming to elevate the team rather than become its center.',
    aliases: [
      'What is Joel’s leadership philosophy?',
      'How does Joel lead teams?',
      'Does Joel seek out leadership roles?',
    ],
    evidenceLabel: 'Approved profile — leadership philosophy',
    tags: ['leadership', 'alignment', 'influence', 'team'],
    canvasTopic: 'leadership',
    sourceType: 'approved-profile',
    sensitivity: 'public',
    reviewDate: '2026-08-07',
  },
  {
    id: 'collaboration-style',
    category: 'cross-functional',
    statement:
      'Joel prefers working with high trust, frequent feedback, and clear communication. He enjoys autonomy but values alignment just as highly, and he naturally bridges design, engineering, product, and business — helping each group understand the others without replacing their expertise.',
    aliases: [
      'What is it like to work with Joel?',
      'How does Joel communicate?',
      'How does Joel work across disciplines?',
    ],
    evidenceLabel: 'Approved profile — collaboration style',
    tags: ['collaboration', 'trust', 'feedback', 'communication'],
    canvasTopic: 'collaboration',
    sourceType: 'approved-profile',
    sensitivity: 'public',
    reviewDate: '2026-08-07',
  },
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
      'Joel is focused on senior and lead individual-contributor design roles and design-leadership opportunities — and he is ready for principal-level scope. He is confident in the work he does as a senior contributor and wants the harder problems and wider responsibilities that come with principal roles. The collaborations that energize him most pair curiosity with real constraints: problems still a little undefined, where the team gets to figure out what the thing wants to be.',
    aliases: [
      'What kind of role and team brings out Joel’s best work?',
      'What is Joel looking for?',
      'Is Joel open to new roles?',
      'Is Joel ready for a principal role?',
    ],
    evidenceLabel: 'Approved profile — career interests',
    tags: ['career', 'senior-ic', 'lead', 'principal', 'design-leadership'],
    canvasTopic: 'career-fit',
    sourceType: 'approved-profile',
    sensitivity: 'public',
    reviewDate: '2026-08-10',
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
    id: 'small-business-enablement',
    category: 'entrepreneurial',
    statement:
      'Joel is glad to talk with small and local businesses about solving real business problems with software — operational and process problems like scheduling, customer coordination, and the daily friction that software can smooth out. His interest is in enabling the business to do more for itself, not in creating dependency, and he is excited to explore whether a collaboration makes sense. Terms are flexible and always a direct conversation with Joel — compensation is negotiable and not always cash-based, especially where Joel is a customer or advocate of the business.',
    aliases: [
      'Can Joel help a small business?',
      'Does Joel build software for local businesses?',
      'Would Joel help with scheduling or customer coordination tools?',
    ],
    evidenceLabel: 'Approved profile — small business collaborations',
    tags: ['small-business', 'consulting', 'operations', 'enablement'],
    canvasTopic: 'entrepreneurial-fit',
    sourceType: 'approved-profile',
    sensitivity: 'public',
    reviewDate: '2026-08-10',
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

  // -- Colleague feedback themes (approved abstracts) ------------------------------
  // Synthesized from anonymized Microsoft Connect reviews + peer notes (2020–
  // 2026). Themes, not quotes: no names, teams, codenames, tools, metrics, or
  // locations. Each line reviewed and approved by Joel, 2026-08-10.
  {
    id: 'feedback-thought-partner-ambiguity',
    category: 'ambiguity',
    statement:
      'Feedback from Joel’s Microsoft colleagues consistently highlights his ability to walk into ambiguous, loosely defined problem spaces and quickly become a useful thought partner. Reviewers repeatedly describe him asking the kind of questions that make a room pause and re-examine assumptions it had stopped noticing, then helping reframe the work into something grounded and actionable. Peers note that he picks up new domains fast and brings an outside-in perspective that surfaces gaps early rather than late — a pattern across his entire Microsoft tenure.',
    aliases: [
      'How does Joel handle ambiguous problem spaces?',
      'What do coworkers say about working with Joel?',
      'Is Joel good at bringing clarity to messy problems?',
    ],
    evidenceLabel: 'Approved abstract — colleague feedback',
    tags: ['ambiguity', 'thought-partnership', 'peer-feedback', 'clarity'],
    canvasTopic: 'leadership',
    sourceType: 'approved-profile',
    sensitivity: 'approved-abstract',
    reviewDate: '2026-08-10',
  },
  {
    id: 'feedback-systems-thinking-scale',
    category: 'systems-thinking',
    statement:
      'Reviewers across Joel’s Microsoft tenure highlight that he designs beyond the immediate problem: colleagues cite his instinct for reuse, scalability, and how one solution can extend across teams, platforms, and products. Managers and peers credit him with elevating one-off workstreams into shared toolkits, patterns, and frameworks that outlasted the original project, and with connecting work happening in different corners of the organization before others notice the overlap.',
    aliases: [
      'Does Joel think in systems or just screens?',
      'How does Joel approach design systems and reuse?',
      'What is Joel’s design philosophy around scale?',
    ],
    evidenceLabel: 'Approved abstract — colleague feedback',
    tags: ['systems-thinking', 'scalability', 'design-systems', 'ecosystems'],
    canvasTopic: 'craft',
    sourceType: 'approved-profile',
    sensitivity: 'approved-abstract',
    reviewDate: '2026-08-10',
  },
  {
    id: 'feedback-cross-functional-trust',
    category: 'cross-functional',
    statement:
      'Feedback from Joel’s Microsoft colleagues consistently cites the trust he builds across disciplines. Engineering and product partners describe him as approachable, reliable, and unusually willing to meet them where they are — at one point working directly inside the engineering platform rather than only handing off artifacts, so the team could move from abstract ideas to something real. Reviewers note that he grounds design conversations in implementation realities and end-user needs, which partners say improves the quality of shared decision-making.',
    aliases: [
      'How does Joel work with engineers and PMs?',
      'Do cross-functional partners trust Joel?',
      'How technical is Joel as a designer?',
    ],
    evidenceLabel: 'Approved abstract — colleague feedback',
    tags: ['cross-functional', 'engineering-partnership', 'trust', 'collaboration'],
    canvasTopic: 'collaboration',
    sourceType: 'approved-profile',
    sensitivity: 'approved-abstract',
    reviewDate: '2026-08-10',
  },
  {
    id: 'feedback-leadership-without-authority',
    category: 'design-leadership',
    statement:
      'Colleagues across Joel’s Microsoft tenure describe a leadership style built on inclusion rather than authority: peers praise a "no one left behind" approach that makes sure every voice in the room is heard and brings out others’ best work. Reviewers cite him founding and running recurring forums for sharing work and feedback, mentoring interns and onboarding new teammates, and coordinating peer mentorship programs — all alongside his individual-contributor responsibilities. Managers note that teams look to him as a leader in the room even when leadership isn’t in his job description, and that his positivity and humor materially shape team culture and morale.',
    aliases: [
      'What is Joel’s leadership style?',
      'Has Joel led teams without being a manager?',
      'Does Joel mentor other designers?',
    ],
    evidenceLabel: 'Approved abstract — colleague feedback',
    tags: ['design-leadership', 'mentorship', 'facilitation', 'culture'],
    canvasTopic: 'leadership',
    sourceType: 'approved-profile',
    sensitivity: 'approved-abstract',
    reviewDate: '2026-08-10',
  },
  {
    id: 'feedback-handling-disagreement',
    category: 'conflict',
    statement:
      'Feedback from Joel’s Microsoft colleagues shows he handles disagreement directly but without ego. Peers say they trust him for an honest, informed opinion even when it isn’t the easy one, and managers describe him as assertive and decisive in crucial conversations without becoming combative — advocating for users and design quality while keeping relationships intact. In one instance a partner specifically thanked him for taking the initiative to repair a strained working relationship. Reviewers frame his candor as discussion-fostering rather than debate-provoking: he asks uncomfortable questions in a way that moves the work forward.',
    aliases: [
      'How does Joel handle disagreement or pushback?',
      'Does Joel avoid conflict or address it?',
      'Can Joel be assertive without damaging relationships?',
    ],
    evidenceLabel: 'Approved abstract — colleague feedback',
    tags: ['conflict', 'candor', 'disagreement', 'honesty'],
    canvasTopic: 'collaboration',
    sourceType: 'approved-profile',
    sensitivity: 'approved-abstract',
    reviewDate: '2026-08-10',
  },
  {
    id: 'feedback-ai-fluency-teaching',
    category: 'ai-product',
    statement:
      'In the later years of his Microsoft tenure, reviewers highlight Joel as one of the designers who helped his organization become fluent in AI product work — designing conversational and agent-driven employee experiences, pressure-testing where the technology is strong and where it falls short, and advocating for users within its constraints. Peers especially credit him with creating hands-on learning sessions that made agentic AI approachable for other designers, changing how colleagues actually work rather than just informing them, and with prototyping with the newest tools early and feeding those learnings back into shared frameworks and playbooks.',
    aliases: [
      'What is Joel’s experience designing AI products?',
      'Does Joel help others learn AI tools?',
      'How hands-on is Joel with AI product design?',
    ],
    evidenceLabel: 'Approved abstract — colleague feedback',
    tags: ['ai-product', 'agentic-ux', 'enablement', 'upskilling'],
    canvasTopic: 'craft',
    sourceType: 'approved-profile',
    sensitivity: 'approved-abstract',
    reviewDate: '2026-08-10',
  },
  {
    id: 'feedback-growth-arc',
    category: 'career-interests',
    statement:
      'Across Joel’s Microsoft reviews a clear growth arc is visible: earlier coaching asked him to put a stake in the ground sooner, sharpen his storytelling, and own workstreams end-to-end — and later reviews explicitly name each of those as strengths he now demonstrates. Colleagues watching that trajectory describe someone who converts feedback into visible growth, which is part of why they trust him with larger, more ambiguous scopes over time.',
    aliases: [
      'How has Joel grown as a designer?',
      'How does Joel respond to feedback?',
      'What is Joel’s career trajectory?',
    ],
    evidenceLabel: 'Approved abstract — colleague feedback',
    tags: ['growth', 'trajectory', 'feedback', 'career'],
    canvasTopic: 'career-fit',
    sourceType: 'approved-profile',
    sensitivity: 'approved-abstract',
    reviewDate: '2026-08-10',
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
