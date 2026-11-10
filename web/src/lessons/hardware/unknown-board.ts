// Real hardware: finding ground, power and the interesting signals on a board without a schematic.
// Pinouts are the industry-standard ones for these packages and headers. Reading only.

import type { Lesson } from '../types';

export const unknownBoard: Lesson = {
  id: 'unknown-board',
  track: 'hardware',
  title: 'Finding signals on an unknown board',
  summary: 'Ground, power, debug headers, flash chips and serial ports: where to look first when there is no schematic.',
  gpios: [],
  intro:
    'Sooner or later you will want to look inside something without documentation: a gadget whose serial console you want to read, a module that talks to its sensor, an old board you are repairing. The work is mostly detective work with a multimeter and the chip markings, and the analyzer comes in once you know where to look. Only do this on hardware you own or are allowed to examine.',
  sections: [
    {
      title: 'Ground and power first',
      body: ['Everything else is measured against ground, so find it first, with continuity mode on a multimeter, board unpowered.'],
      bullets: [
        '**Ground** is almost always the large copper areas, the metal shells of USB and other connectors, mounting holes with plated rings, and the negative side of electrolytic capacitors (marked with a stripe).',
        '**Supplies** are at the outputs of voltage regulators (small three-pin or five-pin chips near the power input) and on the large capacitors next to them. Measure them powered: they tell you the logic level of everything nearby.',
        '**Silkscreen labels** are free information: GND, VCC, 3V3, TX, RX, SDA, SCL, CLK, CS, MOSI, MISO, SWDIO, SWCLK, RST, BOOT, and test points named TP1, TP2 and so on.',
      ],
    },
    {
      title: 'Look for these headers',
      body: ['Unpopulated rows of holes or pads near the main chip are usually there for debugging during production.'],
      table: {
        title: 'Common debug connections',
        head: ['What', 'Pins', 'How to recognize it'],
        rows: [
          ['Serial console (UART)', 'Usually 3 or 4: GND, TX, RX, sometimes VCC', 'TX idles high and bursts with activity right after power-on. RX idles high (pulled up) and stays quiet.'],
          ['ARM SWD (10-pin, 1.27 mm)', '1 VTref, 2 SWDIO, 3 and 5 GND, 4 SWCLK, 6 SWO, 10 reset', 'A 2 x 5 header with small pitch near an ARM microcontroller'],
          ['ARM SWD (bare pads)', 'Often GND, SWDIO, SWCLK, VCC', 'Usually labeled. Quiet unless a debugger is connected.'],
          ['JTAG (classic 20-pin, 2.54 mm)', 'Many grounds, TCK, TMS, TDI, TDO', 'A 2 x 10 header; one whole row is mostly ground'],
        ],
      },
    },
    {
      title: 'Read the chips',
      body: [
        'The markings on a chip, typed into a search engine with the word "datasheet", usually give you its pinout. Two kinds are worth knowing by heart, because they are everywhere and their pinouts are standard:',
      ],
      table: {
        title: 'Two standard 8-pin chips',
        head: ['Chip', 'Pinout', 'What you can capture'],
        rows: [
          ['SPI flash (25-series, SOIC-8)', '1 CS, 2 DO (MISO), 3 WP, 4 GND, 5 DI (MOSI), 6 CLK, 7 HOLD, 8 VCC', 'Every byte the processor reads at boot: commands like `0x03` or `0x0B` and addresses'],
          ['I²C EEPROM (24-series, SOIC-8)', '1 to 3 address pins, 4 GND, 5 SDA, 6 SCL, 7 WP, 8 VCC', 'Settings and calibration reads at device address `0x50` to `0x57`'],
        ],
      },
    },
    {
      title: 'Find the active pins',
      body: [
        'Once you have candidate pins, the analyzer finds which ones carry anything. Connect ground and as many inputs as you have to the candidates, start a long capture at a low sample rate (a few seconds at around 1 MS/s), and power the board on during the capture. Boot is when most boards talk the most: the serial console prints, the flash is read, sensors are configured.',
        'Then zoom in on the pins that moved. The "What is this signal?" lesson in the Learn track walks through recognizing a protocol from its shape: a clock line next to a data line suggests I²C or SPI, lone bursts with idle-high gaps suggest UART, and the bit width gives you the baud rate.',
      ],
    },
    {
      title: 'Keep notes as you go',
      body: [
        'Write down every pin you identify, with its voltage and what it carried. A photo of the board with labels drawn on it saves you from measuring everything again next week, and turns into the schematic the board never came with.',
      ],
    },
  ],
  parts: [],
  questions: [
    {
      q: 'A row of four unlabeled pads sits near the main chip. With the board powered: pad 1 is 0 V and beeps to the USB shell, pad 2 is 3.3 V steady, pad 3 is 3.3 V but your meter flickers at power-on, pad 4 is 3.3 V steady. What is it, probably?',
      a: 'A serial console. Pad 1 is ground. Pad 3 flickers because it is TX, sending boot messages (a meter averages the bits into a dip). Pads 2 and 4 are VCC and RX, which also idles high. Connect the analyzer to pad 3 with ground on pad 1, capture during power-on, and measure the bit width to find the baud rate. To tell pads 2 and 4 apart, a supply pin measures a few ohms or less to the regulator output when unpowered; RX does not.',
    },
    {
      q: 'You captured the CS, CLK and DI pins of an 8-pin SPI flash at boot. The first byte after each CS falls is `0x03`. What is the processor doing?',
      a: 'Reading data: `0x03` is the standard "read data" command for SPI flash. The next three bytes on DI are the address, and the data comes back on DO (pin 2), which you would need to capture as well to see what was read.',
    },
  ],
};
