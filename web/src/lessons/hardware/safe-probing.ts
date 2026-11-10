// Real hardware: what can go wrong when an analyzer meets a circuit that is not the test bench, and the
// habits that prevent it. Reading only.

import type { Lesson } from '../types';

export const safeProbing: Lesson = {
  id: 'safe-probing',
  track: 'hardware',
  title: 'Before you clip on',
  summary: 'Ground loops, mains-powered devices, slipping clips and powered-off targets: how analyzers and boards actually get damaged.',
  gpios: [],
  intro:
    'The test bench is the easiest circuit you will ever probe: 3.3 V, one ground, powered from the same computer as the analyzer. Real boards are not always that friendly. Almost every damaged analyzer or board comes from one of a handful of situations, and all of them are avoided by a few habits that take seconds. This lesson is about those habits; the "Voltage levels and thresholds" lesson covers the input voltages themselves.',
  sections: [
    {
      title: 'Your ground lead is connected to your computer',
      body: [
        'A USB analyzer\'s ground is the computer\'s ground. On a desktop, and on a laptop while it is charging from a grounded supply, that is also the mains earth. Clipping the ground lead onto a circuit connects that circuit\'s ground to your computer\'s.',
        'For a board powered from the same computer, or from a battery, that is harmless. For a board whose ground sits at a different voltage, it is a short circuit through the ground lead, the analyzer and the USB cable. A big enough current burns the lead, the analyzer or the USB port, and sometimes the board.',
      ],
      bullets: [
        '**Safe:** a board powered by USB from the same computer, by a battery, or by an isolated wall adapter (the usual phone-charger type).',
        '**Check first:** a board powered by a second computer, a bench supply with its output tied to earth, or anything with its own mains cable. Measure the voltage between the board\'s ground and the analyzer\'s ground with a multimeter before connecting them. Near 0 V, AC and DC, is what you want.',
        '**Never:** anything that is not isolated from the mains. Mains LED bulbs, cheap capacitive power supplies, motor and heater controllers, and the primary side of any power supply can have their "ground" at mains voltage. A logic analyzer is the wrong tool there; this needs isolated equipment and training.',
      ],
    },
    {
      title: 'The usual way boards die: a slipping clip',
      body: [
        'Most damage is mechanical, not electrical. A hook slips off a chip leg while the board is powered and lands across two pins, shorting the supply to a signal or to ground. On a fine-pitch chip the legs are half a millimeter apart, and one wobble is enough.',
      ],
      bullets: [
        '**Power off while attaching.** Clip on, check every clip, then power up.',
        '**Ground first, ground last.** Connect ground before any signal, and remove it after the signals. A floating analyzer input on a powered board is harmless; a powered signal lead touching the wrong pin before ground is connected is not.',
        '**Strain relief.** Tape or tie the leads down so a tug on the cable does not pull a clip sideways.',
        '**Prefer header pins and test pads** over chip legs. When you must use a chip leg, a proper grabber made for that pitch, or a thin wire soldered on, is far safer than a large hook.',
      ],
    },
    {
      title: 'Powered-off targets and back-powering',
      body: [
        'Chips have protection diodes from each input to their supply. When a signal is high on a pin of a chip that has no power, current flows through that diode and partly powers the chip, and through it, everything on its supply rail. This is back-powering: the board half-runs from your signal, behaves strangely, and the diodes are not rated for it.',
        'An analyzer only listens, so it does not back-power anything by itself. It happens when something else drives a powered-off board: a second board, a USB-to-serial adapter, or a signal generator. When you combine boards for a test, power them up and down together, and connect grounds first.',
      ],
    },
    {
      title: 'Measure before you connect',
      body: ['A multimeter is the cheapest insurance in electronics. Thirty seconds with it before connecting an analyzer to an unknown board answers the questions that matter.'],
      table: {
        title: 'The thirty-second check',
        head: ['Measure', 'With', 'Looking for'],
        rows: [
          ['Each pin you will probe, against the board\'s ground, powered', 'DC volts', 'Nothing above your analyzer\'s input rating, nothing negative'],
          ['The same pins', 'AC volts', 'Close to 0: large AC means mains-referenced or very noisy'],
          ['Board ground to analyzer ground, both powered, not connected', 'AC and DC volts', 'Close to 0 V, so connecting them is safe'],
          ['Ground pin to the ground you think it is', 'Continuity', 'A beep, so the "ground" really is ground'],
        ],
      },
    },
    {
      title: 'A checklist to keep',
      body: [],
      bullets: [
        'Is the board isolated from the mains, or powered from a battery or USB?',
        'Have I measured every pin I will probe, and are they all within my analyzer\'s input range?',
        'Is the board off while I attach the clips?',
        'Is ground connected first, and close to the signals?',
        'Are the leads secured so they cannot be pulled sideways?',
        'Do I own this board, or have permission to probe it?',
      ],
    },
  ],
  parts: [],
  questions: [
    {
      q: 'You want to watch the UART of a device powered by its own desktop PC, from your laptop. Your laptop is on its charger. What do you do first?',
      a: 'Measure the voltage between the device\'s ground and your laptop\'s USB ground (the shell of a USB port) with a multimeter, before connecting anything. Two grounded computers usually agree to within a fraction of a volt, but a fault or a floating supply can put tens of volts between them. Running the laptop on battery for the test removes the question entirely.',
    },
    {
      q: 'After you clipped onto a powered board, it resets every time you touch the leads. Is the analyzer to blame?',
      a: 'Probably not the analyzer itself, but the connection. A missing or loose ground lets the leads pick up noise, and a hook touching a neighboring pin can briefly short a supply or reset line. Power off, check every clip with good light, connect ground first, and try again.',
    },
    {
      q: 'A board stays half-alive (an LED glows dimly) after you switch its power off. Why?',
      a: 'Something is still driving one of its pins, and the board is back-powering through its input protection diodes. Find what is connected (another board, a serial adapter) and power it down too. An analyzer on its own does not cause this, because its inputs only listen.',
    },
  ],
};
