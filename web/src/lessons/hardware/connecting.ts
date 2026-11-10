// Real hardware: where and how to attach probes, and how the wiring itself changes what you capture.
// Reading only.

import type { Lesson } from '../types';

export const connecting: Lesson = {
  id: 'connecting-probes',
  track: 'hardware',
  title: 'Connecting to a real board',
  summary: 'Where to clip on, how long the wires can be, why ground leads matter, and when the probe changes the circuit.',
  gpios: [],
  intro:
    'On the test bench, every signal is on a header pin and the wires are short. On a real board, you choose where to connect, and that choice affects how clean your capture is, how fast you can go, and sometimes whether the circuit still works. A few rules cover nearly every situation.',
  sections: [
    {
      title: 'Where to connect',
      body: ['In order of preference, from easiest and safest to most fiddly:'],
      bullets: [
        '**Header pins and connectors.** Debug headers, pin headers and connector pins take a standard jumper wire or clip and cannot be shorted by a slipping hook as easily.',
        '**Test pads and test points.** Many boards have round pads labeled TP1, TP2 and so on, or with a signal name. A spring-loaded pogo pin or a small hook holds on them well.',
        '**Through-hole component legs.** Resistor and connector legs on the back of the board are easy to grab, and the far side of a series resistor often carries the same signal as a chip pin.',
        '**Chip legs.** Use a grabber made for that pin pitch, or a clip that fits over the whole chip (they exist for common packages such as SOIC-8). Check that it is not touching two legs.',
        '**A soldered wire.** For anything you will capture more than once, solder a thin wire to a pad or leg and connect the analyzer to that. It is the most reliable connection there is.',
      ],
    },
    {
      title: 'Ground leads',
      body: [
        'Every signal returns through ground. A long ground lead, or a single ground for many signals far away, adds inductance to that path, and fast edges ring as a result. The analyzer sees the ringing as extra edges or glitches that are not on the board.',
        'Keep at least one ground lead close to the signals you capture, and add more on fast signals: some analyzers have a ground next to each input for that reason. For signals up to a few megahertz, one good ground near the signals is enough. For tens of megahertz, a ground for every one or two signals and wires of a few centimeters make the difference between clean edges and noise.',
      ],
    },
    {
      title: 'Wire length',
      body: [
        'Long wires add capacitance and pick up noise. For slow signals (UART, I²C at standard speed, a button) half a meter is fine. For fast ones (SPI at tens of megahertz, a 25 MHz pixel clock) keep the wires as short as you can, and avoid running a fast clock next to a slow input in the same flat cable: it couples into its neighbors. In a flat cable, a ground wire between fast signals helps.',
      ],
    },
    {
      title: 'The probe changes the circuit',
      body: [
        'An analyzer input is not invisible: it adds a few picofarads of capacitance, plus the wire, and some inputs have a weak pull-down resistor. On a strong, fast signal this does not matter. On a weak one, it can.',
      ],
      bullets: [
        '**Crystals and oscillator pins.** Never probe a crystal directly: the added capacitance can shift its frequency or stop it, and the signal is analog anyway. Probe a clock output pin, if the chip has one.',
        '**Weak pull-ups.** A line held high by a large resistor (100 kΩ and up) rises more slowly with a probe on it, and a pull-down inside the analyzer can even hold it low. If a circuit stops working when you connect the analyzer, this is the usual cause.',
        '**High-impedance analog nodes.** Sensor outputs, filter nodes and reference voltages are not logic signals. Leave them to a meter or a scope.',
      ],
    },
    {
      title: 'Keep a record',
      body: [
        'Write down, or photograph, which analyzer input goes to which signal before you start. Name the channels in your software the same way. Ten captures later, a capture labeled "SCL" and "SDA" is useful; one labeled with input numbers that were swapped halfway through is not.',
      ],
    },
  ],
  parts: [],
  questions: [
    {
      q: 'A 20 MHz SPI clock shows short extra pulses after most edges. The ground lead is 30 cm long and clipped to a ground point at the other end of the board. What do you try first?',
      a: 'A short ground lead connected right next to the SPI signals. A long ground path makes fast edges ring, and the ringing crosses the threshold as extra pulses. If the pulses disappear, the board was fine all along.',
    },
    {
      q: 'A circuit works, but stops working as soon as you connect the analyzer to one of its lines. Why?',
      a: 'The probe is loading the circuit. The usual causes are a weak pull-up that cannot fight the analyzer\'s input capacitance or pull-down, or a probe on an oscillator or analog node. Probe somewhere stronger (the driving chip\'s output, the other side of a resistor) or check whether your analyzer has a pull-down you can turn off.',
    },
    {
      q: 'You need to watch a chip\'s SPI flash many times over a week of debugging. How do you connect?',
      a: 'Solder thin wires to the flash pins or nearby pads once, and bring them to a small header. Repeatedly clipping onto chip legs wears the clip, risks shorts, and gives a different connection every time.',
    },
  ],
};
