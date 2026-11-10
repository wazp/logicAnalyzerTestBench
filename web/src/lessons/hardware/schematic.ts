// Real hardware: reading a schematic to find the signals worth capturing and the places to clip on.
// Reading only.

import type { Lesson } from '../types';

export const schematic: Lesson = {
  id: 'schematic',
  track: 'hardware',
  title: 'Reading a schematic for the signals you need',
  summary: 'Net names, connectors, test points and pull-ups: how to find a bus in a schematic and every place on the board you can probe it.',
  gpios: [],
  intro:
    'When a board comes with a schematic, use it before you clip anything on. It tells you which signals exist, what they are called, which voltage they run at, and every point on the board where you can reach them. You do not need to understand the whole circuit: you are looking for a few nets and the places they come to the surface.',
  sections: [
    {
      title: 'Nets, not wires',
      body: [
        'A schematic shows connections, not layout. Everything joined by a line, or carrying the same **net label** (a name like `I2C_SDA` or `UART0_TX` written on a wire), is one electrical point: the same signal, wherever you touch it. Large schematics split over several pages and connect them only by matching labels, so search the PDF for the name rather than following lines.',
        'Labels can differ slightly between pages or sheets (`SDA`, `I2C1_SDA`, `SDA_3V3`). A label with a voltage in it often means the same signal on the other side of a level shifter: a different net with a different voltage.',
      ],
    },
    {
      title: 'The symbols that matter here',
      body: [],
      bullets: [
        '**Ground** (a downward triangle or a stack of shrinking lines, sometimes `GND`, `AGND` or `DGND`): your analyzer ground goes to this. Separate analog and digital grounds usually meet somewhere; the digital one is the right reference for logic signals.',
        '**Power rails** (an arrow or bar with a name like `3V3`, `VCC`, `VDD_IO`): tell you which voltage a chip runs at, so you know its logic levels and whether your analyzer can take them.',
        '**Reference designators**: `R12` is a resistor, `C4` a capacitor, `U3` a chip, `J1` a connector, `TP5` a test point, `D2` a diode or LED. The same names are printed on the board (the silkscreen), which is how you find the part on the real board.',
        '**Pin numbers** next to a chip or connector: the physical pin. Find pin 1 on the board by its marking (a dot, a notch, a square pad).',
        '**No-connect** (a small cross on a pin): nothing there. Do not expect a signal.',
      ],
    },
    {
      title: 'Finding a bus',
      body: [],
      bullets: [
        '**I²C:** two nets usually named SDA and SCL, each with a pull-up resistor to a power rail (typically 1 kΩ to 10 kΩ). The resistor value and rail tell you the voltage and how slow the rising edges will be.',
        '**SPI:** a clock (SCK or SCLK), data in each direction (MOSI/MISO, SDI/SDO, or COPI/CIPO), and one chip select per device (CS, SS, often with a bar or `_N` for active low). The chip select nets tell you how many devices share the bus, and which one is which.',
        '**UART:** TX and RX, named from one chip\'s point of view. The TX of the microcontroller connects to the RX of the other chip; a net named `TX` may be the one carrying data into the chip you care about. Check which pin of which chip it lands on.',
        '**Debug headers:** a small connector labeled SWD, JTAG or DEBUG, often with SWDIO and SWCLK, and a UART console next to it.',
      ],
    },
    {
      title: 'Where to clip on',
      body: [
        'Every point on a net carries the same signal, so pick the one that is easiest and safest to reach:',
      ],
      bullets: [
        '**Test points** (`TP`): put there for exactly this.',
        '**Connector pins** (`J`): a header or a cable connector carrying the bus.',
        '**The pad of a pull-up resistor or a series resistor:** on SDA, SCL or a data line, the resistor end that connects to the net is a large, easy target. A series resistor has the signal on both ends, slightly different: the end at the receiving chip shows what it sees.',
        '**A chip pin:** the last resort. Fine-pitch pins are easy to short together with a probe clip.',
      ],
    },
  ],
  parts: [],
  questions: [
    {
      q: 'A schematic page shows `SENSOR_SDA` going into a box labeled `U7 PCA9306`, and `SDA` coming out of the other side. You want to see what the microcontroller sends. Which net do you probe?',
      a: 'The PCA9306 is an I²C level shifter, so the two sides are different nets at different voltages. Find which side connects to the microcontroller (follow the label to its pin), check that side\'s supply voltage, and probe there. The other side shows the same traffic at the sensor\'s voltage.',
    },
    {
      q: 'The I²C nets have no test points, but the schematic shows `R21` and `R22`, 4.7 kΩ, from SDA and SCL to 3V3. How does that help?',
      a: 'Those are the pull-ups: one end of each is on SDA or SCL. Find R21 and R22 on the silkscreen and clip onto the end that is not on the 3V3 rail (measure with a multimeter if unsure: the rail end reads 3.3 V all the time). Ground goes to any GND point.',
    },
  ],
};
