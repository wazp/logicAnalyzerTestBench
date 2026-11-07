import { describe, expect, it } from 'vitest';
import { shortLabel, signalName } from './board';
import { presetPins } from './presets';
import {
  frameHz,
  frameLines,
  lineHz,
  linePixels,
  nesPressed,
  syncWave,
  vga,
  videoData,
  videoExample,
  videoGpio,
  videoPins,
} from './video';

describe('video.json', () => {
  it('has the VGA, NES and PS/2 pins on GP10-GP19', () => {
    expect(videoPins.map((p) => p.gpio)).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
    expect(videoData.unusedGpios).toEqual([20, 21, 22]);
    expect(presetPins('video')).toBe(videoPins);
  });

  it('names GP10-GP22 by preset, and the basic pins the same in both', () => {
    expect(signalName(10, 'video')).toBe('VGA HSYNC');
    expect(signalName(10)).toBe('UART TX');
    expect(shortLabel(videoGpio('ps2', 'clock'), 'video')).toBe('KCLK');
    expect(shortLabel(3, 'video')).toBe(shortLabel(3));
    expect(() => signalName(21, 'video')).toThrow();
  });

  it('has 640x480 timing from a 25 MHz pixel clock', () => {
    expect(vga.pixelHz).toBe(25e6);
    expect(linePixels).toBe(800);
    expect(frameLines).toBe(525);
    expect(vga.lineNs).toBe(32_000);
    expect(lineHz).toBe(31_250);
    expect(frameHz).toBeCloseTo(59.524, 3);
  });

  it('decodes the NES buttons', () => {
    expect(nesPressed(videoData.nes.buttons[0])).toEqual(['A', 'Right']);
    expect(nesPressed(videoData.nes.buttons[1])).toEqual(['Start']);
  });
});

describe('syncWave', () => {
  // The exported "vsync" example covers lines 476 to 500 of a frame, straight
  // from the firmware's frame builder. The rebuilt waves must match it.
  it('matches the firmware around the vertical sync', () => {
    const e = videoExample('vga', 'vsync');
    const start = 476 * vga.lineNs;
    for (const role of ['hsync', 'vsync'] as const) {
      const trace = e.traces.find((t) => t.role === role)!;
      const wave = syncWave(role, start, start + e.durationNs, start);
      expect(wave.initial).toBe(trace.initial);
      expect(wave.togglesNs).toEqual(trace.togglesNs);
    }
  });

  it('matches the firmware within one line', () => {
    const e = videoExample('vga', 'line');
    const start = 99 * vga.lineNs + 600 * vga.pixelNs;
    const trace = e.traces.find((t) => t.role === 'hsync')!;
    expect(syncWave('hsync', start, start + e.durationNs, start).togglesNs).toEqual(trace.togglesNs);
  });
});
