import type { PhoneModelKeyRegion } from './phoneModelKeys'
import { refinePhoneKeypad } from './refinePhoneKeypad'

/** Illuminate the original printed legends and depress the existing mesh.
 *  No additional surfaces or graphics sit over the phone. */
export function createPhoneKeyFeedback(
  THREE: typeof import('three'),
  mesh: import('three').Mesh,
  clock: () => number = () => performance.now(),
) {
  const sourceGeometry = mesh.geometry
  const feedbackGeometry = refinePhoneKeypad(THREE, sourceGeometry)
  mesh.geometry = feedbackGeometry
  const hoverRect = { value: new THREE.Vector4(0, 0, 1, 1) }
  const pressRect = { value: new THREE.Vector4(0, 0, 1, 1) }
  const hoverLight = { value: 0 }, pressLight = { value: 0 }
  const glowColor = { value: new THREE.Color('#3B9EC8') }
  let hoverTarget = 0, pressTarget = 0, releaseAt = 0, pressedAt = 0
  let pressed: PhoneModelKeyRegion | null = null
  const positions = mesh.geometry.getAttribute('position') as import('three').BufferAttribute
  const uv = mesh.geometry.getAttribute('uv')
  const original = Float32Array.from(positions.array)
  let lastDepth = 0, lastRegion: PhoneModelKeyRegion | null = null
  const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material])
    .filter((material): material is import('three').MeshStandardMaterial => material instanceof THREE.MeshStandardMaterial)
  const restore = materials.map(material => {
    const beforeCompile = material.onBeforeCompile
    const cacheKey = material.customProgramCacheKey
    material.onBeforeCompile = (shader, renderer) => {
      beforeCompile.call(material, shader, renderer)
      Object.assign(shader.uniforms, { phoneHoverRect: hoverRect, phonePressRect: pressRect,
        phoneHoverLight: hoverLight, phonePressLight: pressLight, phoneKeyGlow: glowColor })
      shader.fragmentShader = `
        uniform vec4 phoneHoverRect;
        uniform vec4 phonePressRect;
        uniform float phoneHoverLight;
        uniform float phonePressLight;
        uniform vec3 phoneKeyGlow;
        float phoneKeyMask(vec2 uv, vec4 rect) {
          vec2 distanceFromKey = abs((uv - rect.xy) / rect.zw);
          return 1.0 - smoothstep(0.55, 1.0, max(distanceFromKey.x, distanceFromKey.y));
        }
      ` + shader.fragmentShader
      shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `
        #include <emissivemap_fragment>
        #ifdef USE_MAP
          float legend = dot(texture2D(map, vMapUv).rgb, vec3(0.2126, 0.7152, 0.0722));
          float backlight = phoneKeyMask(vMapUv, phoneHoverRect) * phoneHoverLight * 0.65
            + phoneKeyMask(vMapUv, phonePressRect) * phonePressLight * 1.1;
          totalEmissiveRadiance += phoneKeyGlow * backlight * mix(0.07, 1.0, smoothstep(0.02, 0.4, legend));
        #endif
      `)
    }
    material.customProgramCacheKey = () => `${cacheKey.call(material)}-phone-keys-v1`
    material.needsUpdate = true
    return () => { material.onBeforeCompile = beforeCompile; material.customProgramCacheKey = cacheKey; material.needsUpdate = true }
  })
  const rect = (target: typeof hoverRect, region: PhoneModelKeyRegion) => {
    target.value.set(region.u, region.v, region.halfWidth, region.halfHeight)
  }
  const ease = (value: number, target: number, delta: number) => {
    const next = value + (target - value) * (1 - Math.exp(-Math.min(delta, 64) / 55))
    return Math.abs(next - target) < 0.002 ? target : next
  }
  const deform = (depth: number) => {
    if (depth === lastDepth && pressed === lastRegion) return
    for (let i = 0; i < positions.count; i++) {
      const distance = pressed ? Math.max(Math.abs(uv.getX(i) - pressed.u) / pressed.halfWidth,
        Math.abs(uv.getY(i) - pressed.v) / pressed.halfHeight) : 1
      const weight = Math.max(0, 1 - distance)
      positions.setY(i, original[i * 3 + 1] - 0.014 * depth * weight)
    }
    positions.needsUpdate = true
    // Existing normal maps keep the sculpted button shading during the tiny travel.
    lastDepth = depth; lastRegion = pressed
  }
  return {
    setHover(region: PhoneModelKeyRegion | null) {
      hoverTarget = region ? 1 : 0
      if (region) rect(hoverRect, region)
    },
    setPressed(region: PhoneModelKeyRegion | null) {
      if (region) {
        pressed = region; pressedAt = clock(); releaseAt = 0; pressTarget = 1
        rect(pressRect, region)
      } else if (pressed) {
        // Even a very quick click produces a visible press before releasing.
        releaseAt = Math.max(clock(), pressedAt + 90)
      }
    },
    step(delta: number, reduced: boolean) {
      if (releaseAt && (reduced || clock() >= releaseAt)) { releaseAt = 0; pressTarget = 0 }
      hoverLight.value = reduced ? hoverTarget : ease(hoverLight.value, hoverTarget, delta)
      pressLight.value = reduced ? pressTarget : ease(pressLight.value, pressTarget, delta)
      deform(pressLight.value)
      if (!pressTarget && pressLight.value === 0) pressed = null
    },
    needsFrames: () => hoverLight.value !== hoverTarget || pressLight.value !== pressTarget || releaseAt > 0,
    dispose() {
      pressed = null; deform(0)
      restore.forEach(reset => reset())
      mesh.geometry = sourceGeometry
      feedbackGeometry.dispose()
    },
  }
}

export type PhoneKeyFeedback = ReturnType<typeof createPhoneKeyFeedback>
