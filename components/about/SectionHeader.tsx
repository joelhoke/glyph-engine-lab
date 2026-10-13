import styles from '../../app/about/about.module.css'

export default function SectionHeader({ title, description }: { title: string; description?: string }) {
  return <header className={styles.sectionHeader}>
    <h1 id="interest-heading">{title}</h1>
    {description && <p>{description}</p>}
  </header>
}
