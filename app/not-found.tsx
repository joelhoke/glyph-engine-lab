import LegalPage from '../components/legal/LegalPage'

export default function NotFound() {
  return <LegalPage title="That page wandered off.">
    <p>The link may have changed, or the page may no longer be available.</p>
    <p><a href="/">Back to the homepage</a> or <a href="/gallery">browse the gallery</a>.</p>
  </LegalPage>
}
