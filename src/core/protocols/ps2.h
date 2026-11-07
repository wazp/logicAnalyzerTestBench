// PS/2 keyboard to computer: the keyboard drives both CLOCK and DATA (open
// collector, idle high). Each byte is 11 bits: a start bit (0), 8 data bits
// LSB first, odd parity and a stop bit (1). The keyboard changes DATA while
// CLOCK is high; the computer reads it on the falling edge.
//
// Per bit (period T): DATA changes at the start, CLOCK falls at T/4 and rises
// at 3T/4, so DATA is stable for T/4 before and T/2 after each falling edge.

#pragma once

#include <cstdint>

#include "core/wave.h"

namespace proto {

struct Ps2Pins {
    wave::PinWave& clock;
    wave::PinWave& data;
};

// Scan code set 2 prefix that turns the next make code into a key release.
constexpr uint8_t kPs2Break = 0xF0;

// Sends one byte starting at cycle `start`. Both pins must be idle high.
// Returns the cycle where the byte ends (11 bit periods, back to idle).
double ps2_write(Ps2Pins pins, double start, double sys_hz, uint32_t clock_hz, uint8_t byte);

inline bool ps2_parity(uint8_t byte) {
    unsigned ones = 0;
    for (unsigned b = 0; b < 8; ++b) ones += (byte >> b) & 1u;
    return ones % 2 == 0;  // Odd parity: the bit makes the total count of ones odd.
}

}  // namespace proto
