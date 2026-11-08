// SPI mode 0 waveform with both sides simulated: the controller drives CS,
// SCK and MOSI; the target answers on MISO.
//
// Mode 0 (CPOL 0, CPHA 0): SCK idles low, both sides sample on the rising
// edge and change data on the falling edge. CS is active low and frames the
// whole transfer. Bytes go MSB first.

#pragma once

#include <cstddef>
#include <cstdint>

#include "core/wave.h"

namespace proto {

struct SpiPins {
    wave::PinWave& sck;
    wave::PinWave& mosi;
    wave::PinWave& miso;
    wave::PinWave& cs;
};

// Deliberate errors for the Faults preset.
struct SpiFaults {
    // CS rises after this many bits instead of after the last byte; 0 = never.
    unsigned stop_after_bits = 0;
    // A device set up for mode 1: it changes MISO this many cycles after each
    // rising SCK edge instead of on the falling edge, so a mode 0 controller
    // samples the previous bit. Negative = a correct mode 0 device.
    double miso_after_rise = -1.0;
};

// Transfers `len` bytes in one CS frame, MOSI and MISO in parallel. Starts at
// cycle `start` with CS falling. Returns the cycle where CS rises again.
// Afterwards MOSI idles low and MISO idles high (a released line with a
// pull-up, as on most boards).
double spi_transfer(SpiPins pins, double start, double sys_hz, uint32_t clock_hz, const uint8_t* mosi,
                    const uint8_t* miso, size_t len, const SpiFaults& faults = {});

}  // namespace proto
