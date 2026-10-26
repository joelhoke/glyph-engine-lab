// Bind authored wheel assemblies without changing their geometry or materials.
// McLaren and Lancia each store a left/right pair on a shared axle.
export function createVehicleWheels(THREE, vehicle, id) {
  const groups = new Map()
  vehicle.traverse(node => {
    const key = id === 'lighting' && /^Wheel_(Front|Rear)_(Left|Right)$/.test(node.name) ? node.name
      : id === 'mclaren' && /^(front|back)_wheels_\d+$/.test(node.name) ? node.name
      : id === 'lancia' && /^_Lancia_Stratos00[23]$/.test(node.name) ? node.name : null
    if (key) { if (!groups.has(key)) groups.set(key, []); groups.get(key).push(node) }
  })
  vehicle.updateWorldMatrix(true, true)
  const axis = new THREE.Vector3(1,0,0).applyQuaternion(vehicle.getWorldQuaternion(new THREE.Quaternion()).invert())
  const wheels = []
  for (const [name, nodes] of groups) {
    const box = new THREE.Box3()
    nodes.forEach(node => box.union(new THREE.Box3().setFromObject(node)))
    const radius = (box.max.y - box.min.y) / 2
    if (!(radius > 0)) continue
    const pivot = new THREE.Group(); pivot.name = `Rolling axle: ${name}`
    pivot.position.copy(vehicle.worldToLocal(box.getCenter(new THREE.Vector3())))
    vehicle.add(pivot); pivot.updateWorldMatrix(true, false)
    nodes.forEach(node => pivot.attach(node))
    wheels.push({ pivot, radius })
  }
  return {
    count: wheels.length,
    advance(distance) {
      if (!Number.isFinite(distance)) return
      for (const { pivot, radius } of wheels) pivot.rotateOnAxis(axis, distance / radius)
    },
  }
}
