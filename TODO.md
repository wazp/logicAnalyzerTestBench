# TODO

Work we plan to do, roughly in priority order within each section. The README's [Roadmap](README.md#roadmap) is the short public version of the firmware items; keep the two in step when something lands or is dropped.

## Lessons

- [x] **Timing between two signals.** Measuring the delay from one signal to another: the UART reply after each TX message, MOSI changing relative to SCK, and the phase between quadrature A and B (which also gives the direction). Uses the Protocols preset; no firmware change.
- [ ] **When the decoder shows garbage.** The usual reasons a decode looks wrong, each shown on a real capture: I²C addresses written as 7-bit or shifted to 8-bit, the wrong SPI mode, LSB or MSB first, a wrong baud rate or inverted UART, and swapped clock and data lines. Pairs with the Faults preset below.
- [ ] **Glitch hunting.** Catching a rare, very short glitch: with a pulse-width trigger where the analyzer has one, otherwise by sampling fast enough and searching the capture. Needs the glitch pin (see Firmware).
- [ ] **What a logic analyzer can't show you.** A concepts lesson without captures: ringing, slow edges, runt pulses and bus contention all turn into clean-looking 0s and 1s (or extra edges). When the picture is lying, and when a scope is the right tool. Reuse the threshold diagram from "Voltage levels and thresholds".
- [ ] **Memory depth and long captures.** Why sample rate times length runs into the analyzer's buffer, what compression (RLE) does for quiet signals, and streaming vs buffered capture. Also that some software shows only part of a long capture at once.
- [ ] **Finding one event in a long recording.** Locating a single rare event (the I²C NAK from 0x49, the IR repeat code) in a long capture. Harder to keep analyzer neutral, since search features differ a lot between programs.
- [ ] **Exporting and scripting.** Saving a capture as CSV or VCD and processing it outside the analyzer software, for example a short script that measures every UART bit time. Most programs can export one of the two.
- [ ] **Optional: using sigrok protocol decoders.** Only for software that runs sigrok decoders (PulseView, sigrok-cli and some analyzer apps, the gusmanb LogicAnalyzer among them). Many analyzers support them, but not all, so:
  - Mark it clearly as optional in the lesson list and at the top of the lesson, with one line saying who can skip it ("if your software has no sigrok decoders, skip this lesson; nothing later depends on it").
  - Probably needs a small `optional` flag on `Lesson` so the list and the lesson page can show it, plus a lesson test that no other lesson links to it as a prerequisite.
  - Content: what a decoder is (a script that reads the channels you assign it), assigning channels and options, stacking decoders (UART into a higher-level decoder, I²C into a device decoder), and reading the annotation rows. Practice on the protocols the bench already plays.
  - Still analyzer neutral: no menu names, describe the steps in plain terms.

## Verify track

For people building or checking their own analyzer.

- [ ] **How fast can your analyzer really go?** One pin plays short bursts at stepped frequencies (for example 1, 5, 10, 25 and 37.5 MHz, all PIO-friendly divisions of 150 MHz) so you can see where the inputs stop following the signal, which is often well below the advertised sample rate. Needs a free pin (GP27).
- [ ] **Is your analyzer's clock accurate?** Measure the 1 Hz and 1 kHz signals over a long capture and work out the error in ppm. The Pico's crystal (about ±30 ppm) is the reference, so state that limit in the lesson. No firmware change.
- [ ] **Named presets for the Verify track**, for example a 24-input channel and skew test.

## Firmware and signals

- [ ] **"Faults" preset: find the bug.** The protocols the bench plays today are all perfect; real debugging starts from a broken one. A preset where each protocol misbehaves in a realistic way, each with a "here is the symptom, find the cause" lesson in the style of "What is this signal?":
  - I²C: a device that never ACKs, and one that stretches the clock.
  - UART: a sender a few percent off the baud rate, a framing error, a parity error.
  - SPI: CS rising in the middle of a byte, a device answering in the wrong SPI mode.
  - WS2812: one bit slightly too short, so one LED shows the wrong color.
  - Keep each fault deterministic and documented in the exporter, so the lessons compute their answers like every other lesson.
- [ ] **Glitch pin.** A rare, very short glitch (about 50 ns, a few times per second, not periodic) on a free pin (GP28), for the glitch hunting lesson.
- [ ] **"CPU bus" preset.** A 6502-style bus (PHI2, R/W, /RESET, a ROM select and D0-D7), read half the data bus per capture, with a lesson on state (clocked) capture.
- [ ] **Commodore IEC serial bus** on GP20-GP22, the pins the Video and input preset leaves free. Left out of 0.5.0 because the handshake is easy to simulate wrongly.
- [ ] **Protocol settings from the guide.** A few validated choices per protocol (for example a baud rate from a list), not free-form values.
- [ ] **More signals:** CAN, servo PWM, I2S audio, simulated Commodore 64 bus traffic.
- [ ] **USB drive next to the serial port,** with `WIFI.TXT` to set the network before first boot and `STATUS.TXT` showing the IP address.

GP27 and GP28 are the only free pins, so the speed test and the glitch pin use both of them. Anything after that needs a preset of its own.

## Guide

- [ ] **Progress tracking.** A checkmark per finished lesson, stored in the browser (localStorage), shown in the lesson list. Must keep working when storage is unavailable.

## Hardware checks

- [ ] **VGA on a real monitor** (8 color bars) with the README's resistor hookup. The sync timing and blanking were verified with an analyzer for 0.5.0; this was not blocking.
