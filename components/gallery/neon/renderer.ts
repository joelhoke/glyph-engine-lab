import { fragment, vertex } from './shader'
import { makeTextMask, MASK_WIDTH, MASK_HEIGHT } from './text-mask'
import type { PlaygroundEngine } from '../playground/usePlayground'

export const neonDefaults = { textMode: 0, text: 'NEON TRIP', font: 0, tracking: .02, shape: 0, palette: ['#63f4ec', '#6029c8', '#ff459b', '#fff1a6'], background: '#10121b', speed: .7, distortion: .1, noise: .12, scale: 1.8, glow: .65, grain: .4, mode: 0, seed: 4, zoom: 1 }
export type NeonSettings = typeof neonDefaults
export function createNeon(canvas: HTMLCanvasElement, initial: NeonSettings): PlaygroundEngine<NeonSettings> {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false })
  if (!gl) throw new Error('WebGL unavailable')
  const shaders: WebGLShader[] = []
  const program = gl.createProgram()!
  const buffer = gl.createBuffer()
  const texture = gl.createTexture()
  const dispose = () => { gl.deleteTexture(texture); gl.deleteBuffer(buffer); gl.deleteProgram(program); shaders.forEach(shader => gl.deleteShader(shader)) }
  try {
    for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]] as const) {
      const shader = gl.createShader(type)!; shaders.push(shader)
      gl.shaderSource(shader, source); gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('Shader compilation failed')
      gl.attachShader(program, shader)
    }
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Shader linking failed')
  } catch (error) { dispose(); throw error }
  gl.useProgram(program); gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW)
  const position = gl.getAttribLocation(program, 'position')
  gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
  const uniforms = Object.fromEntries(['resolution','time','shape','distortion','noiseAmount','noiseScale','glow','grain','mode','seed','zoom','color0','color1','color2','color3','background','textMode','textMask'].map(name => [name, gl.getUniformLocation(program, name)]))
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 1, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, new Uint8Array([0])); gl.uniform1i(uniforms.textMask, 0)
  let settings = initial, time = 0, textKey = '', dirty = true
  const rgb = (hex: string) => [1,3,5].map(i => parseInt(hex.slice(i, i+2),16)/255)
  return {
    update(value) { settings = value; dirty = true },
    render(delta, running) {
      const rect = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 1.7)
      const w = Math.max(1, Math.round(rect.width*dpr)), h = Math.max(1, Math.round(rect.height*dpr))
      if (!dirty && !running && canvas.width === w && canvas.height === h) return
      dirty = false
      if (running) time += delta*settings.speed
      const v = settings, key = JSON.stringify([v.text,v.font,v.tracking])
      if (v.textMode && key !== textKey) { gl.texImage2D(gl.TEXTURE_2D,0,gl.LUMINANCE,MASK_WIDTH,MASK_HEIGHT,0,gl.LUMINANCE,gl.UNSIGNED_BYTE,makeTextMask(v.text,v.font,v.tracking)); textKey = key }
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h }
      gl.viewport(0,0,w,h); gl.uniform2f(uniforms.resolution,w,h)
      for (const [key,value] of Object.entries({ time, textMode:v.textMode,shape:v.shape,distortion:v.distortion,noiseAmount:v.noise,noiseScale:v.scale,glow:v.glow,grain:v.grain,mode:v.mode,seed:v.seed,zoom:v.zoom })) gl.uniform1f(uniforms[key],value)
      v.palette.forEach((color,i) => gl.uniform3fv(uniforms[`color${i}`],rgb(color))); gl.uniform3fv(uniforms.background,rgb(v.background)); gl.drawArrays(gl.TRIANGLES,0,6)
    }, dispose,
  }
}
