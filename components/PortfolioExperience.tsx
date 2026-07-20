'use client'

import SceneCanvas from './SceneCanvas'
import Intro from './Intro'
import PrimaryActions, { ExperienceKey } from './PrimaryActions'
import { useMemo, useState } from 'react'

const isTuningMode = () => {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('debug') === 'true'
}

export default function PortfolioExperience() {
  const [selected, setSelected] = useState<ExperienceKey | null>(null)
  const tuningMode = useMemo(() => isTuningMode(), [])

  const handleAction = (key: ExperienceKey) => {
    setSelected(key)
  }

  return (
    <div className="portfolio-shell">
      <SceneCanvas tuningMode={tuningMode} />
      {tuningMode && (
        <div className="foreground-layer" aria-live="polite">
          <div className="foreground-content">
            <Intro />
            <PrimaryActions selected={selected} onSelect={handleAction} />
          </div>
        </div>
      )}
    </div>
  )
}
