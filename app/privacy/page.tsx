import type { Metadata } from 'next'
import LegalPage from '../../components/legal/LegalPage'

const description = 'How joelhoke.me handles analytics, playground creations, feedback, and conversations.'
export const metadata: Metadata = {
  title: 'Privacy — Joel Hoke', description,
  alternates: { canonical: '/privacy' },
  openGraph: { title: 'Privacy — Joel Hoke', description, url: '/privacy', images: ['/assets/og-1200x630.png'] },
}

export default function PrivacyPage() {
  return <LegalPage title="Privacy">
    <p>Updated September 21, 2026</p>
    <p>This is Joel Hoke’s portfolio and interactive playground. For privacy questions or a request to access, correct, or delete information you submitted, email <a href="mailto:create@joelhoke.me">create@joelhoke.me</a>. Include a receipt or creation link if you have one; please do not email passwords.</p>
    <h2>Browsing and local storage</h2>
    <p>Cloudflare hosts and protects this site. Delivering pages and preventing abuse involves technical information such as IP addresses, request details, and browser information. Short-lived, hashed request identifiers are used to limit repeated submissions. Access cookies keep protected work unlocked; browser storage remembers analytics choices and playground settings. Playground session storage lets you return to an unfinished composition in the same tab.</p>
    <h2>Optional analytics</h2>
    <p>Google Analytics loads only after you allow analytics, and only when it is configured for this site. It receives limited page and feature events, such as which experience you opened. Conversation text, feedback, uploaded filenames, and the contents of your creations are not included in those events. Google may process technical information and set analytics cookies.</p>
    <p>You can withdraw permission at any time: open the question-mark button on the homepage, choose Privacy, then “No thanks.” This stops further tracking and clears accessible Google Analytics cookies. Your choice is remembered for 180 days. Withdrawal does not undo data already sent.</p>
    <h2>Vibe creations and uploads</h2>
    <p>The playground processes images in your browser, but it is not private storage. Once a session has enough editing activity, it automatically saves a creation to the site. Image and clip exports can also save a creation. A save can include your composition settings and text, a preview, exported media, and the original uploaded image when it is within the upload limit. These files and settings are stored with Cloudflare so the piece can be reopened.</p>
    <p>New creations enter a review queue and may be selected for the public creations gallery. Unlisted does not mean confidential: someone with a creation or media link may be able to open it. The archive keeps up to 100 creations and removes older entries as new ones arrive; there is no fixed retention period. To request removal, contact Joel with the creation link or enough detail to identify it. Only upload material you are comfortable sharing and have permission to use.</p>
    <h2>The AI guide and shared conversations</h2>
    <p>Messages you send to the AI guide and recent conversation context go to the site’s server and the configured AI provider to generate a response. Provider routes can include OpenAI, DeepSeek, or Moonshot/Kimi, directly or through Cloudflare AI Gateway. Their processing and retention practices apply; please do not send sensitive or confidential information.</p>
    <p>The site keeps your active conversation in page memory rather than saving a transcript by default. If you explicitly choose to share a conversation with Joel, its transcript and optional reply email are stored separately from analytics. Shared transcripts expire after 180 days and are removed during cleanup. You can request earlier deletion using the receipt ID. Provider and infrastructure logs are separate from the site’s transcript store.</p>
    <h2>Feedback and contact</h2>
    <p>Feedback submissions contain your message and, if you supply one, a reply email. They are used to review your feedback and respond. Submissions expire after 180 days and are removed during cleanup. Contacting Joel by email also sends information through the email providers involved.</p>
    <h2>Why information is processed and your choices</h2>
    <p>Information is used to operate the experiences you request, display and moderate creations, answer messages, and protect the site. Optional analytics relies on your permission. Where data-protection law requires a lawful basis, service operation and security rely on legitimate interests, and requests you initiate are processed to provide those services. Joel does not sell submitted personal information.</p>
    <p>Service providers may process information outside your country. Depending on where you live, you may have rights to access, correction, deletion, restriction, objection, or a portable copy of your information, and to complain to your local data-protection authority. Contact Joel to exercise applicable rights or ask about a specific submission.</p>
    <p>External links take you to services with their own privacy policies. This notice will be updated when the site’s data handling changes.</p>
  </LegalPage>
}
