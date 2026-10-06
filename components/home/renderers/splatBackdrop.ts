import { splatSidePositions } from './splatRelief'

/** Original PNG silhouette and shallow relief, revealed behind the brush
 *  on interaction. Keep the texture path stable for future asset swaps. */
export async function createSplatBackdrop(THREE: typeof import('three')) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 350
  const ctx = canvas.getContext('2d')!
  try {
    const texture = await new THREE.TextureLoader().loadAsync('/assets/home/splat-reference.png')
    canvas.width = Math.min(texture.image.width, 512)
    canvas.height = Math.min(texture.image.height, 512)
    ctx.drawImage(texture.image, 0, 0, canvas.width, canvas.height)
    texture.dispose()
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
    let transparent = false
    for (let i = 3; i < pixels.data.length; i += 4) if (pixels.data[i] < 250) { transparent = true; break }
    for (let i = 0; i < pixels.data.length; i += 4) {
      if (!transparent) pixels.data[i + 3] = 255 - (0.3 * pixels.data[i] + 0.6 * pixels.data[i + 1] + 0.1 * pixels.data[i + 2])
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = 255
    }
    ctx.putImageData(pixels, 0, 0)
  } catch {
    // A missing replacement PNG should never hide the brush itself.
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    for (let i = 0; i <= 96; i++) {
      const theta = i / 96 * Math.PI * 2
      const radius = 100 * (1 + 0.17 * Math.sin(theta * 3) + 0.13 * Math.sin(theta * 7 + 0.4))
      const x = 175 + Math.cos(theta) * radius, y = 175 + Math.sin(theta) * radius
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
    }
    ctx.closePath(); ctx.fill()
  }
  const texture = new THREE.CanvasTexture(canvas)
  const material = new THREE.MeshStandardMaterial({
    map: texture, roughness: 0.55, metalness: 0.08, transparent: true,
    alphaTest: 0.01, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true,
  })
  const edgeMaterial = new THREE.MeshStandardMaterial({
    roughness: 0.5, metalness: 0.08, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  })
  const group = new THREE.Group()
  const plane = new THREE.PlaneGeometry(2.6, 2.6)
  const front = new THREE.Mesh(plane, material)
  const back = new THREE.Mesh(plane, material)
  back.position.z = -0.12
  const edges = new THREE.BufferGeometry()
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
  edges.setAttribute('position', new THREE.Float32BufferAttribute(
    splatSidePositions(pixels.data, canvas.width, canvas.height, 2.6, 0.12), 3,
  ))
  edges.computeVertexNormals()
  group.add(back, new THREE.Mesh(edges, edgeMaterial), front)
  group.visible = false
  return {
    object: group,
    setHighlight: (amount: number) => {
      group.visible = amount > 0
      material.opacity = edgeMaterial.opacity = amount
    },
    applyTheme: (readToken: (name: string) => string) => {
      // The site accent is light blue in dark mode and the original deep
      // splat blue in light mode. Keep the relief edges darker in both.
      material.color.set(readToken('--color-accent'))
      edgeMaterial.color.set(readToken('--color-hero-blue-edge'))
    },
    dispose: () => { texture.dispose(); plane.dispose(); edges.dispose(); material.dispose(); edgeMaterial.dispose() },
  }
}
