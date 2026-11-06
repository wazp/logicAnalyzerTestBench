// What a lesson asks the learner to capture, in terms any logic analyzer and
// any software (PulseView, Saleae Logic, an analyzer's own app...) can
// follow: which signals, how fast, how long, and what to trigger on.
//
// Every lesson stays within `minimumAnalyzer`, so a cheap 8-input, 24 MS/s
// analyzer can do all of them. Larger analyzers simply have room to spare.

import { shortLabel } from './board';
import { formatRate, formatTime } from './format';

export const minimumAnalyzer = {
  inputs: 8,
  maxSampleRateHz: 24_000_000,
};

export type Trigger =
  | { type: 'edge'; gpio: number; edge: 'rising' | 'falling' }
  /** All listed pins at the given levels at the same time ("pattern" or "condition" trigger). */
  | { type: 'pattern'; levels: { gpio: number; level: 0 | 1 }[] }
  /** A pulse at `level` lasting longer and/or shorter than the given times ("pulse width" trigger). */
  | { type: 'pulse'; gpio: number; level: 0 | 1; longerThanNs?: number; shorterThanNs?: number };

export interface CaptureSettings {
  /** Signals to record, by Pico pin. Connect each to any free analyzer input. */
  gpios: number[];
  sampleRateHz: number;
  /** How much to record after the trigger. */
  durationNs: number;
  /** How much to keep from before the trigger, if the analyzer can (most can). */
  preTriggerNs: number;
  trigger: Trigger;
  /** Optional protocol decoder to add, in plain words. */
  decoder?: string;
}

/** Time covered before and after the trigger, in ns. */
export function captureWindow(s: CaptureSettings): { preNs: number; postNs: number } {
  return { preNs: s.preTriggerNs, postNs: s.durationNs };
}

/** Samples covering `ns` at the lesson's sample rate, for apps that set the length as a sample count. */
export function samplesFor(s: CaptureSettings, ns: number): number {
  return Math.ceil((ns * s.sampleRateHz) / 1e9);
}

/** Samples per input for the whole capture. Buffer-based analyzers need this much memory. */
export function samplesNeeded(s: CaptureSettings): number {
  return Math.ceil(((s.preTriggerNs + s.durationNs) * s.sampleRateHz) / 1e9);
}

/** Problems with a lesson's settings, as messages. Empty when valid. */
export function validateSettings(s: CaptureSettings): string[] {
  const issues: string[] = [];
  if (s.gpios.length === 0) issues.push('No signals to record.');
  if (s.gpios.length > minimumAnalyzer.inputs) {
    issues.push(`Uses ${s.gpios.length} inputs; lessons must work with ${minimumAnalyzer.inputs}.`);
  }
  if (s.sampleRateHz > minimumAnalyzer.maxSampleRateHz) {
    issues.push(`Needs ${formatRate(s.sampleRateHz)}; lessons must work at ${formatRate(minimumAnalyzer.maxSampleRateHz)}.`);
  }
  if (s.durationNs <= 0 || s.preTriggerNs < 0) issues.push('Capture length must be positive.');
  const t = s.trigger;
  const triggerPins = t.type === 'pattern' ? t.levels.map((l) => l.gpio) : [t.gpio];
  if (t.type === 'pulse' && t.longerThanNs === undefined && t.shorterThanNs === undefined) {
    issues.push('A pulse width trigger needs a minimum or maximum width.');
  }
  for (const g of triggerPins) {
    if (!s.gpios.includes(g)) issues.push(`Trigger uses GP${g}, which is not recorded.`);
  }
  return issues;
}

/** The trigger in plain words. */
export function describeTrigger(t: Trigger): string {
  if (t.type === 'edge') {
    return `${t.edge === 'rising' ? 'Rising' : 'Falling'} edge on GP${t.gpio} (${shortLabel(t.gpio)})`;
  }
  if (t.type === 'pulse') {
    const limits = [
      t.longerThanNs !== undefined ? `longer than ${formatTime(t.longerThanNs)}` : '',
      t.shorterThanNs !== undefined ? `shorter than ${formatTime(t.shorterThanNs)}` : '',
    ].filter(Boolean);
    return `GP${t.gpio} ${t.level ? 'high' : 'low'} pulse ${limits.join(' and ')}`;
  }
  return t.levels.map((l) => `GP${l.gpio} ${l.level ? 'high' : 'low'}`).join(' and ');
}
