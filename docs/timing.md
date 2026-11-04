# Timing, precision and limitations

## Clock source

Everything is derived from `clk_sys`, which the Pico SDK sets to **150 MHz** on the RP2350 (from the board's 12 MHz crystal through the PLL). One clock cycle is 6.67 ns. The firmware reads the real `clk_sys` at startup with `clock_get_hz()`, so if the system clock is ever changed the cycle counts are recalculated automatically.

**Accuracy** of every output is the accuracy of the crystal, typically within a few tens of ppm. Check the Pico 2 W datasheet if you need the exact figure. A 1 kHz output that is 30 ppm off is 1000.03 Hz, well below what most hobby analyzers can resolve.

**Jitter** is effectively zero. No signal depends on interrupts, timers or CPU code after startup. Edges always land on a `clk_sys` edge.

**Wi-Fi does not affect the signals.** The radio and web server run on the CPU and in PIO2, while the signals run in PIO0, PIO1, the PWM slices and their own DMA channels. Wi-Fi starts only after the signals are running, and if it fails the signals keep going.

## Square waves (GP0 to GP5): PIO

Program: [src/hw/square_wave.pio](../src/hw/square_wave.pio). Each output has its own state machine running at the full 150 MHz.

- High time = `Y + 2` cycles, low time = `ISR + 2` cycles (the 2 is the `mov` plus the final `jmp`).
- Period is rounded to the nearest whole cycle. If 150 MHz divided by your frequency is not a whole number, the actual frequency differs slightly and the console shows it.
- All six defaults divide evenly, so they are exact: for example 1 Hz is 75,000,000 cycles high and 75,000,000 low.

| Limit | Value at 150 MHz |
|---|---|
| Highest frequency | 37.5 MHz (2 cycles high, 2 low) |
| Lowest frequency | about 0.0175 Hz at 50% duty (32-bit loop counter per phase) |
| Duty cycle resolution | 1 cycle (6.67 ns) |
| Shortest high or low phase | 2 cycles (13.3 ns) |

Near the top end, frequency steps get coarse. For example, 7 MHz is not reachable: it rounds to 21 cycles, giving 7.142857 MHz.

### Why not PWM for these pins?

The RP2350 PWM block pairs GPIOs into slices: GP0/GP1 share slice 0, GP2/GP3 share slice 1, GP4/GP5 share slice 2. Both pins of a slice always run at the same frequency, so 1 Hz and 10 Hz on GP0/GP1 is impossible with PWM. PIO has one independent state machine per pin and avoids the problem.

## PWM duty pair (GP6, GP7) and pulse (GP8): hardware PWM

GP6 and GP7 are the A and B channels of slice 3. They always share a frequency, but each has its own duty cycle. GP8 uses slice 4 so its frequency is independent. Slice 4 channel B (GP9) is not used by PWM, because GP9 is driven by PIO.

The PWM counter is 16 bits. The firmware picks the **smallest integer clock divider** that fits the period into 16 bits, which gives the finest duty resolution. Fractional dividers are deliberately not used because they make the period jitter by one count.

| Frequency | Divider | Counter clock | Duty resolution |
|---|---|---|---|
| 100 kHz | 1 | 150 MHz | 1/1500 (0.067%) |
| 10 kHz | 1 | 150 MHz | 1/15000 |
| 1 kHz (default) | 3 | 50 MHz | 1/50000, 20 ns steps |
| 10 Hz | 229 | 655 kHz | approximate frequency (10.000028 Hz) |

Lowest PWM frequency is about 9 Hz (divider 255). For slower signals, use a PIO square wave instead.

The default GP8 pulse is 1 us wide (50 counts at 50 MHz), exact. Pulse widths are rounded to the counter clock, and a width too short to resolve is clamped to one count so the pulse never disappears.

## Irregular pattern (GP9): PIO plus DMA

Program: [src/hw/pattern.pio](../src/hw/pattern.pio). The pattern is a list of `(level, duration)` segments in [src/signal_config.h](../src/signal_config.h). Each segment becomes one 32-bit word:

```
bit 0       pin level
bits 31..1  loop count, segment length = count + 3 cycles
```

Two chained DMA channels stream the words into the state machine forever: the data channel copies the words, then triggers a control channel that rewinds the data channel to the start. No CPU involvement.

| Limit | Value at 150 MHz |
|---|---|
| Shortest segment | 3 cycles (20 ns) |
| Longest segment | about 4.29 s (duration is a 32-bit nanosecond value) |
| Maximum segments | 64 (buffer size in pattern_output.cpp) |
| Segment resolution | 1 cycle (6.67 ns) |

Durations are given in nanoseconds and rounded to the nearest cycle. The default pattern is exactly 150,000 cycles (1 ms).

The timing assumes the TX FIFO never runs dry. With an 8-entry FIFO and DMA refilling it, this holds for any realistic pattern. A pattern made entirely of minimum-length 20 ns segments would be the stress case and has not been measured on hardware.

## Protocol signals (GP10 to GP22): one PIO timeline

Program: [src/hw/timeline.pio](../src/hw/timeline.pio). One state machine (PIO1 SM3) drives all 13 protocol pins. At boot the firmware computes a 120 ms frame of traffic ([src/core/protocol_frame.cpp](../src/core/protocol_frame.cpp)) and turns it into a list of words ([src/core/timeline.cpp](../src/core/timeline.cpp)); two chained DMA channels then play that list forever with no CPU involvement.

- Each word holds the level of all 13 pins and a duration of `count + 3` cycles. Pins that change together change on the same cycle.
- Edges are placed per bit from the start of each transaction (`start + k × bit time`, rounded to the nearest cycle), so the average rate is exact and each edge is within half a cycle (3.3 ns) of ideal. UART at 115200 baud: 1302.08 cycles per bit, so bits are 1302 or 1303 cycles and the average is exact.
- A word lasts at least 3 cycles. When edges on different pins fall 1 or 2 cycles apart, the later one is delayed to keep that minimum: at most 2 cycles (13 ns). With the defaults no edge needs to move.
- A word lasts at most about 3.5 ms (19-bit count); longer idle stretches use several words with the same levels.
- The default frame is about 7,500 words (30 KB of RAM), with room for about twice that. The firmware refuses to start if a configuration does not fit.

| Protocol | Timing | Precision |
|---|---|---|
| UART | 115200 baud, 8N1 | bit edges within 0.5 cycle; average baud exact |
| I²C | 100 kHz, 50% clock | SDA changes in the middle of SCL low |
| SPI | 1 MHz, mode 0 | 75 cycles per half clock, exact |
| WS2812 | 1.25 µs bits, 0.4/0.8 µs pulses | 187 or 188 cycles per bit, pulses exactly 60 and 120 cycles |
| 1-Wire | standard speed, 70 µs slots | exact (whole µs) |
| NEC IR | 562.5 µs units | exact (84,375 cycles) |
| Quadrature | 1 ms per step | exact |

Recommended sample rates for every protocol are in its lesson. All of them stay at or below 24 MS/s.

## Start alignment

All PIO state machines (PIO0 and PIO1) are enabled on the same clock cycle with `pio_enable_sm_multi_mask_in_sync`, so the square waves, the pattern and the protocol frame share t = 0. The two PWM slices start together on an earlier cycle. PWM and PIO edges are therefore offset by a few cycles (tens of nanoseconds), which is fine for learning but visible at very high sample rates.

## Choosing an analyzer sample rate

Rule of thumb: sample at least 4 times faster than the fastest signal you look at, and fast enough that the shortest pulse spans several samples.

| You want to see | Minimum sample rate | Comfortable |
|---|---|---|
| GP0 to GP3 (up to 1 kHz) | 10 kS/s | 100 kS/s |
| GP4 (10 kHz) | 100 kS/s | 1 MS/s |
| GP5 (100 kHz) | 1 MS/s | 4 MS/s or more |
| GP8 1 us pulse | 4 MS/s | 16 MS/s or more |
| GP9 1 us segments | 4 MS/s | 16 MS/s or more |

To see the full 1 Hz period on GP0 you need a capture at least 1 s long, so combine a long capture with a moderate sample rate, or use the analyzer's compressed/streaming mode if it has one.

A common exercise: capture GP5 (100 kHz) at 200 kS/s and watch it alias. Then raise the sample rate until it looks right.

## Notes for future modes

- **5V systems (C64):** The Commodore 64 bus is 5V TTL. 3.3V outputs are usually read as high by TTL inputs (threshold about 2.0V), but anything driving back into the Pico must be level shifted. Plan for level shifters before connecting to real hardware.
- **RP2350 erratum E9:** GPIO inputs with the internal pull-down enabled can latch high. It does not affect outputs, but matters once inputs are added (for example clock inputs or bus snooping). Use external pull-downs if needed.
- **PIO capacity:** PIO0 and PIO1 are full (4 state machines each; PIO1 SM3 plays the protocol timeline). The CYW43 Wi-Fi driver takes the first PIO with a free state machine, which is therefore PIO2. PIO2 has three state machines left.
- **More protocols** don't need more state machines: add an encoder in `src/core/protocols/` and a slot in the protocol frame. Only signals that must run independently of the 120 ms frame (for example VGA video) need their own state machine or a preset that replaces the frame.
