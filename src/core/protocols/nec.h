// NEC infrared remote protocol, as it comes out of an IR receiver module
// (TSOP and similar): the 38 kHz carrier already removed, output active low,
// so a burst of IR is a low pulse and silence is high.
//
//   frame:   9 ms burst, 4.5 ms space, 32 bits, 562.5 us final burst
//   bit:     562.5 us burst, then 562.5 us space (0) or 1687.5 us (1)
//   order:   address, inverted address, command, inverted command; LSB first
//   repeat:  9 ms burst, 2.25 ms space, 562.5 us burst, sent every 108 ms
//            (frame start to frame start) while the button is held

#pragma once

#include <cstdint>

#include "core/wave.h"

namespace proto {

constexpr double kNecRepeatPeriodUs = 108000.0;

// Both return the cycle where the final burst ends. The pin must be idle high.
double nec_frame(wave::PinWave& pin, double start, double sys_hz, uint8_t address, uint8_t command);
double nec_repeat(wave::PinWave& pin, double start, double sys_hz);

}  // namespace proto
