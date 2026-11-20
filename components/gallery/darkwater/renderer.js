import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { StudioRenderer } from './engine/studio/renderer.js'
import { LightCollection, RippleController, defaultSettings } from './engine/studio/state.js'
import { ShapeController, sizeForHold } from './engine/studio/shapes.js'
import { ModelLibrary } from './engine/studio/models.js'

// Release the original engine's render targets, materials and geometry once.
function disposeResources(root, seen = new Set()) {
  if (!root || typeof root !== 'object' || seen.has(root) || ArrayBuffer.isView(root)) return
  seen.add(root)
  if (root.isWebGLRenderer || root.isTexture && root.isRenderTargetTexture) return
  if (root.isWebGLRenderTarget || root.isBufferGeometry || root.isMaterial || root.isTexture) { root.dispose(); return }
  if (root instanceof Map) { for (const item of root.values()) disposeResources(item, seen); return }
  for (const value of Object.values(root)) disposeResources(value, seen)
}
export function createDarkWater(canvas, initial, fail, onShapes, record) {
  const context=canvas.getContext('webgl2',{alpha:false,antialias:false,powerPreference:'high-performance'})
  if(!context || !context.getExtension('EXT_color_buffer_float') || !context.getExtension('OES_texture_float_linear')) throw new Error('Floating point WebGL 2 required')
  const renderer=new THREE.WebGLRenderer({canvas,context,antialias:false})
  renderer.autoClear=false
  renderer.debug.onShaderError=()=>fail('The water shader could not start on this GPU. Reset to try again.')
  const camera=new THREE.PerspectiveCamera(48,1,.05,150)
  const controls=new OrbitControls(camera,canvas)
  controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=2;controls.maxDistance=30;controls.maxPolarAngle=Math.PI*.94
  const settings=defaultSettings(),lights=new LightCollection(),ripples=new RippleController(),shapes=new ShapeController(),models=new ModelLibrary()
  settings.causticQuality=256
  lights.preset('cross')
  const studio=new StudioRenderer(renderer,camera,settings,lights,ripples,shapes,models)
  let current = initial, view = '', disposed = false, gesture = null, version = 0
  const reportShapes = () => onShapes({
    items: shapes.bodies.map(({ id, kind }) => ({ id, kind })),
    selected: shapes.selectedId,
  })
  // Start at the waterline so the composition is visible with motion paused.
  for (const [kind, x, y, z, size] of [
    ['cube', -2.25, .53, .35, 1.45],
    ['sphere', .05, .49, 1.45, 1.38],
    ['pyramid', 1.7, .29, -.75, 1.5],
  ]) {
    const body = shapes.add(kind, { x, y: 0, z }, size)
    body.position.y = y
    body.entered = true
  }
  reportShapes()
  const indicator = document.createElement('div')
  indicator.setAttribute('aria-hidden', 'true')
  Object.assign(indicator.style, {
    position: 'absolute', pointerEvents: 'none', transform: 'translate(-50%, -50%)',
    background: 'rgba(255,255,255,.3)', border: '2px solid white', boxShadow: '0 0 0 1px #283341',
  })
  indicator.hidden = true
  canvas.parentElement.append(indicator)
  const ray=new THREE.Raycaster()
  function update(value){
    if (current.tool !== value.tool || current.view !== value.view || current.shape !== value.shape) cancel()
    current=value
    Object.assign(settings,{waveStrength:value.waves,speed:value.speed,exposure:value.exposure,bloom:value.bloom})
    lights.lights.forEach((light,i)=>{light.color=value.colors[i]||value.colors[0];light.intensity=value.intensity*(i?200:130)})
    studio.uniforms.uBackdrop.value.set(value.lightTheme ? '#c0ccd4' : '#0d1420')
    controls.enabled=value.tool==='orbit'
    if(view!==value.view){
      view=value.view
      controls.enableDamping=false
      if(view==='overhead'){camera.position.set(0,17,.01);controls.target.set(0,0,0)}
      else if(view==='underwater'){camera.position.set(0,-1.44,6);controls.target.set(0,-1.2,-1)}
      else{camera.position.set(4.3,4.2,7.6);controls.target.set(0,.12,0)}
      controls.update();controls.enableDamping=true
    }
    studio.dirty=true
  }
  let viewportWidth = 0, viewportHeight = 0
  function resize() {
    const bounds = canvas.getBoundingClientRect()
    const width = Math.max(1, Math.round(bounds.width))
    const height = Math.max(1, Math.round(bounds.height))
    // Reset reuses the canvas while creating fresh render targets and a camera.
    if (viewportWidth === width && viewportHeight === height) return
    renderer.setSize(width, height, false)
    studio.resize(width, height)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    viewportWidth = width
    viewportHeight = height
    studio.dirty = true
  }
  function pointerRay(event) {
    const bounds = canvas.getBoundingClientRect()
    ray.setFromCamera(new THREE.Vector2(
      (event.clientX - bounds.left) / bounds.width * 2 - 1,
      1 - (event.clientY - bounds.top) / bounds.height * 2,
    ), camera)
    return ray.ray.clone()
  }

  function recordShapeEdit(restore) {
    record(() => {
      if (disposed) return
      cancel()
      restore()
      // Discard GPU water samples that refer to the former bodies or positions.
      shapes.generation++
      shapes.lastQueryTime = -Infinity
      studio.dirty = true
      reportShapes()
    })
  }

  function editShapeList(edit) {
    // Keep the live bodies so undoing an edit preserves everyone else's motion.
    // The list also includes any oldest body displaced by a drop at capacity.
    const previous = shapes.bodies.slice()
    const selected = shapes.selectedId
    edit()
    if (previous.length === shapes.bodies.length && previous.every((body, i) => body === shapes.bodies[i])) return
    recordShapeEdit(() => {
      shapes.bodies = previous
      shapes.select(selected)
    })
    studio.dirty = true
    reportShapes()
  }

  function addShapeAt(point, size, kind = current.shape) {
    editShapeList(() => {
      const body = shapes.add(kind, point, size)
      // Static edits should be visible without opting in to animation.
      if (body && (settings.paused || settings.speed === 0)) body.position.y = point.y + size * .3
    })
  }

  async function disturb(event, dragging) {
    if (settings.paused || settings.speed === 0) return
    const generation = version
    const hit = await studio.pick(pointerRay(event), !dragging)
    if (disposed || !hit || generation !== version || settings.paused) return
    if (ripples.add(hit.x, hit.z, studio.time, current.radius, .28, dragging, { y: hit.y })) {
      if (!dragging) shapes.impulse(hit.x, hit.z, .28)
      studio.dirty = true
    }
  }

  async function grabShape(event, token) {
    const firstRay = pointerRay(event)
    const normal = camera.getWorldDirection(new THREE.Vector3())
    const hit = await studio.pick(firstRay, true, true)
    if (disposed || token.version !== version || !hit?.bodyId) return
    const formerSelection = shapes.selectedId
    const body = shapes.select(hit.bodyId)
    reportShapes()
    if (!body || (gesture !== token && !token.released)) return
    const distance = hit.clone().sub(firstRay.origin).dot(normal) / firstRay.direction.dot(normal)
    const anchor = firstRay.at(distance, new THREE.Vector3())
    shapes.beginMove(hit.bodyId, anchor, normal)
    token.rotation = body.rotation.clone()
    token.entered = body.entered
    token.formerSelection = formerSelection
    if (token.latest) shapes.move(token.latest, settings.floorDepth)
    if (token.released) finishMove(token)
    studio.dirty = true
  }

  function finishMove(token) {
    const session = shapes.moveSession
    if (!session) return
    const { body, position, velocity, angularVelocity } = session
    const moved = body.position.distanceToSquared(position) > 1e-8
    shapes.endMove(!moved)
    if (!moved) return
    recordShapeEdit(() => {
      body.position.copy(position)
      body.velocity.copy(velocity)
      body.angularVelocity.copy(angularVelocity)
      body.rotation.copy(token.rotation)
      body.entered = token.entered
      shapes.select(token.formerSelection)
    })
  }

  function down(event) {
    if (event.button !== 0 || gesture || current.tool === 'orbit') return
    if (current.tool === 'move') version++
    const token = { pointerId: event.pointerId, started: performance.now(), version, kind: current.shape }
    gesture = token
    canvas.setPointerCapture(event.pointerId)
    if (current.tool === 'move') grabShape(event, token).catch(() => {})
    if (current.tool === 'ripple') disturb(event, false).catch(() => {})
    if (current.tool === 'drop') {
      token.latest = pointerRay(event)
      positionIndicator(event)
      indicator.style.borderRadius = token.kind === 'sphere' ? '50%' : '0'
      indicator.style.clipPath = token.kind === 'pyramid' ? 'polygon(50% 0,100% 100%,0 100%)' : ''
      indicator.hidden = false
    }
  }

  function positionIndicator(event) {
    const bounds = canvas.getBoundingClientRect()
    indicator.style.left = `${event.clientX - bounds.left}px`
    indicator.style.top = `${event.clientY - bounds.top}px`
  }

  function move(event) {
    if (gesture?.pointerId !== event.pointerId) return
    const bounds = canvas.getBoundingClientRect()
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) return
    gesture.latest = pointerRay(event)
    if (current.tool === 'drop') positionIndicator(event)
    if (current.tool === 'move' && shapes.move(gesture.latest, settings.floorDepth)) studio.dirty = true
    if (current.tool === 'ripple') disturb(event, true).catch(() => {})
  }

  function up(event) {
    const token = gesture
    if (token?.pointerId !== event.pointerId) return
    move(event)
    gesture = null
    indicator.hidden = true
    if (current.tool === 'move') {
      token.released = true
      finishMove(token)
    }
    if (current.tool === 'drop') {
      const size = sizeForHold((performance.now() - token.started) / 1000)
      studio.pick(token.latest, true).then(hit => {
        if (!disposed && version === token.version && hit) addShapeAt(hit, size, token.kind)
      }).catch(() => {})
    }
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
  }

  function cancel() {
    if (gesture && canvas.hasPointerCapture(gesture.pointerId)) canvas.releasePointerCapture(gesture.pointerId)
    gesture = null
    indicator.hidden = true
    version++
    shapes.endMove(true)
  }

  const lostCapture = event => { if (gesture?.pointerId === event.pointerId) cancel() }
  const keydown = event => { if (event.key === 'Escape') cancel() }
  canvas.addEventListener('pointerdown', down)
  canvas.addEventListener('pointermove', move)
  canvas.addEventListener('pointerup', up)
  canvas.addEventListener('pointercancel', cancel)
  canvas.addEventListener('lostpointercapture', lostCapture)
  window.addEventListener('blur', cancel)
  window.addEventListener('keydown', keydown)
  update(initial)
  return {
    update,
    cancelPending: cancel,
    addShape() { cancel(); addShapeAt(controls.target.clone().setY(0), 1) },
    selectShape(id) { cancel(); shapes.select(id); reportShapes() },
    removeShape() { cancel(); if (shapes.selected) editShapeList(() => shapes.remove(shapes.selectedId)) },
    clearShapes() { cancel(); if (shapes.bodies.length) editShapeList(() => shapes.clear()) },
    render(dt, running) {
      settings.paused = !running
      resize()
      controls.update()
      if (gesture && current.tool === 'drop') {
        const size = sizeForHold((performance.now() - gesture.started) / 1000)
        const worldToPixels = canvas.clientHeight * camera.projectionMatrix.elements[5] / (2 * controls.getDistance())
        indicator.style.width = indicator.style.height = Math.max(12, size * worldToPixels) + 'px'
      }
      studio.render(running ? dt : 0)
    },
    dispose() {
      disposed = true
      cancel()
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', cancel)
      canvas.removeEventListener('lostpointercapture', lostCapture)
      window.removeEventListener('keydown', keydown)
      window.removeEventListener('blur', cancel)
      controls.dispose()
      indicator.remove()
      disposeResources(studio)
      renderer.dispose()
    },
  }
}
