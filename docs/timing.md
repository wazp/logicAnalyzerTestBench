# Timing, precision and limitations

## Clock source

Everything is derived from `clk_sys`, which the Pico SDK sets to **150 MHz** on the RP2350 (from the board's 12 MHz crystal through the PLL). One clock cycle is 6.67 ns. The firmware reads the real `clk_sys` at startup with `clock_get_hz()`, so if the system clock is ever changed the cycle counts are recalculated automatically.

**Accuracy** of every output is the accuracy of the crystal, typically within a few tens of ppm. Check the Pico 2 W datasheet if you need the exact figure. A 1 kHz output that is 30 ppm off is 1000.03 Hz, well below what most hobby analyzers can resolve.

**Jitter** is effectively zero. No signal depends on interrupts, timers or CPU code after startup. Edges always land on a `clk_sys` edge.

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

## Start alignment

All PIO state machines (PIO0 and PIO1) are enabled on the same clock cycle with `pio_enable_sm_multi_mask_in_sync`, so the square waves and the pattern share their first rising edge. The two PWM slices start together on an earlier cycle. PWM and PIO edges are therefore offset by a few cycles (tens of nanoseconds), which is fine for learning but visible at very high sample rates.

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
- **PIO capacity:** PIO0 is full (4 state machines). PIO1 has one free state machine. PIO2 is entirely free, but enabling Wi-Fi or the Pico 2 W LED (via the CYW43 driver) uses one PIO state machine and DMA.
