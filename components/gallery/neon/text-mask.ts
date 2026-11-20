/** Local system fonts keep text rendering private and avoid network/font loading delays. */
export const typefaces = [
  { name: "Grotesk", family: '"Arial Black", Arial, sans-serif', weight: 900, sample: "Aa" },
  { name: "Editorial", family: 'Georgia, "Times New Roman", serif', weight: 700, sample: "Aa" },
  { name: "Mono", family: '"Courier New", Courier, monospace', weight: 700, sample: "Aa" },
  { name: "Condensed", family: 'Impact, "Arial Narrow", sans-serif', weight: 900, sample: "Aa" },
];
export const TEXT_LIMIT = 10;
export const limitText = (value: string) => Array.from(value.replace(/[\r\n\t]/g, " ")).slice(0, TEXT_LIMIT).join("");
export const MASK_WIDTH = 1024;
export const MASK_HEIGHT = 512;

// Two chamfer sweeps approximate Euclidean distance to the nearest opposite pixel.
// Generated only when typography changes, never in the animation loop otherwise.
function distances(alpha: Uint8ClampedArray, inside: boolean): Float32Array {
  const w = MASK_WIDTH, h = MASK_HEIGHT;
  const d = new Float32Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = (alpha[i * 4 + 3] > 127) === inside ? 0 : 2048;
  const diagonal = Math.SQRT2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (x) d[i] = Math.min(d[i], d[i - 1] + 1);
    if (y) { d[i] = Math.min(d[i], d[i - w] + 1); if (x) d[i] = Math.min(d[i], d[i - w - 1] + diagonal); if (x < w - 1) d[i] = Math.min(d[i], d[i - w + 1] + diagonal); }
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x;
    if (x < w - 1) d[i] = Math.min(d[i], d[i + 1] + 1);
    if (y < h - 1) { d[i] = Math.min(d[i], d[i + w] + 1); if (x) d[i] = Math.min(d[i], d[i + w - 1] + diagonal); if (x < w - 1) d[i] = Math.min(d[i], d[i + w + 1] + diagonal); }
  }
  return d;
}

export function makeTextMask(text: string, font: number, tracking: number): Uint8Array {
  const canvas = document.createElement("canvas");
  canvas.width = MASK_WIDTH; canvas.height = MASK_HEIGHT;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Text canvas unavailable");
  const face = typefaces[font] || typefaces[0];
  const letters = Array.from(limitText(text));
  let size = 330;
  const setFont = () => { ctx.font = `${face.weight} ${size}px ${face.family}`; };
  setFont();
  const measure = () => letters.reduce((width, char) => width + ctx.measureText(char).width, 0) + Math.max(0, letters.length - 1) * tracking * size;
  let width = measure();
  if (width > MASK_WIDTH * .85) { size *= MASK_WIDTH * .85 / width; setFont(); width = measure(); }
  const metrics = ctx.measureText(text || "M");
  const ascent = metrics.actualBoundingBoxAscent || size * .75;
  const descent = metrics.actualBoundingBoxDescent || 0;
  let x = (MASK_WIDTH - width) / 2;
  const y = (MASK_HEIGHT + ascent - descent) / 2;
  ctx.fillStyle = "white"; ctx.textBaseline = "alphabetic";
  for (const char of letters) { ctx.fillText(char, x, y); x += ctx.measureText(char).width + tracking * size; }
  const alpha = ctx.getImageData(0, 0, MASK_WIDTH, MASK_HEIGHT).data;
  const toInside = distances(alpha, true), toOutside = distances(alpha, false);
  const pixels = new Uint8Array(MASK_WIDTH * MASK_HEIGHT);
  for (let i = 0; i < pixels.length; i++) {
    const signed = toOutside[i] - toInside[i] + alpha[i * 4 + 3] / 255 - .5;
    pixels[i] = Math.max(0, Math.min(255, Math.round(128 + signed * 4)));
  }
  return pixels;
}
