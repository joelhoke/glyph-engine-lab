/** Rig the source model's separate lid around the rear edge of the keypad.
 *  The original pose is fully open; +90° around local X closes the lid. */
export function createPhoneHinge(THREE: typeof import('three'), root: import('three').Object3D) {
  let lid: import('three').Mesh | null = null
  let base: import('three').Mesh | null = null
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return
    node.geometry.computeBoundingBox()
    const box = node.geometry.boundingBox
    if (!box) return
    const size = box.getSize(new THREE.Vector3())
    if (size.z < size.y) lid = node
    else base = node
  })
  if (!lid || !base) throw new Error('The phone model needs separate lid and base meshes')
  const lidMesh = lid as import('three').Mesh
  const baseMesh = base as import('three').Mesh
  const lidBox = lidMesh.geometry.boundingBox!
  const baseBox = baseMesh.geometry.boundingBox!
  const hinge = new THREE.Group()
  hinge.name = 'phone-lid-hinge'
  hinge.position.set((lidBox.min.x + lidBox.max.x) / 2, baseBox.max.y + 0.02, lidBox.max.z)
  lidMesh.parent!.add(hinge)
  root.updateMatrixWorld(true)
  hinge.attach(lidMesh)
  return {
    lid: lidMesh,
    base: baseMesh,
    hinge,
    setOpen: (amount: number) => { hinge.rotation.x = (1 - Math.max(0, Math.min(1, amount))) * Math.PI / 2 },
  }
}
