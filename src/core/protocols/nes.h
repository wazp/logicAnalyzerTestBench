// NES controller read: the console pulses LATCH, then clocks 8 bits out of
// the controller's 4021 shift register.
//
//   LATCH  high for latch_cycles: the controller loads its buttons and shows
//          button A on DATA.
//   CLOCK  idles high; 8 low pulses after the latch. Each rising edge shifts
//          the next button onto DATA (B, Select, Start, Up, Down, Left, Right).
//   DATA   low = pressed (the buttons pull the inputs to ground). After the
//          8th rising edge the register has shifted in its grounded serial
//          input, so DATA stays low until the next latch. That is why reads
//          past the 8th bit return "pressed" on an original controller.

#pragma once

#include <cstdint>

#include "core/wave.h"

namespace proto {

struct NesPins {
    wave::PinWave& latch;
    wave::PinWave& clock;
    wave::PinWave& data;
};

struct NesTiming {
    double latch_cycles;
    double first_clock_cycles;  // From the end of the latch pulse to the first falling clock edge.
    double clock_period_cycles; // Low for the first half of each period.
};

constexpr const char* kNesButtonNames[8] = {"A", "B", "Select", "Start", "Up", "Down", "Left", "Right"};

// One read starting at cycle `start`. `buttons` bit n = button n pressed
// (kNesButtonNames order). LATCH must be low, CLOCK high. Returns the cycle
// of the last rising clock edge.
double nes_read(NesPins pins, double start, const NesTiming& t, uint8_t buttons);

}  // namespace proto
