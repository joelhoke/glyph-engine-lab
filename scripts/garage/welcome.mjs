// Uses the canonical vehicle-lighting controller's 1.5 Hz signal cadence.
// One welcome per mounted Cars scene; revisiting a car does not restart it.
export function createGarageWelcome() {
  let played = false, remaining = 0, controller = null
  return {
    start(lighting, reduced) {
      controller = lighting
      remaining = lighting && !played && !reduced ? 5 / 1.5 : 0
      if (!lighting) return
      played = true
      lighting.setState({ beams: 'low', fog: true, accent: true, tails: true, signals: remaining ? 'hazards' : 'off' })
    },
    toggle() {
      if (!controller) return false
      remaining = 0
      const on = controller.getState().beams === 'off'
      controller.setState({ beams: on ? 'low' : 'off', fog: on, accent: on, tails: on, signals: 'off' })
      return on
    },
    setState(patch) { if (remaining > 0) controller?.setState({ signals: 'off' }); remaining = 0; controller?.setState(patch) },
    update(dt) {
      if (!controller) return
      if (remaining === 0) { if (controller.getState().signals !== 'off') controller.update(dt); return }
      // Stop before updating the phase into a sixth flash.
      if (remaining > 0) {
        remaining = Math.max(0, remaining - dt)
        if (remaining < 1e-8) { remaining = 0; controller.setState({ signals: 'off' }); controller.update(dt); return true }
      }
      controller.update(dt)
    },
    settle() { remaining = 0; controller?.setState({ signals: 'off' }) },
  }
}
