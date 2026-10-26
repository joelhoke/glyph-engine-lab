'use client'
import type { RefObject } from 'react'
import type { Garage, GarageState, VehicleLights } from './garageTypes'
import styles from './car-playground.module.css'
const views = [['hero','Quarter'],['front','Front'],['side','Driver side'],['passenger','Passenger side'],['rear','Rear'],['top','Top']] as const
const lights = [['accent','Accents'],['fog','Fog lights'],['tails','Tail lights'],['brakes','Brake lights'],['reverse','Reverse']] as const
export default function CarGalleryControls({ engine, state, reducedMotion }: {
  engine: RefObject<Garage | null>; state: GarageState; reducedMotion: boolean
}) {
  return <div className={styles.garageTools} data-gallery-ui>
    <div role="group" aria-label="Scene lighting" className={styles.garageToolRow}>
      <button type="button" aria-pressed={!state.night} onClick={() => engine.current?.setNight(false)}>Light</button>
      <button type="button" aria-pressed={!!state.night} onClick={() => engine.current?.setNight(true)}>Dark</button>
    </div>
    <details>
      <summary>Vehicle controls</summary>
      <p>Drag to rotate · Scroll or pinch to zoom</p>
      <fieldset disabled={state.busy}>
        <legend>View</legend>
        <div className={styles.garageToolRow}>{views.map(([id,label]) => <button type="button" key={id} onClick={() => engine.current?.setView(id)}>{label}</button>)}</div>
        <div className={styles.garageToolRow}>
          <button type="button" disabled={reducedMotion} aria-pressed={!!state.orbit} onClick={() => engine.current?.setOrbit(!state.orbit)}>Auto rotate</button>
          <button type="button" aria-pressed={!!state.wire} onClick={() => engine.current?.setWire(!state.wire)}>Wireframe</button>
        </div>
      </fieldset>
      {state.hasLights && <fieldset disabled={state.busy}>
        <legend>Vehicle lights</legend>
        <label>Headlights <select aria-label="Headlights" value={state.lamps?.beams ?? 'off'} onChange={event => engine.current?.setLights({beams:event.target.value as VehicleLights['beams']})}>
          <option value="off">Off</option><option value="low">Low beams</option><option value="high">High beams</option>
        </select></label>
        <label>Signals <select aria-label="Signals" value={state.lamps?.signals ?? 'off'} onChange={event => engine.current?.setLights({signals:event.target.value as VehicleLights['signals']})}>
          <option value="off">Off</option><option value="left">Left</option><option value="right">Right</option><option value="hazards">Hazards</option>
        </select></label>
        <div className={styles.garageToolRow}>{lights.map(([key,label]) => <button key={key} type="button" aria-pressed={!!state.lamps?.[key]} onClick={() => engine.current?.setLights({[key]:!state.lamps?.[key]})}>{label}</button>)}</div>
        <button type="button" onClick={() => engine.current?.setLights({beams:'off',signals:'off',fog:false,accent:false,tails:false,brakes:false,reverse:false})}>All lights off</button>
      </fieldset>}
    </details>
  </div>
}
