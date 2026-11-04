// WS2812 ("NeoPixel") LED data: one wire, idle low, 800 kHz. Every bit is a
// high pulse at the start of a 1.25 us slot; the pulse width is the bit:
//   0: 0.4 us high, then low      1: 0.8 us high, then low
// Each LED takes 24 bits in green, red, blue order, MSB first. A low gap
// (the reset, at least 50 us, 280 us on newer parts) latches the colors.

#pragma once

#include <cstddef>
#include <cstdint>

#include "core/wave.h"

namespace proto {

struct Ws2812Timing {
    double bit_ns = 1250.0;
    double t0h_ns = 400.0;
    double t1h_ns = 800.0;
};

struct Rgb {
    uint8_t r, g, b;
};

// Writes the colors of `count` LEDs starting at cycle `start`; the pin must be
// idle low. Returns the cycle where the last bit slot ends.
double ws2812_write(wave::PinWave& pin, double start, double sys_hz, const Ws2812Timing& timing, const Rgb* leds,
                    size_t count);

}  // namespace proto
