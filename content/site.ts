import { COLLABORATE_CONTACT } from './collaborate'

/**
 * Site-level recruiter links for the persistent header (and the phone
 * footer bar). Phase 0 placeholders still owed before launch:
 * - RESUME: replace the placeholder public/resume.pdf with the final file.
 * - LINKEDIN: confirm the profile URL below.
 */
export const RECRUITER_LINKS = {
  resume: { url: '/resume.pdf', label: 'Résumé' },
  // TODO: confirm — guessed from the handle pattern, never verified.
  linkedin: { url: 'https://www.linkedin.com/in/joelhoke/', label: 'LinkedIn' },
  email: { url: COLLABORATE_CONTACT.mailtoUrl, label: 'Email' },
} as const
