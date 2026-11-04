// UART (asynchronous serial) waveform: idle high, start bit low, data bits
// LSB first, optional parity, stop bit(s) high.
//
// Bit boundaries are placed at start + k * (sys_hz / baud), rounded per edge,
// so the average baud rate is exact and each edge is within half a cycle.

#pragma once

#include <cstddef>
#include <cstdint>

#include "core/wave.h"

namespace proto {

struct UartFormat {
    uint32_t baud = 115200;
    unsigned data_bits = 8;  // 5 to 8
    char parity = 'N';       // 'N', 'E' or 'O'
    unsigned stop_bits = 1;  // 1 or 2
};

// Writes `len` bytes back to back starting at cycle `start`. The pin must be
// idle high. Returns the cycle where the last stop bit ends.
double uart_write(wave::PinWave& pin, double start, double sys_hz, const UartFormat& format, const uint8_t* data,
                  size_t len);

// Bit time in cycles.
inline double uart_bit_cycles(double sys_hz, uint32_t baud) { return sys_hz / baud; }

}  // namespace proto
