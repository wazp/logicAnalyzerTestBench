// Concept: the analog problems a logic analyzer turns into clean-looking bits, and how to suspect them.

import type { Lesson } from '../types';

export const limits: Lesson = {
  id: 'limits',
  track: 'concepts',
  title: "What a logic analyzer can't show you",
  summary: 'Ringing, slow edges, runt pulses, bus fights and floating lines: when the clean 0s and 1s are not the whole story.',
  gpios: [],
  intro:
    'A logic analyzer reduces every input to one bit per sample: above the threshold or below it. That is what makes it so good at protocols and timing, and it is also its blind spot. Some electrical problems come out as perfectly clean 0s and 1s, or as a few odd edges that look like a software bug. This lesson lists the usual ones, what each looks like in a capture, and when to reach for an oscilloscope.',
  sections: [
    {
      title: 'The picture is a summary',
      body: [
        'Two signals that look identical on an analyzer can be very different on a scope: one with crisp edges, one with slow, ringing edges that only just make it past the threshold. The analyzer shows where each edge crossed **its** threshold. The chip you are debugging has its own threshold, often a different one, and that is the one that decides what the circuit actually does.',
        'So a clean capture tells you what happened logically. It does not prove the signal is healthy. Keep that in mind whenever the logic looks right and the circuit still misbehaves.',
      ],
    },
    {
      title: 'Ringing and overshoot',
      body: [
        'A fast edge on a long wire or a poorly grounded probe overshoots, then rings: the voltage swings above and below its final level a few times. If a swing crosses the threshold, the analyzer records extra edges right after the real one. If it does not, the ringing is invisible.',
        'In a capture: short extra pulses within a few tens of nanoseconds after an edge, that come and go between captures and change with the sample rate. A clock line with ringing can make a chip count two edges instead of one, which looks like a mysterious extra bit.',
      ],
    },
    {
      title: 'Slow edges',
      body: [
        'An edge that rises slowly (a weak pull-up, a long cable, a heavily loaded line) crosses each threshold at a different moment. The analyzer and the chip disagree on when the edge happened, and two analyzer inputs can disagree with each other, which looks like skew between channels.',
        'Noise on a slow edge makes it cross the threshold several times: a burst of glitches exactly where the edge is. The "Voltage levels and thresholds" lesson shows this. A glitch filter hides the glitches, but the receiving chip still sees them.',
      ],
    },
    {
      title: 'Runt pulses',
      body: [
        'A runt is a pulse that starts to change level but turns back before reaching a valid high or low, for example when two edges happen almost at once. Whether anything sees it depends on each threshold: your analyzer may record a narrow pulse, nothing at all, or a pulse that the circuit never saw.',
        'In a capture: a narrow pulse that is there in some captures and not in others, or one that appears or disappears when you change the analyzer\'s threshold. That last test is a good hint that the pulse is analog trouble rather than a real logic event.',
      ],
    },
    {
      title: 'Two outputs fighting',
      body: [
        'Bus contention happens when two chips drive the same line at the same time, one high and one low: two SPI devices answering on MISO at once, or a pin configured as an output when it should be an input. The voltage settles somewhere in between, and both chips get hot.',
        'The analyzer records whichever side of its threshold the voltage lands on, so the capture shows a normal-looking level, or noisy toggling. Nothing on screen says "two drivers". Suspect it when a line has the wrong level only while a second device should be quiet, or a decoder reads data that is neither device\'s answer.',
      ],
    },
    {
      title: 'Floating lines',
      body: [
        'An input that nothing drives (an unconnected probe, a missing pull-up, a chip that is not powered) floats. It picks up whatever is nearby: it can sit at either level, follow a neighboring signal, or toggle at random.',
        'In a capture: activity on a line that should be idle, often a faint copy of the signal on the next pin. Connecting ground and checking the probe fixes most of these; a missing pull-up on an open-drain bus (I²C, 1-Wire) is the other usual cause.',
      ],
    },
    {
      title: 'When to reach for a scope',
      body: ['The analyzer is still the right first tool: it tells you where and when to look. These are the signs that the next look should be with an oscilloscope.'],
      table: {
        title: 'Signs of analog trouble',
        head: ['What you see', 'Suspect', 'Confirm with a scope'],
        rows: [
          ['Extra short pulses right after edges', 'Ringing, or a missing ground lead', 'Overshoot and ringing on the edge'],
          ['Glitches exactly where an edge should be', 'A slow, noisy edge', 'How long the edge takes, and the noise on it'],
          ['A pulse that comes and goes with the threshold setting', 'A runt pulse', 'The pulse never reaching a valid level'],
          ['A level that is right most of the time, wrong when two devices talk', 'Bus contention', 'A voltage stuck in the middle'],
          ['Activity on a line that should be idle', 'A floating line or crosstalk', 'A small, wandering voltage'],
          ['Everything right in the capture, and the circuit still fails', 'Different thresholds in the chip', 'Whether the levels meet the chip\'s datasheet'],
        ],
      },
    },
  ],
  parts: [],
  questions: [
    {
      q: 'Your capture of an SPI clock shows 9 rising edges where you expect 8, and the extra one is only a few nanoseconds wide. Is the sender wrong?',
      a: 'Probably not. A pulse a few nanoseconds wide right after an edge is the classic sign of ringing. Check the ground lead first. If it stays, look at the clock on a scope: if the receiving chip sees the ringing too, it may really count an extra bit.',
    },
    {
      q: 'A glitch filter removes the short pulses from your capture. Is the problem solved?',
      a: 'Only on your screen. The filter hides what the analyzer saw; the chip on the board has no filter and still sees every crossing. Use the filter to read the data, then fix the signal.',
    },
    {
      q: 'Two analyzer inputs on the same signal show its edge 30 ns apart. Is one input broken?',
      a: 'Not necessarily. If the edge is slow, two inputs with slightly different thresholds cross it at different moments. Try a fast, clean signal (the Verify track lessons use the Pico\'s): if the two inputs agree there, your analyzer is fine and the edge is slow.',
    },
  ],
};
