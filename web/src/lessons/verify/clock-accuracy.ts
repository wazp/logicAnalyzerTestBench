// Verify track: is the analyzer's clock accurate? Measure many periods of a known signal and work out the
// error in ppm. Every period and count is computed from signals.json (the firmware's own config).

import { formatCount, formatHz, formatRate, formatTime } from '../../model/format';
import { periodNs } from '../../model/signals';
import { sig, wireSteps } from '../helpers';
import type { Lesson } from '../types';

const gpio = 2;
const s = sig(gpio);
const periodNsExact = periodNs(s);
const rate = 200_000;
const periods = 100;
const spanNs = periods * periodNsExact;
const lengthNs = spanNs + 2 * periodNsExact;
const samples = Math.round((lengthNs * rate) / 1e9);
const sampleNs = 1e9 / rate;
/** Worst-case error from timing two edges to within one sample period, over the whole span. */
const resolutionPpm = (sampleNs / spanNs) * 1e6;

// The Pico 2 W's 12 MHz crystal is the reference. Its rated tolerance is a datasheet fact, not firmware config.
const crystalPpm = 30;

// A worked example: an analyzer whose clock runs 50 ppm slow measures the span 50 ppm too long.
const exampleErrorPpm = 50;
const exampleSpanNs = spanNs * (1 + exampleErrorPpm / 1e6);
// Spans differ in the sixth digit, more than formatTime shows, so they are written in whole microseconds.
const us = (ns: number) => `${formatCount(Math.round(ns / 1e3))} µs`;

export const clockAccuracy: Lesson = {
  id: 'clock-accuracy',
  track: 'verify',
  title: 'Is your analyzer\'s clock accurate?',
  summary: 'Time a hundred periods of a known signal and work out your analyzer\'s timing error in ppm.',
  gpios: [gpio],
  intro:
    'Every time your analyzer shows comes from its own clock. If that clock runs fast or slow, every measurement is off by the same fraction: a baud rate looks wrong, a frequency reads high. A hand-built analyzer with a wrong clock setting can be off by a percent or more; a good one is within a few tens of parts per million (ppm). This test finds out which you have.',
  sections: [
    {
      title: 'Measure a long span, not one period',
      body: [
        `One period of a ${formatHz(s.actualHz)} signal is ${formatTime(periodNsExact)}. Measured once, it is only known to within one sample, which is far bigger than a clock error of a few ppm. So measure across many periods instead: the one-sample uncertainty stays the same, but the span it is compared with grows.`,
        'The error in ppm is (measured span - expected span) / expected span × 1,000,000. Positive means your analyzer measures times too long, so its clock runs slow; negative means it runs fast.',
        `The best you can resolve is one sample period divided by the span. That is also one divided by the number of samples across the span: with ${formatCount(Math.round(spanNs / sampleNs))} samples, about ${Math.round(resolutionPpm)} ppm.`,
      ],
      bullets: [
        `**The reference:** the Pico's own 12 MHz crystal, rated to within about ±${crystalPpm} ppm. All its signals are exact divisions of it, so this test compares two crystals: an error up to about ${crystalPpm} ppm plus your analyzer's own rating is normal.`,
        '**What it catches:** a clock that is clearly wrong, from about 0.01% (100 ppm) up. A wrong clock or divider setting in a hand-built analyzer typically gives an error of a few tenths of a percent or more.',
      ],
    },
  ],
  parts: [
    {
      title: `${periods} periods of GP${gpio}`,
      settings: {
        gpios: [gpio],
        sampleRateHz: rate,
        durationNs: lengthNs,
        preTriggerNs: 0,
        trigger: { type: 'edge', gpio, edge: 'rising' },
      },
      steps: [
        ...wireSteps([gpio]),
        `Capture ${formatTime(lengthNs)} at ${formatRate(rate)} (${formatCount(samples)} samples), triggered on the rising edge of GP${gpio}.`,
        `Place one marker on the rising edge at the trigger and one on the rising edge ${periods} periods later, ${formatTime(spanNs)} into the capture. Count carefully, or use a pulse or edge count if your software has one.`,
        `Work out the error: (your span - ${us(spanNs)}) / ${us(spanNs)} × 1,000,000 ppm.`,
        `If your analyzer cannot store that many samples, use a lower rate with the same length: the result is coarser (one sample over ${formatTime(spanNs)}), but a large error still shows.`,
        'Repeat a few times. A real clock error gives the same answer every time; a different answer each time means you are mostly seeing the one-sample uncertainty.',
      ],
      views: [
        {
          title: 'The whole capture',
          startNs: 0,
          endNs: lengthNs,
          sampleRateHz: rate,
          caption: `${formatHz(s.actualHz)} square wave: ${periods} periods take exactly ${formatTime(spanNs)} by the Pico's clock.`,
        },
      ],
    },
  ],
  questions: [
    {
      q: `You measure ${us(exampleSpanNs)} for ${periods} periods. What is the error?`,
      a: `(${us(exampleSpanNs)} - ${us(spanNs)}) / ${us(spanNs)} = ${formatTime(exampleSpanNs - spanNs)} / ${us(spanNs)}, so +${exampleErrorPpm} ppm: your analyzer measures times slightly too long, so its clock runs slightly slow. That is within the range of two ordinary crystals and fine for anything you will measure.`,
    },
    {
      q: 'Your result is about +7,000 ppm (0.7%). What does that mean?',
      a: 'Far outside any crystal tolerance: the analyzer measures every time 0.7% too long. That is a configuration problem, typically a clock that is not what the firmware assumes (a different crystal, a wrong PLL or divider setting). A UART at 115200 baud would look like about 114,400 baud.',
    },
    {
      q: 'Why does a faster sample rate not help much here?',
      a: `It does, but the length matters just as much: the resolution is one sample over the span, which is one divided by the number of samples. ${formatCount(Math.round(spanNs / sampleNs))} samples give about ${Math.round(resolutionPpm)} ppm whether you take them fast over a short span or slowly over a long one.`,
    },
  ],
};
