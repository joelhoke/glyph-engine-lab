'use client'

import SceneCanvas from './SceneCanvas'
import Intro from './Intro'
import PrimaryActions, { ExperienceKey } from './PrimaryActions'
import { useState } from 'react'

export default function PortfolioExperience() {
  const [selected, setSelected] = useState<ExperienceKey | null>(null)

  const handleAction = (key: ExperienceKey) => {
    setSelected(key)
  }

  return (
    <div className="portfolio-shell">
      <SceneCanvas />
      <div className="foreground-layer" aria-live="polite">
        <div className="foreground-content">
          <Intro />
          <PrimaryActions selected={selected} onSelect={handleAction} />
        </div>
      </div>
    </div>
  )
}
