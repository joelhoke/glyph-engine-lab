/**
 * Shared GLTF loading + normalization for the hero slot renderers
 * (components/home/renderers/HeroThreeObject.tsx). Every model is a
 * Sketchfab GLTF under public/assets/home/models/<name>/ (see the
 * license.txt alongside each for the CC-BY credit). Models are normalized
 * the same way: bounding box computed, centered at the origin, and
 * uniform-scaled to the slot's object size — the per-builder orientation
 * (baseRotation) lives in the builder.
 */

export type GltfModules = {
  THREE: typeof import('three')
  GLTFLoader: typeof import('three/examples/jsm/loaders/GLTFLoader.js').GLTFLoader
}

export type LoadedGltfModel = {
  object: import('three').Object3D
  dispose: () => void
}

/** Load a GLTF scene and dispose everything it owns on cleanup. */
export async function loadGltfModel(mods: GltfModules, url: string): Promise<LoadedGltfModel> {
  const { THREE, GLTFLoader } = mods
  const gltf = await new GLTFLoader().loadAsync(url)
  const object = gltf.scene
  return {
    object,
    dispose: () => {
      object.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return
        node.geometry?.dispose()
        const materials = Array.isArray(node.material) ? node.material : [node.material]
        for (const material of materials) {
          if (!material) continue
          for (const value of Object.values(material)) {
            if (value instanceof THREE.Texture) value.dispose()
          }
          material.dispose()
        }
      })
    },
  }
}

/** Center a model at the origin and uniform-scale it so its largest
 *  dimension is `targetSize` world units. Returns a wrapper group (the
 *  model keeps its own transforms inside). */
export function normalizeModel(
  THREE: GltfModules['THREE'],
  object: import('three').Object3D,
  targetSize: number,
): import('three').Group {
  const bounds = new THREE.Box3().setFromObject(object)
  const size = bounds.getSize(new THREE.Vector3())
  const center = bounds.getCenter(new THREE.Vector3())
  const scale = targetSize / Math.max(size.x, size.y, size.z, 0.0001)
  const wrapper = new THREE.Group()
  wrapper.add(object)
  object.position.set(-center.x, -center.y, -center.z)
  wrapper.scale.setScalar(scale)
  return wrapper
}
