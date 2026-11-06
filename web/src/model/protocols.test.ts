import { describe, expect, it } from 'vitest';
import { allSignalGpios, shortLabel, signalName } from './board';
import { example, examplesOf, exampleWave, firstEdgeNs, gpioOf, protocolData as d, protocolPins } from './protocols';
import { idealWaveTrace, sampledWaveTrace, waveLevelAt } from './wave';

describe('protocols.json', () => {
  it('has 13 pins on GP10-GP22', () => {
    expect(protocolPins.map((p) => p.gpio)).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]);
    expect(allSignalGpios).toHaveLength(24);
  });

  it('names and labels every pin', () => {
    expect(signalName(gpioOf('spi', 'cs'))).toBe('SPI CS');
    expect(shortLabel(gpioOf('i2c', 'sda'))).toBe('SDA');
    expect(shortLabel(0)).toBe('1 Hz');
  });

  it('carries the expected content', () => {
    expect(d.uart.firstMessage).toBe('Test bench #1\r\n');
    expect(d.i2c.temperatureC).toBe(25);
    expect(d.onewire.temperatureC).toBeCloseTo(25.0625, 6);
    expect(d.spi.reply).toEqual([0xef, 0x40, 0x18]);
  });

  it('examples start at the idle level and stay inside their window', () => {
    for (const p of ['uart', 'i2c', 'spi', 'ws2812', 'onewire', 'ir', 'quadrature'] as const) {
      for (const e of examplesOf(p)) {
        for (const t of e.traces) {
          for (const ns of t.togglesNs) {
            expect(ns).toBeGreaterThan(0);
            expect(ns).toBeLessThan(e.durationNs);
          }
        }
      }
    }
  });
});

describe('edge waves', () => {
  const e = example('uart', 'first_character');
  const tx = gpioOf('uart', 'tx');
  const zero = firstEdgeNs(e, tx, 'falling');
  const w = exampleWave(e, tx, zero);

  it('put the trigger edge at t = 0', () => {
    expect(waveLevelAt(w, -1)).toBe(1);
    expect(waveLevelAt(w, 1)).toBe(0);
  });

  it('decode the first character when sampled at mid-bit', () => {
    const bit = d.uart.bitNs;
    let byte = 0;
    for (let i = 0; i < 8; i++) byte |= waveLevelAt(w, (1.5 + i) * bit) << i;
    expect(byte).toBe('T'.charCodeAt(0));
  });

  it('render ideal and sampled traces', () => {
    const ideal = idealWaveTrace(w, -10e3, 100e3);
    expect(ideal.startLevel).toBe(1);
    expect(ideal.edges[0]).toEqual({ t: 0, level: 0 });
    const sampled = sampledWaveTrace(w, -10e3, 100e3, 2_000_000);
    expect(sampled.edges.length).toBe(ideal.edges.length);
  });
});
