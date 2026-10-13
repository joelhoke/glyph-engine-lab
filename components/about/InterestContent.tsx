'use client'

import dynamic from 'next/dynamic'
import type { Interest } from '../../content/about'
import type { ComicPullListData } from './useComicPullList'
import SectionHeader from './SectionHeader'
import styles from '../../app/about/about.module.css'

const Family = dynamic(() => import('./FamilyStickers'), { ssr: false })
const Media = dynamic(() => import('./CreativeMedia'))
const Cars = dynamic(() => import('./CarsPlayground'))

export default function InterestContent({ item, comics, reducedMotion, active }: {
  item: Interest; comics: ComicPullListData; reducedMotion: boolean; active: boolean
}) {
  return <div className={styles.focusContent}><section id="interest-content" aria-labelledby="interest-heading" className={styles.contentPanel} inert={!active}>
    <SectionHeader title={item.title} />
    <div className={styles.sectionBody} key={item.id} data-fibre-space={item.id === 'comics' ? 'row' : ['family', 'automotive'].includes(item.id) ? 'hero' : undefined}>
      {item.id === 'family' ? <Family reducedMotion={reducedMotion} active={active} />
        : item.id === 'comics' ? <Media comics={comics} active={active} reducedMotion={reducedMotion} />
        : item.id === 'automotive' ? <Cars active={active} reducedMotion={reducedMotion} />
        : <div className={styles.visuallyHidden}><p>{item.placeholder}</p><span>Coming into focus.</span></div>}
    </div>
  </section></div>
}
