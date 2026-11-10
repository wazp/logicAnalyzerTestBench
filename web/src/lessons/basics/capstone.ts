// Learn capstone: write a datasheet for seven of the bench's basic pins, choosing every capture yourself.
// Every number in the answers comes from signals.json (the firmware's own config).

import { formatHz, formatPercent, formatRate, formatTime } from '../../model/format';
import { bounceTiming } from '../../model/signals';
import { highNs, patternPulses, period, sig, wireSteps } from '../helpers';
import type { Lesson } from '../types';

const steady = [2, 4, 6, 7];
const short = [8, 9];
const button = 26;
const pins = [...steady, ...short, button];

const lowNs = (gpio: number) => period(gpio) - highNs(gpio);
const duty = (gpio: number) => formatPercent(Math.round((100 * highNs(gpio)) / period(gpio)));
const pattern = sig(9).segments;
const shortestHigh9 = Math.min(...patternPulses());
const shortestLow9 = Math.min(...pattern.filter((s) => s.level === 0).map((s) => s.ns));
const bounce = bounceTiming(sig(button));

// The rate the method needs for the shortest pulse in a capture: 10 samples across it, rounded up to a rate
// most analyzers offer.
const rateFor = (shortestNs: number) => (shortestNs >= 10_000 ? 1_000_000 : 24_000_000);

export const learnCapstone: Lesson = {
  id: 'learn-capstone',
  track: 'learn',
  capstone: true,
  title: '13. Capstone: a datasheet for the bench',
  summary: 'Measure seven pins with settings you choose yourself, and write down what a datasheet would say about each.',
  gpios: pins,
  intro:
    'Every lesson in this track handed you the settings. This one does not. Seven pins, three groups, and one question for each: what is on it, exactly? Write your answers as a short datasheet, one line per pin: frequency or period, high and low time, duty cycle, and anything special. Use what the track taught: start fast, check that the rate resolves the shortest pulse, trigger on something that repeats, and capture long enough to see a whole period.',
  parts: [
    {
      title: 'Four steady signals',
      steps: [
        ...wireSteps(pins),
        `Capture ${steady.map((g) => `GP${g}`).join(', ')} together, in one capture. Pick a rate and a length that resolve the fastest of them and still show at least one whole period of the slowest.`,
        'For each pin, write down the frequency, the high and low time, and the duty cycle.',
        `Two of these pins have the same frequency. Do their edges line up? Which edges, and what does that tell you about how they are made?`,
      ],
      settings: {
        gpios: steady,
        sampleRateHz: rateFor(Math.min(...steady.map((g) => Math.min(highNs(g), lowNs(g))))),
        durationNs: 25e6,
        preTriggerNs: 0,
        trigger: { type: 'edge', gpio: 6, edge: 'rising' },
      },
      views: [],
    },
    {
      title: 'Two short ones',
      steps: [
        'Capture GP8 and GP9. Both repeat, but their pulses are much shorter than anything in the first group.',
        'For GP8: how long is the pulse, and how often does it come?',
        'For GP9: write down every high and low time in one repetition, in order, and the length of one repetition. What is the shortest pulse, and is your rate fast enough to measure it to within 10%?',
      ],
      settings: {
        gpios: short,
        sampleRateHz: rateFor(Math.min(highNs(8), shortestHigh9, shortestLow9)),
        durationNs: 1.1e6,
        preTriggerNs: 0,
        trigger: { type: 'edge', gpio: 8, edge: 'rising' },
      },
      views: [],
    },
    {
      title: 'The button',
      steps: [
        `Capture GP${button}. It is pressed and released on its own, about once every half second.`,
        'How many times does it go low before it settles when pressed, and how long does that take? The same for the release.',
        'How long is it held down?',
      ],
      settings: {
        gpios: [button],
        sampleRateHz: 2_000_000,
        durationNs: 2e6,
        preTriggerNs: 100e3,
        trigger: { type: 'edge', gpio: button, edge: 'falling' },
      },
      views: [],
    },
  ],
  questions: [
    {
      q: 'GP2, GP4, GP6 and GP7: what does the datasheet say?',
      a: [2, 4, 6, 7]
        .map(
          (g) =>
            `**GP${g}:** ${formatHz(sig(g).actualHz)}, ${formatTime(highNs(g))} high and ${formatTime(lowNs(g))} low, ${duty(g)} duty.`,
        )
        .join(' '),
    },
    {
      q: 'What rate and length did the first group need, and why?',
      a: `The fastest edges are GP4's: ${formatTime(highNs(4))} high and low. At ${formatRate(1_000_000)} that is ${highNs(4) / 1000} samples per half period, so each width is measured to about ${Math.round(100000 / highNs(4))}%. The slowest is GP2, ${formatTime(period(2))} per period, so ${formatTime(25e6)} shows two full periods: ${(25e6 * 1e6) / 1e9 / 1000}k samples per input. Much faster wastes samples; much slower and GP4's widths get coarse.`,
    },
    {
      q: 'Do the edges of GP6 and GP7 line up?',
      a: `The rising edges do: both go high at the same moment every ${formatTime(period(6))}, and only their falling edges differ (${formatTime(highNs(6))} and ${formatTime(highNs(7))} later). That is the sign of two outputs of one PWM counter: both start the period together, and each falls when the counter passes its own compare value.`,
    },
    {
      q: 'GP8 and GP9: what does the datasheet say?',
      a: `**GP8:** a ${formatTime(highNs(8))} high pulse every ${formatTime(period(8))}. **GP9:** a pattern repeating every ${formatTime(period(9))}: ${pattern.map((s) => `${formatTime(s.ns)} ${s.level ? 'high' : 'low'}`).join(', ')}. The shortest pulses are ${formatTime(shortestHigh9)} high and ${formatTime(shortestLow9)} low, so at ${formatRate(24_000_000)} you measure them to about one sample, ${formatTime(1e9 / 24e6)}, which is ${Math.round((100 * 1e9) / 24e6 / shortestHigh9)}% of a ${formatTime(shortestHigh9)} pulse. A 10% measurement needs at least ${formatRate(1e10 / shortestHigh9)}.`,
    },
    {
      q: 'GP26: what does the datasheet say?',
      a: `Pressed every ${formatTime(bounce.periodNs)}. On a press it goes low ${bounce.pressFalling} times in ${formatTime(bounce.pressBounceNs)} before it settles, and on release it goes high ${bounce.releaseRising} times in ${formatTime(bounce.releaseBounceNs)}. It is held down for about ${formatTime(bounce.heldNs)} from the first edge. A ${formatRate(2_000_000)} capture of ${formatTime(2e6)} around a falling edge shows the whole press bounce; the release needs a second capture triggered on a rising edge, or a longer, slower one.`,
    },
    {
      q: 'Which pin would a slow, long capture have lied about?',
      a: `Every pin in the second group. At ${formatRate(10_000)}, a sample is ${formatTime(1e5)}: longer than the GP8 pulse and every high pulse on GP9, so they vanish or show up as random single samples. GP4 would alias too: at ${formatRate(10_000)} its ${formatHz(sig(4).actualHz)} is exactly one sample per period, and it looks stuck.`,
    },
  ],
};
