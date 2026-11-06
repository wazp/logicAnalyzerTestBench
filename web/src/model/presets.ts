// Signal presets: what the timeline pins GP10-GP22 play
// (src/core/presets.h). GP0-GP9 and the GP26 button never change. The board
// plays one preset at a time; switching saves it and restarts the board.

import { protocolPins } from './protocols';
import { videoPins } from './video';

export type PresetId = 'protocols' | 'video';

export interface Preset {
  id: PresetId;
  title: string;
  summary: string;
}

export const presets: Preset[] = [
  {
    id: 'protocols',
    title: 'Protocols',
    summary: 'UART, I²C, SPI, WS2812 LEDs, 1-Wire, an IR remote and a rotary encoder.',
  },
  {
    id: 'video',
    title: 'Video and input',
    summary: 'A VGA picture of color bars, an NES controller and a PS/2 keyboard.',
  },
];

/** The preset a board starts with until another one is chosen. */
export const defaultPreset: PresetId = 'protocols';

export function isPresetId(x: unknown): x is PresetId {
  return presets.some((p) => p.id === x);
}

export function presetById(id: PresetId): Preset {
  return presets.find((p) => p.id === id)!;
}

/** The timeline pins a preset drives, with their names. */
export function presetPins(id: PresetId): { gpio: number; name: string }[] {
  return id === 'video' ? videoPins : protocolPins;
}
