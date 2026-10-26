/** About renders straight to the transparent, antialiased canvas. The gallery
 * retains the canonical HDR/bloom pipeline and its multisampled render target.
 */
export function transparentGarageRendering(source) {
  const start = source.indexOf('const postTarget = new THREE.WebGLRenderTarget')
  const end = source.indexOf('function renderFrame() {', start)
  if (start < 0 || end < 0) throw new Error('Canonical garage rendering block changed.')
  const galleryPipeline = source.slice(start, end)
    .replace('const postTarget =', 'postTarget =')
    .replace('const composer =', 'composer =')
    .replace('const bloom =', 'bloom =')
  return (source.slice(0, start)
    + "let postTarget = null, composer = null, bloom = null;\nif (mode === 'gallery') {\n"
    + galleryPipeline + '}\n' + source.slice(end))
    .replace('function renderFrame() {\n  if (lighting)', "function renderFrame() {\n  if (mode !== 'gallery') { renderer.render(scene, camera); return; }\n  if (lighting)")
    .replace('host.appendChild(renderer.domElement);', 'renderer.setClearColor(0x000000, 0); host.appendChild(renderer.domElement);')
}

// The road owns one camera target; vehicle height must never reframe the track.
export function fixedGarageTrack(source) {
  const assignment = 'targetY = (b.max.y - b.min.y) * 0.48;'
  if (!source.includes(assignment)) throw new Error('Canonical garage framing changed; review the fixed-track adapter.')
  return source.replace(assignment, '// Retain the shared road camera target.')
}
