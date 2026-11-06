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

// Transfers `len` bytes in one CS frame, MOSI and MISO in parallel. Starts at
// cycle `start` with CS falling. Returns the cycle where CS rises again.
// Afterwards MOSI idles low and MISO idles high (a released line with a
// pull-up, as on most boards).
double spi_transfer(SpiPins pins, double start, double sys_hz, uint32_t clock_hz, const uint8_t* mosi,
                    const uint8_t* miso, size_t len);

}  // namespace proto
