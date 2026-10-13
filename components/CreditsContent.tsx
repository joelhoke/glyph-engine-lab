import { MODEL_CREDITS, OTHER_CREDITS, PORTRAIT_CREDIT } from '../content/site'
export default function CreditsContent() {
  return <>
    <p className="consent-copy">Models, components and typefaces used across this site, with thanks to their creators.</p>
    <ul className="credits-list">
      {[...MODEL_CREDITS, ...OTHER_CREDITS].map(credit => <li key={credit.title}>
        {credit.sourceUrl ? <a href={credit.sourceUrl} target="_blank" rel="noopener noreferrer">{credit.title}</a> : credit.title}{' — '}
        {credit.authorUrl ? <a href={credit.authorUrl} target="_blank" rel="noopener noreferrer">{credit.author}</a> : credit.author}{' · '}
        {credit.licenseUrl ? <a href={credit.licenseUrl} target="_blank" rel="noopener noreferrer">{credit.licenseLabel ?? 'CC BY 4.0'}</a> : credit.licenseLabel}
        {' · '}{credit.usedFor}
        <div className="credits-modifications">{credit.modifications}</div>
      </li>)}
    </ul>
    <p className="consent-copy">{PORTRAIT_CREDIT}</p>
  </>
}
