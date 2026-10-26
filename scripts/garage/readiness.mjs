/** Finish texture upload and shader compilation before the arrival starts. */
export async function prepareGarageVehicle(renderer, scene, camera, vehicle) {
  const textures = new Set()
  vehicle.traverse(node => {
    if (!node.isMesh) return
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value)
    }
  })
  textures.forEach(texture => renderer.initTexture(texture))
  await renderer.compileAsync(scene, camera)
}
