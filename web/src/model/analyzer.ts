// Settings, limits and UI wording for the analyzer this guide targets:
// gusmanb/logicanalyzer (https://github.com/gusmanb/logicanalyzer) and its
// "LogicAnalyzer" desktop app.
//
// Values come from the project's wiki for release 6.0. The PCB 6.0 with the
// 6.5 beta firmware may differ, so everything app specific lives in this one
// file to make corrections easy.

export const analyzer = {
  name: 'gusmanb LogicAnalyzer',
  appName: 'LogicAnalyzer',
  docsVersion: '6.0',
  channelCount: 24,
  minSampleRateHz: 3100,
  maxSampleRateHz: 100_000_000,
  minPreSamples: 2,
  minPostSamples: 512,
  /** Pattern and fast pattern triggers can only use channels 1-16. */
  maxPatternChannel: 16,
  maxFastPatternChannels: 5,
};

/**
 * The capture buffer is shared by all channels, so the sample limits shrink
 * as the highest used channel goes up (wiki: "Up to ch 8 / 16 / 24").
 */
export interface ChannelMode {
  maxChannel: number;
  maxPreSamples: number;
  maxPostSamples: number;
}

export const channelModes: ChannelMode[] = [
  { maxChannel: 8, maxPreSamples: 98303, maxPostSamples: 131069 },
  { maxChannel: 16, maxPreSamples: 49151, maxPostSamples: 65533 },
  { maxChannel: 24, maxPreSamples: 24576, maxPostSamples: 32765 },
];

export type Trigger =
  | { type: 'edge'; channel: number; edge: 'rising' | 'falling' }
  | { type: 'pattern'; firstChannel: number; pattern: string }
  | { type: 'fast-pattern'; firstChannel: number; pattern: string };

export interface CaptureSettings {
  /** Analyzer channels to enable (1-based). */
  channels: number[];
  sampleRateHz: number;
  preSamples: number;
  postSamples: number;
  trigger: Trigger;
  /** Optional burst mode: capture this many consecutive triggers. */
  burstCount?: number;
}

export function modeFor(channels: number[]): ChannelMode {
  const highest = Math.max(...channels);
  const mode = channelModes.find((m) => highest <= m.maxChannel);
  if (!mode) throw new Error(`channel ${highest} is above ${analyzer.channelCount}`);
  return mode;
}

/** Time covered before and after the trigger, in ns. */
export function captureWindow(s: CaptureSettings): { preNs: number; postNs: number } {
  const stepNs = 1e9 / s.sampleRateHz;
  return { preNs: s.preSamples * stepNs, postNs: s.postSamples * stepNs };
}

/** Problems with a settings combination, as user facing messages. Empty when valid. */
export function validateSettings(s: CaptureSettings): string[] {
  const issues: string[] = [];
  const mode = modeFor(s.channels);

  if (s.sampleRateHz < analyzer.minSampleRateHz || s.sampleRateHz > analyzer.maxSampleRateHz) {
    issues.push('Sample rate is outside the analyzer range (3.1 kS/s to 100 MS/s).');
  }
  if (s.preSamples < analyzer.minPreSamples || s.preSamples > mode.maxPreSamples) {
    issues.push(`Pre-trigger samples must be ${analyzer.minPreSamples} to ${mode.maxPreSamples} when using channels up to ${mode.maxChannel}.`);
  }
  if (s.postSamples < analyzer.minPostSamples || s.postSamples > mode.maxPostSamples) {
    issues.push(`Post-trigger samples must be ${analyzer.minPostSamples} to ${mode.maxPostSamples} when using channels up to ${mode.maxChannel}.`);
  }

  const t = s.trigger;
  if (t.type === 'edge') {
    if (!s.channels.includes(t.channel)) issues.push(`Trigger channel ${t.channel} is not enabled.`);
  } else {
    const last = t.firstChannel + t.pattern.length - 1;
    if (last > analyzer.maxPatternChannel) issues.push('Pattern triggers can only use channels 1 to 16.');
    if (t.type === 'fast-pattern' && t.pattern.length > analyzer.maxFastPatternChannels) {
      issues.push('Fast pattern triggers can use at most 5 channels.');
    }
    if (!/^[01]+$/.test(t.pattern)) issues.push('A pattern is a string of 0 and 1.');
  }
  return issues;
}

/** How the trigger is described in the app, for the settings card. */
export function describeTrigger(t: Trigger): string {
  if (t.type === 'edge') {
    return `Edge trigger on channel ${t.channel}, ${t.edge === 'rising' ? 'rising (positive)' : 'falling (negative)'} edge`;
  }
  const kind = t.type === 'pattern' ? 'Pattern' : 'Fast pattern';
  const last = t.firstChannel + t.pattern.length - 1;
  return `${kind} trigger, first channel ${t.firstChannel}, pattern "${t.pattern}" (channels ${t.firstChannel} to ${last})`;
}
