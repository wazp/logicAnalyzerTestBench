// Lesson: measuring duty cycle. Every number shown is computed from signals.json (the firmware's
// own config), so the lesson stays correct when the defaults change.

import { formatHz, formatPercent, formatTime } from '../../model/format';
import { highNs, period, sig, wireSteps } from '../helpers';
import type { Lesson } from '../types';

export const dutyCycle: Lesson = {
  id: 'duty-cycle',
  track: 'learn',
  title: '4. Measuring duty cycle',
  summary: 'Two PWM outputs at 25% and 75%, and how to measure them precisely.',
  gpios: [6, 7],
  intro: `GP6 and GP7 are the two channels of one PWM slice, so they share the ${formatHz(sig(6).actualHz)} frequency but have different duty cycles. Use your software's measurement tools on these: cursors, or a timing readout that shows width and period when you hover over a pulse.`,
  parts: [
    {
      title: 'Capture and measure',
      settings: {
        gpios: [6, 7],
        sampleRateHz: 1_000_000,
        durationNs: 5e6,
        preTriggerNs: 0.5e6,
        trigger: { type: 'edge', gpio: 6, edge: 'rising' },
      },
      steps: [
        ...wireSteps([6, 7]),
        'Capture, then measure the high time and the period on both signals.',
        'Duty cycle = high time / period.',
      ],
      views: [
        {
          title: 'Three periods',
          startNs: -500e3,
          endNs: 3e6,
          sampleRateHz: 1_000_000,
          caption: `GP6 is high for ${formatTime(highNs(6))}, GP7 for ${formatTime(highNs(7))}, both per ${formatTime(period(6))}.`,
        },
      ],
    },
  ],
  questions: [
    {
      q: 'What did you measure for each signal?',
      a: `GP6: ${formatTime(highNs(6))} high, ${formatPercent(sig(6).dutyPercent)}. GP7: ${formatTime(highNs(7))} high, ${formatPercent(sig(7).dutyPercent)}. Period ${formatTime(period(6))} on both.`,
    },
    {
      q: 'How precise is your measurement at 1 MS/s?',
      a: 'Each edge is uncertain by up to 1 µs, so a high time is good to about ±1 µs, about ±0.1% of the period. Faster sampling makes it more precise.',
    },
    {
      q: 'Why do both signals always rise at the same moment?',
      a: 'They share one PWM counter. Both outputs go high when it wraps to zero and go low at their own compare level.',
    },
  ],
};
