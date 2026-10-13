'use client'

import type { ComicPullListData } from './useComicPullList'
import styles from '../../app/about/about.module.css'

const formatDate = (value: string) => new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles',
}).format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value))
const formatTimestamp = (value: string) => new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short', timeZone: 'America/Los_Angeles',
}).format(new Date(value))

export default function ComicPullListStatus({ data: { snapshot, state, upcoming } }: { data: ComicPullListData }) {
  return <div className={styles.pullList}>
    <div className={styles.pullListMeta} aria-live="polite">
      <p><strong>{upcoming ? 'Upcoming Wednesday' : 'Saved pull list'}</strong><br /><time dateTime={snapshot.releaseDate}>{formatDate(snapshot.releaseDate)}</time> · {snapshot.comics.length} {snapshot.comics.length === 1 ? 'book' : 'books'}</p>
      <p>{snapshot.username} · League of Comic Geeks<br />{snapshot.fetchedAt ? <>Refreshed <time dateTime={snapshot.fetchedAt}>{formatTimestamp(snapshot.fetchedAt)}</time></> : 'Saved pull-list snapshot'}</p>
    </div>
    {state === 'unavailable' && <p className={styles.status}>The latest list is unavailable. Showing the saved pull list.</p>}
    {state === 'fresh' && snapshot.fetchedAt && Date.now() - Date.parse(snapshot.fetchedAt) > 48 * 60 * 60 * 1000 && <p className={styles.status}>Showing the last successful refresh.</p>}
  </div>
}
