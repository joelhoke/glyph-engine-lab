import * as THREE from 'three'
import { STATEMENT_FLOWER as config, flowerProgress } from '../../../content/statementFlower'
import { Flower } from './geometry'
import { applyGradient, gradientUniforms, setGradientUniforms } from './gradient'
import type { FlowerGradientSettings, FlowerVariety } from './types'

export type FlowerRendererOptions = {
  viewHeight?: number
  minViewWidth?: number
  target?: readonly [number, number, number]
  gradient?: FlowerGradientSettings
  sequence?: readonly FlowerVariety[]
  resolveProgress?: (progress: number) => { index: number; amount: number }
}

/** Deliberately contains no editor, orbit controls, input handlers or asset loaders. */
export function createFlowerRenderer(host: HTMLElement, onFailure: () => void, options: FlowerRendererOptions = {}) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  const scene = new THREE.Scene()
  const camera = new THREE.OrthographicCamera(-1.8, 1.8, 1.8, -1.8, 0.01, 100)
  camera.position.fromArray(config.framing.camera)
  camera.lookAt(new THREE.Vector3(...(options.target ?? config.framing.target)))
  const sequence = options.sequence ?? config.sequence
  const flowers = sequence.slice(0, -1).map((variety, index) => new Flower({
    ...config.geometry, variety, target: sequence[index + 1],
  }))
  flowers.forEach(flower => scene.add(flower.root))
  const uniforms = gradientUniforms()
  let gradient = options.gradient ?? { ...config.gradient, palette: config.palette }
  const setGradient = (settings: FlowerGradientSettings) => {
    gradient = settings
    setGradientUniforms(uniforms, settings)
  }
  setGradient(gradient)
  applyGradient(scene, uniforms)
  scene.add(new THREE.HemisphereLight('#ffffff', '#b1b7c8', 1.6))
  const key = new THREE.DirectionalLight('#fff9ed', 2.3)
  key.position.set(-3, 5, 6)
  const fill = new THREE.DirectionalLight('#c2ceff', 1.1)
  fill.position.set(3, 1, -2)
  scene.add(key, fill)
  let failed = false
  renderer.debug.onShaderError = () => { failed = true; onFailure() }
  const contextLost = () => { failed = true; onFailure() }
  renderer.domElement.addEventListener('webglcontextlost', contextLost)
  host.appendChild(renderer.domElement)
  return {
    setGradient,
    resize() {
      const { width, height } = host.getBoundingClientRect()
      renderer.setPixelRatio(Math.min(devicePixelRatio, config.maxPixelRatio, config.maxRenderSize / Math.max(width, height, 1)))
      renderer.setSize(Math.max(1, width), Math.max(1, height), false)
      const aspect = Math.max(1, width) / Math.max(1, height)
      camera.top = Math.max(options.viewHeight ?? config.framing.viewHeight, (options.minViewWidth ?? 0) / aspect) / 2
      camera.bottom = -camera.top
      camera.right = camera.top * width / Math.max(height, 1)
      camera.left = -camera.right
      camera.updateProjectionMatrix()
    },
    render(progress: number, time: number) {
      if (failed) return false
      const segment = (options.resolveProgress ?? flowerProgress)(progress)
      flowers.forEach((flower, index) => {
        flower.root.visible = index === segment.index
        if (flower.root.visible) flower.update(time, segment.amount)
      })
      uniforms.uPhase.value = (gradient.phase + time * gradient.speed) % 1
      renderer.render(scene, camera)
      return !failed
    },
    dispose() {
      const geometries = new Set<THREE.BufferGeometry>()
      const materials = new Set<THREE.Material>()
      scene.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return
        geometries.add(object.geometry)
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material)
      })
      geometries.forEach(geometry => geometry.dispose())
      materials.forEach(material => material.dispose())
      renderer.domElement.removeEventListener('webglcontextlost', contextLost)
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    },
  }
}
