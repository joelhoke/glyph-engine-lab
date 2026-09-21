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
  finish: { roughness: number; metalness: number; textureLift?: number },
) {
  // Some imported models have nearly black paint baked into their color
  // maps. Lift that paint while retaining its surface detail and lighting.
  const textureLift = Math.max(0, Math.min(1, finish.textureLift ?? 0))
  const materials = new Set<import('three').MeshStandardMaterial>()
  object.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (!(material instanceof THREE.MeshStandardMaterial) || material.name === 'monitor_glass') continue
      materials.add(material)
    }
  })
  for (const material of materials) {
    material.roughness = finish.roughness
    material.metalness = finish.metalness
    material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        THREE.ShaderChunk.map_fragment.replace(
          'diffuseColor *= sampledDiffuseColor;',
          `// Neutralize the source hue before applying the blue material color.
          float heroLuminance = dot(sampledDiffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
          sampledDiffuseColor.rgb = vec3(mix(${textureLift.toFixed(4)}, 1.0, heroLuminance));
          diffuseColor *= sampledDiffuseColor;`,
        ),
      )
    }
    material.customProgramCacheKey = () => `hero-blue-finish-v2-${textureLift.toFixed(4)}`
    material.needsUpdate = true
  }
  return (color: string) => {
    for (const material of materials) material.color.set(color)
  }
}
