// Runs the export lesson's script on a VCD built from the firmware's own UART example, sampled like an
// analyzer would, and checks that it finds the configured baud rate. Skipped where python3 is missing.

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { example, protocolData as d } from '../../model/protocols';

const script = fileURLToPath(new URL('./uart-baud.py', import.meta.url));
const hasPython = spawnSync('python3', ['--version']).status === 0;

/** The UART TX trace as a VCD, with each edge moved to the next sample at `rateHz`. */
function vcd(rateHz: number): string {
  const tx = example('uart', 'message_and_reply').traces.find((t) => t.role === 'tx')!;
  const stepNs = 1e9 / rateHz;
  const lines = ['$timescale 1 ns $end', '$scope module bench $end', '$var wire 1 ! TX $end', '$upscope $end'];
  lines.push('$enddefinitions $end', '#0', '$dumpvars', `${tx.initial}!`, '$end');
  let level = tx.initial;
  for (const t of tx.togglesNs) {
    level = 1 - level;
    lines.push(`#${Math.round(Math.ceil(t / stepNs) * stepNs)}`, `${level}!`);
  }
  return lines.join('\n') + '\n';
}

describe.skipIf(!hasPython)('uart-baud.py', () => {
  for (const rate of [1_000_000, 4_000_000, 24_000_000]) {
    it(`finds the baud rate within 0.1% at ${rate / 1e6} MS/s`, () => {
      const dir = mkdtempSync(join(tmpdir(), 'ltb-vcd-'));
      const file = join(dir, 'capture.vcd');
      writeFileSync(file, vcd(rate));
      const out = execFileSync('python3', ['-I', script, file, 'TX'], { encoding: 'utf8' });
      const baud = Number(/about (\d+) baud/.exec(out)?.[1]);
      expect(Math.abs(baud - d.uart.baud) / d.uart.baud).toBeLessThan(0.001);
    });
  }
});
