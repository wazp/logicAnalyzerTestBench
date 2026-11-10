// Protocols track: what protocol decoders are, the families of them that analyzer software uses, and how
// to use them without being misled. For every reader; software specifics stay out. Reading only.

import type { Lesson } from '../types';

export const decoders: Lesson = {
  id: 'decoders',
  track: 'protocols',
  title: 'Protocol decoders',
  summary: 'What a decoder does, the decoder families most analyzer software uses, stacking, and why reading by hand still matters.',
  gpios: [],
  intro:
    'Every protocol lesson in this guide has you read the bytes by hand first. In daily work you will mostly let a protocol decoder do that: it turns edges into bytes, bytes into transactions, and shows them on top of the waveform. Decoders are one of the best features analyzer software has, as long as your software has them and you know when not to trust them.',
  sections: [
    {
      title: 'What a decoder does',
      body: [
        'A decoder reads the sampled inputs you assign to it and applies the rules of one protocol: where a byte starts, which edge to sample, where the address and data are. It shows its results as annotations above or below the waveform, and usually as a table you can search and export.',
        'It knows nothing you do not tell it. A UART decoder with the wrong baud rate, or an SPI decoder in the wrong mode, produces confident-looking nonsense. That is why the "When the decoder shows garbage" lesson follows this one.',
      ],
    },
    {
      title: 'Layers: stacking decoders',
      body: [
        'Good decoder systems work in layers. A low-level decoder turns the I²C wires into start, address, data and ACK. A decoder stacked on top of it knows one particular device: it turns "write `0x00`, read two bytes" into "temperature register: 25.0 °C". The same SPI decoder can feed a flash memory decoder, an SD card decoder or a display decoder.',
        'If your software stacks decoders, look for one that knows your device. It saves you from looking up every register in the datasheet.',
      ],
    },
    {
      title: 'The decoder families you will meet',
      body: ['Which decoders you have depends on your analyzer software, not on the analyzer hardware. In practice there are a few families:'],
      bullets: [
        '**The sigrok decoders.** An open-source library of well over a hundred decoders, from UART and I²C to CAN, SD cards, infrared remotes and many specific chips, all stackable. PulseView and sigrok-cli use it directly, DSView uses a version of it, and several analyzers\' own applications can load sigrok decoders as well. If your software mentions sigrok or libsigrokdecode, this is the set you have.',
        '**Built-in decoders of commercial software.** Some vendors ship their own decoders for the common protocols, often with a way to write your own extensions in a scripting language. They are usually polished, but the list of protocols and devices is whatever the vendor chose.',
        '**Decoders in scopes and mixed-signal instruments.** Many oscilloscopes decode serial buses on screen, usually a fixed list of common protocols, sometimes as a paid option.',
        '**No decoder at all.** Some simple or older software only shows the waveform. Everything in this guide still works: you read by hand, or export the samples and decode them with a short script, as the "Exporting and scripting" lesson shows.',
      ],
    },
    {
      title: 'Using one well',
      body: [],
      bullets: [
        '**Check one byte by hand** whenever you set up a decoder on a new bus. If your reading and the decoder agree, trust it for the rest.',
        '**Find the settings first:** baud rate and format, SPI mode, bit order, which input is which. The table in "Protocols at a glance" lists what each protocol needs.',
        '**Capture fast enough.** A decoder works on samples. A sample rate that barely resolves the bits makes it miss or invent bits at random, which looks like a protocol error.',
        '**Start the capture before the traffic.** A decoder that starts in the middle of a byte or a frame needs a moment to find its place, and the first result is often wrong.',
        '**Use the table and search.** Finding "every NAK" or "every write to register 0x10" in a decoder\'s result table is much faster than scrolling through the waveform.',
      ],
    },
    {
      title: 'Why read by hand at all?',
      body: [
        'Because the hand reading is what tells you a decoder is wrong. Decoders hide the things that do not fit their rules: a bit slightly too short, a glitch on the clock, an ACK that came too late, a frame that stops halfway. The "Find the bug" lessons are full of faults that a decoder either hides or reports in a misleading way. You need to see the waveform behind the annotation to catch them.',
      ],
    },
  ],
  parts: [],
  questions: [
    {
      q: 'Your software has a UART decoder, but it shows `0xFF` and framing errors for every byte of a message that a terminal program reads correctly. What do you check?',
      a: 'The decoder\'s settings and the sample rate, not the device: the terminal proves the data is fine. Measure one bit width to confirm the baud rate, check the data bits, parity and stop bits, and check that the decoder is not set to an inverted idle level.',
    },
    {
      q: 'Your analyzer\'s software can load sigrok decoders, and you are debugging an SPI flash. What does stacking give you?',
      a: 'An SPI decoder on the four wires, and a flash decoder stacked on it, which names the commands (read, write enable, page program, erase) and shows the addresses. Instead of looking up `0x03` and `0x06` in the datasheet, you read "Read data at 0x001000".',
    },
  ],
};
