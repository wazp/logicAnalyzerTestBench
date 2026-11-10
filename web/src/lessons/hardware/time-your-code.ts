// Real hardware: using a spare GPIO and the analyzer as a profiler for your own firmware: execution time,
// interrupt latency, jitter and state codes. Reading only.

import type { Lesson } from '../types';

const example = `// One spare pin, toggled around the code you want to time.
#define DEBUG_PIN 15

void setup_debug_pin(void) {
    gpio_init(DEBUG_PIN);
    gpio_set_dir(DEBUG_PIN, GPIO_OUT);
}

void read_sensor(void) {
    gpio_put(DEBUG_PIN, 1);   // rising edge: start
    // ... the code you want to measure ...
    gpio_put(DEBUG_PIN, 0);   // falling edge: done
}

// In an interrupt handler: the delay from the interrupt input's edge to this
// rising edge is your interrupt latency.
void on_data_ready(uint gpio, uint32_t events) {
    gpio_put(DEBUG_PIN, 1);
    // ... handle it ...
    gpio_put(DEBUG_PIN, 0);
}`;

export const timeYourCode: Lesson = {
  id: 'time-your-code',
  track: 'hardware',
  title: 'Timing your own code with a spare pin',
  summary: 'Toggle a GPIO around a function or interrupt, and the analyzer measures run time, latency and jitter to the nanosecond.',
  gpios: [],
  intro:
    'An analyzer is not only for buses. With one spare pin and two lines of code, it becomes a precise stopwatch for your own firmware: how long a function takes, how quickly an interrupt is handled, and how much that varies. It is one of the most useful tricks in embedded work, and it costs almost nothing.',
  sections: [
    {
      title: 'The idea',
      body: [
        'Set a spare pin high when something starts and low when it ends. The pulse width on the analyzer is the run time. Capture the pin together with the signals the code reacts to (an interrupt line, a chip-select, a UART line) and you see cause and effect on one time line.',
        'The example below uses Pico SDK calls; every platform has an equivalent. Writing a pin directly costs a few nanoseconds to a few hundred, depending on the platform: fast enough not to change what you measure in most cases. Printing a timestamp over a serial port, by contrast, takes far longer than most of the code it would measure.',
      ],
      code: example,
    },
    {
      title: 'What you can measure',
      body: [],
      bullets: [
        '**Run time:** the width of the pulse around a function.',
        '**Interrupt latency:** the time from the edge on the interrupt input to the rising edge your handler makes. Capture both pins.',
        '**Jitter:** capture many pulses (a long capture, or a script over an export) and look at the shortest and longest, not the average. A control loop that usually takes 50 µs but sometimes takes 900 µs is the real finding.',
        '**CPU load:** the share of time the pin is high, if it is high whenever the code is busy. That is a duty cycle measurement.',
        '**Order of events:** several pins, one per task or interrupt, show which ran when and what interrupted what.',
      ],
    },
    {
      title: 'More than one bit',
      body: [
        'With two or three spare pins, write a small number to them at each step of a state machine: 1 while connecting, 2 while reading, 3 while sending, and so on. The analyzer shows the state as a binary value over time, and many analyzers can display a group of inputs as one number. A pattern trigger on that number captures the moment the code enters a state you care about.',
        'If no pins are free, a pin with a slow or idle function (an LED, an unused chip-select) can serve while debugging. Just remember to remove the toggles afterwards.',
      ],
    },
    {
      title: 'Pitfalls',
      body: [],
      bullets: [
        '**The compiler may move your toggle.** Optimizers can reorder code around a pin write. If a measurement looks too short, check that the toggles are where you think, or put them around a function call that cannot be moved.',
        '**Slow pin functions.** Some platforms\' convenience functions take microseconds. Measure an empty pulse (high immediately followed by low) first: that is the overhead you subtract.',
        '**The measurement can hide the bug.** Adding code changes timing a little. If a timing bug disappears when you add toggles, that is itself a clue: the bug depends on timing.',
      ],
    },
  ],
  parts: [],
  questions: [
    {
      q: 'Your interrupt handler toggles a pin. The rising edge comes between 2 µs and 40 µs after the interrupt input changes, varying from capture to capture. What does that tell you?',
      a: 'The interrupt is sometimes delayed by something else: another interrupt with equal or higher priority, a section of code that disables interrupts, or a flash access that stalls the processor. The 2 µs is the real latency; the spread is what you need to explain. More debug pins on the other handlers show which one gets in the way.',
    },
    {
      q: 'An empty pulse (pin high, then immediately low) measures 1.2 µs. Your function\'s pulse measures 3.5 µs. How long does the function take?',
      a: 'About 2.3 µs: the empty pulse is the overhead of the two pin writes, which you subtract. With an overhead that large, look for a faster way to write the pin on your platform.',
    },
  ],
};
