/** Repaint only the source atlas's purple pigment; keep the wooden handle
 *  and neutral details. The uniform tracks the same blue as the computer. */
export function createBrushFinish(THREE: typeof import('three'), root: import('three').Object3D) {
  const tipColor = { value: new THREE.Color('#8abaff') }
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (!(material instanceof THREE.MeshStandardMaterial)) continue
      material.roughness = 0.52
      material.metalness = 0.08
      material.flatShading = false
      material.onBeforeCompile = shader => {
        shader.uniforms.brushTipColor = tipColor
        shader.fragmentShader = `uniform vec3 brushTipColor;\n${shader.fragmentShader}`.replace(
          '#include <map_fragment>',
          THREE.ShaderChunk.map_fragment.replace('diffuseColor *= sampledDiffuseColor;', `
            float pigment = smoothstep(0.015, 0.045,
              min(sampledDiffuseColor.r, sampledDiffuseColor.b) - sampledDiffuseColor.g);
            float luminance = dot(sampledDiffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
            sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb,
              brushTipColor * (0.6 + 0.4 * luminance), pigment);
            diffuseColor *= sampledDiffuseColor;
          `),
        )
      }
      material.customProgramCacheKey = () => 'hero-brush-blue-tip-v1'
      material.needsUpdate = true
    }
  })
  return (color: string) => { tipColor.value.set(color) }
}
