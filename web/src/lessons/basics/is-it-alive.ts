// Lesson: is it alive? The first checks on a dead board, done on signals the learner already knows. Every number
// shown is computed from signals.json and protocols.json (the firmware's own config).

import { formatHz, formatTime } from '../../model/format';
import { example, gpioOf, protocolData as d } from '../../model/protocols';
import type { EdgeWave } from '../../model/wave';
import { pinList, sig, wireSteps } from '../helpers';
import type { Lesson } from '../types';

const clock = 5;
const cs = gpioOf('spi', 'cs');

// CS goes low once per SPI transfer. The exported example holds one transfer; the frame repeats it every
// d.spi.startsMs. Build the CS line over the whole capture from those two facts.
const csToggles = example('spi', 'jedec_id').traces.find((t) => t.gpio === cs)!.togglesNs;
const csLowNs = csToggles[1] - csToggles[0];
const csPeriodNs = (d.spi.startsMs[1] - d.spi.startsMs[0]) * 1e6;
const captureNs = 50e6;
const csPulses = d.spi.startsMs.map((ms) => (ms - d.spi.startsMs[0]) * 1e6).filter((t) => t < captureNs);
const csWave: EdgeWave = { kind: 'edges', initial: 1, togglesNs: csPulses.flatMap((t) => [t, t + csLowNs]) };

const clockHz = sig(clock).actualHz;
const clockSamples = Math.round(10e6 / clockHz);

export const isItAlive: Lesson = {
  id: 'is-it-alive',
  track: 'learn',
  title: '7. Is it alive?',
  summary: 'The first checks on a board that does nothing: is there a clock, and is anything talking?',
  gpios: [clock, cs],
  intro:
    'A board that powers up and does nothing is the most common thing people point a logic analyzer at, from a retro computer with a black screen to a project that stopped working. Before reading any protocol, answer two quick questions: is there a clock, and is anything happening? This lesson does both on signals you already know.',
  sections: [
    {
      title: 'A checklist for a dead board',
      body: [
        'Work from the bottom up. Each step only makes sense if the one before it passed.',
      ],
      bullets: [
        '**Power.** A logic analyzer cannot check this: it only sees high or low. Measure the supply voltage with a multimeter first.',
        '**Clock.** Is the crystal or oscillator running, and is the clock the CPU gets the frequency you expect? Many computers divide the crystal down, so the CPU clock can be a fraction of the number printed on the crystal.',
        '**Reset.** Reset lines are usually active low (written /RESET or with a bar over the name). After power-up the line should go high and stay high. Stuck low means the CPU is held in reset and will never start.',
        '**Activity.** Is the CPU doing anything? Watch the chip select of the ROM or flash it boots from. A select that pulses means the CPU is fetching code; one that never moves means it is not.',
      ],
    },
  ],
  parts: [
    {
      title: 'Is there a clock?',
      intro: `GP${clock} plays the part of a CPU clock.`,
      settings: {
        gpios: [clock],
        sampleRateHz: 10_000_000,
        durationNs: 100e3,
        preTriggerNs: 5e3,
        trigger: { type: 'edge', gpio: clock, edge: 'rising' },
      },
      steps: [
        ...wireSteps([clock]),
        `Capture, triggered on a rising edge of GP${clock}. If the capture never triggers, there is no clock at all: that is already an answer.`,
        'Measure the period and work out the frequency. Check that the high and low halves are about equal.',
      ],
      views: [
        {
          title: 'The clock',
          startNs: -5e3,
          endNs: 50e3,
          sampleRateHz: 10_000_000,
          caption: `A steady ${formatHz(clockHz)} clock: ${formatTime(1e9 / clockHz)} per period, ${clockSamples} samples at 10 MS/s.`,
        },
      ],
    },
    {
      title: 'Is anything happening?',
      intro: `GP${cs} is the chip select of a flash chip. Whenever it goes low, something is reading the chip, just like a CPU reading its boot ROM.`,
      settings: {
        gpios: [cs],
        sampleRateHz: 1_000_000,
        durationNs: captureNs,
        preTriggerNs: 2e6,
        trigger: { type: 'edge', gpio: cs, edge: 'falling' },
      },
      steps: [
        `Connect ${pinList([cs])} to another free input.`,
        'Also enable one more analyzer input and connect it to **nothing**. It shows what a line with no signal looks like on your analyzer.',
        `Capture ${formatTime(captureNs)}, triggered on the falling edge of GP${cs}. Count the low pulses and measure the time between them.`,
      ],
      views: [
        {
          title: 'Chip select',
          startNs: -2e6,
          endNs: captureNs,
          sampleRateHz: 1_000_000,
          rows: [{ gpio: cs, wave: csWave }],
          caption: `${csPulses.length} low pulses, one every ${formatTime(csPeriodNs)}, each ${formatTime(csLowNs)} long. Your unconnected input is not drawn: depending on the analyzer it reads steady low, steady high, or toggles at random.`,
        },
      ],
    },
  ],
  questions: [
    {
      q: `GP${clock} measured ${formatHz(clockHz)}. On a real board, the CPU clock reads a quarter of the crystal frequency. Is something broken?`,
      a: 'Probably not. Many computers divide the crystal down for the CPU, and the video or serial chips often get other fractions of it. Check the schematic or the CPU datasheet for the expected ratio before suspecting the oscillator.',
    },
    {
      q: 'The chip select stays high for the whole capture. What does that tell you?',
      a: 'Nothing is reading that chip. The CPU may be held in reset, have no clock, or have crashed somewhere that never touches it. Go back down the checklist: clock first, then reset.',
    },
    {
      q: 'What did the unconnected input show, and why does it matter?',
      a: 'Whatever it showed is what "no signal" looks like on your analyzer. Some analyzers have pull-down resistors on their inputs, so a loose probe reads a steady low that looks exactly like a dead signal. Before you blame the board for a flat line, check that the probe is really on the pin.',
    },
    {
      q: 'Why trigger on the chip select instead of just starting a capture?',
      a: 'The trigger answers the question by itself: if the capture starts, the line moved, and if it never starts, it did not. It also lines every capture up on the same moment, so repeated captures are easy to compare.',
    },
  ],
};
