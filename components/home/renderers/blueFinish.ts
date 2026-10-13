/** Shared soft blue plastic finish for the computer, phone and Vibe mark. */
export const COMPUTER_SURFACE_FINISH = {
  colorToken: '--color-hero-blue-light',
  roughness: 0.52,
  metalness: 0.08,
}

/** Recolor imported surfaces while keeping their texture shading, labels,
 *  normal maps and roughness detail. Capture the original materials before
 *  adding screen surfaces so screen artwork never receives this treatment. */
export function createBlueFinish(
  THREE: typeof import('three'),
  object: import('three').Object3D,
  finish: { roughness: number; metalness: number; textureLift?: number; dimEmission?: boolean; preserveMaterials?: readonly string[] },
) {
  // Some imported models have nearly black paint baked into their color
  // maps. Lift that paint while retaining its surface detail and lighting.
  const textureLift = Math.max(0, Math.min(1, finish.textureLift ?? 0))
  const materials = new Map<import('three').MeshStandardMaterial, {
    color: import('three').Color; roughness: number; metalness: number; emissiveIntensity: number
  }>()
  const originalAmount = { value: 0 }
  const refresh = () => {
    object.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        if (!(material instanceof THREE.MeshStandardMaterial) || material.name === 'monitor_glass' || finish.preserveMaterials?.includes(material.name) || materials.has(material)) continue
        materials.set(material, { color: material.color.clone(), roughness: material.roughness,
          metalness: material.metalness, emissiveIntensity: material.emissiveIntensity })
        install(material)
      }
    })
  }
  function install(material: import('three').MeshStandardMaterial) {
    material.roughness = finish.roughness
    material.metalness = finish.metalness
    material.onBeforeCompile = (shader) => {
      shader.uniforms.heroOriginalAmount = originalAmount
      shader.fragmentShader = 'uniform float heroOriginalAmount;\n' + shader.fragmentShader
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        THREE.ShaderChunk.map_fragment.replace(
          'diffuseColor *= sampledDiffuseColor;',
          `// Neutralize the source hue before applying the blue material color.
          float heroLuminance = dot(sampledDiffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
          sampledDiffuseColor.rgb = mix(vec3(mix(${textureLift.toFixed(4)}, 1.0, heroLuminance)), sampledDiffuseColor.rgb, heroOriginalAmount);
          diffuseColor *= sampledDiffuseColor;`,
        ),
      )
    }
    material.customProgramCacheKey = () => `hero-blue-finish-v3-${textureLift.toFixed(4)}`
    material.needsUpdate = true
  }
  refresh()
  const apply = (color: string, amount = 0) => {
    originalAmount.value = Math.max(0, Math.min(1, amount))
    for (const [material, original] of materials) {
      if (originalAmount.value === 1) {
        material.color.copy(original.color)
        material.roughness = original.roughness; material.metalness = original.metalness
      } else {
        material.color.set(color).lerp(original.color, originalAmount.value)
        material.roughness = THREE.MathUtils.lerp(finish.roughness, original.roughness, originalAmount.value)
        material.metalness = THREE.MathUtils.lerp(finish.metalness, original.metalness, originalAmount.value)
      }
      material.emissiveIntensity = original.emissiveIntensity * (finish.dimEmission ? originalAmount.value : 1)
    }
  }
  // Async compositions can register new props without cloning materials or shaders.
  return Object.assign(apply, { refresh })
}
