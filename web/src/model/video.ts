// The "Video and input" preset on GP10-GP19: a VGA picture, an NES controller
// and a PS/2 keyboard.
//
// video.json is generated from the firmware's C++ (src/core/video_frame.cpp)
// by tools/export_video.cpp. It holds the pins, the VGA timing, the buttons
// and bytes a lesson needs, and example windows as edge lists, exactly as the
// board outputs them. Views longer than an example (a whole video frame) are
// rebuilt here from the same timing, and a test checks the two agree.

import data from '../data/video.json';
import type { Example } from './protocols';
import type { EdgeWave } from './wave';

export type VideoPart = 'vga' | 'nes' | 'ps2';

export interface VideoPin {
  gpio: number;
  part: VideoPart;
  role: string;
  name: string;
  idleHigh: boolean;
}

export const videoData = data;
export const videoPins = data.pins as VideoPin[];
export const vga = data.vga;

export function videoPin(part: VideoPart, role: string): VideoPin {
  const p = videoPins.find((x) => x.part === part && x.role === role);
  if (!p) throw new Error(`no ${part} ${role} pin`);
  return p;
}

export function videoGpio(part: VideoPart, role: string): number {
  return videoPin(part, role).gpio;
}

export function videoExample(part: VideoPart, label: string): Example {
  const e = (data[part] as { examples: Example[] }).examples.find((x) => x.label === label);
  if (!e) throw new Error(`no ${part} example "${label}"`);
  return e;
}

/** Pixels per line and lines per frame, visible plus blanking. */
export const linePixels = vga.h.visible + vga.h.front + vga.h.sync + vga.h.back;
export const frameLines = vga.v.visible + vga.v.front + vga.v.sync + vga.v.back;
export const lineHz = 1e9 / vga.lineNs;
export const frameHz = 1e9 / vga.frameNs;
/** Where the sync pulses start: after the visible part and the front porch. */
export const hsyncStartNs = (vga.h.visible + vga.h.front) * vga.pixelNs;
export const hsyncNs = vga.h.sync * vga.pixelNs;
export const vsyncStartNs = (vga.v.visible + vga.v.front) * vga.lineNs;
export const vsyncNs = vga.v.sync * vga.lineNs;

/**
 * HSYNC or VSYNC over [startNs, endNs], times relative to `zeroNs`. Times are
 * from the start of a video frame (the first visible pixel); the picture
 * repeats every frame, so any start works.
 */
export function syncWave(role: 'hsync' | 'vsync', startNs: number, endNs: number, zeroNs: number): EdgeWave {
  const period = role === 'hsync' ? vga.lineNs : vga.frameNs;
  const fall = role === 'hsync' ? hsyncStartNs : vsyncStartNs;
  const width = role === 'hsync' ? hsyncNs : vsyncNs;
  const toggles: number[] = [];
  const low = (t: number) => {
    const p = ((t % period) + period) % period;
    return p >= fall && p < fall + width;
  };
  for (let k = Math.floor((startNs - fall) / period); k * period + fall < endNs; k++) {
    for (const t of [k * period + fall, k * period + fall + width]) {
      if (t > startNs && t < endNs) toggles.push(t - zeroNs);
    }
  }
  return { kind: 'edges', initial: low(startNs) ? 0 : 1, togglesNs: toggles };
}

/** Names of the NES buttons pressed in a read, in shift order. */
export function nesPressed(buttons: number): string[] {
  return data.nes.buttonNames.filter((_, i) => (buttons >> i) & 1);
}
