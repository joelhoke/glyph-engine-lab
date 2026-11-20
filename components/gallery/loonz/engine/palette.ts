import type { SceneDocument } from "./types";
import { WIPE_DURATION } from "./motion";

export type BackgroundPalette = NonNullable<SceneDocument["backgroundPalette"]>;
export const PALETTE_PRESETS = [
  { name: "Candy", colors: ["#e9adca", "#bac9df", "#e8c998", "#eeebe5"] },
  { name: "Meadow", colors: ["#b8cbb9", "#e8c998", "#d6dce8", "#eeebe5"] },
  { name: "Dusk", colors: ["#30333e", "#756784", "#be879e", "#e9adca"] },
];
export const DEFAULT_BACKGROUND_PALETTE: BackgroundPalette = {
  colors: PALETTE_PRESETS[0].colors,
  holdSeconds: 1.5,
};

/** Advances once per visible frame, never racing through missed colors after a hidden tab. */
export class PalettePlayback {
  playing = false;
  private palette = DEFAULT_BACKGROUND_PALETTE;
  private signature = "";
  private index = -1;
  private nextAt = 0;
  configure(palette: BackgroundPalette) {
    const signature = JSON.stringify(palette);
    if (signature === this.signature) return;
    this.signature = signature;
    this.palette = palette;
    this.index = -1;
    this.nextAt = 0;
  }
  start() {
    this.playing = true;
    this.index = -1;
    this.nextAt = 0;
  }
  stop() {
    this.playing = false;
  }
  tick(now: number): string | null {
    if (!this.playing || now < this.nextAt || this.palette.colors.length < 2)
      return null;
    this.index = (this.index + 1) % this.palette.colors.length;
    this.nextAt = now + WIPE_DURATION + this.palette.holdSeconds * 1000;
    return this.palette.colors[this.index];
  }
}
