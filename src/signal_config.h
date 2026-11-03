// Default signal settings. Edit this file to change frequencies, duty cycles
// or the irregular pattern. Every value is validated at startup and the
// actual (rounded) result is printed on the USB serial console.
//
// Kept free of Pico SDK includes so host tests can check the defaults.

#pragma once

#include <cstddef>
#include <cstdint>

#include "board_pins.h"
#include "core/timing.h"

namespace config {

// One PIO state machine per square wave, so every pin gets an independent
// frequency. PIO2 is left free for the CYW43 driver or future modes.
struct SquareSignalConfig {
    unsigned pin;
    const char* name;
    unsigned pio_index;  // 0 = pio0, 1 = pio1
    unsigned sm;         // State machine 0-3 inside that PIO block
    double freq_hz;
    double duty_percent;
};

inline constexpr SquareSignalConfig kSquareSignals[] = {
    {pins::kSquare1Hz, "1 Hz square", 0, 0, 1.0, 50.0},
    {pins::kSquare10Hz, "10 Hz square", 0, 1, 10.0, 50.0},
    {pins::kSquare100Hz, "100 Hz square", 0, 2, 100.0, 50.0},
    {pins::kSquare1kHz, "1 kHz square", 0, 3, 1000.0, 50.0},
    {pins::kSquare10kHz, "10 kHz square", 1, 0, 10000.0, 50.0},
    {pins::kSquare100kHz, "100 kHz square", 1, 1, 100000.0, 50.0},
};

// GP6/GP7 share PWM slice 3, so they share a frequency but have their own duty.
struct PwmPairConfig {
    unsigned pin_a;
    unsigned pin_b;
    const char* name_a;
    const char* name_b;
    double freq_hz;
    double duty_a_percent;
    double duty_b_percent;
};

inline constexpr PwmPairConfig kPwmPair = {
    pins::kPwm25, pins::kPwm75, "PWM 25% duty", "PWM 75% duty", 1000.0, 25.0, 75.0,
};

// GP8: short high pulse once per period, handy for practicing edge triggers.
struct PulseConfig {
    unsigned pin;
    const char* name;
    double freq_hz;
    uint32_t high_ns;
};

inline constexpr PulseConfig kPulse = {pins::kPulse, "1 us pulse every 1 ms", 1000.0, 1000};

// GP9: an irregular, repeating sequence of high/low segments played by PIO
// and fed by DMA. Total period is exactly 1 ms. Good for practicing
// "find this exact pulse" triggers and measuring individual widths.
inline constexpr timing::PatternSegment kPatternSegments[] = {
    {true, 10000},  // 10 us high (frame start marker)
    {false, 5000},  //  5 us low
    {true, 20000},  // 20 us high
    {false, 2000},  //  2 us low
    {true, 1000},   //  1 us high
    {false, 1000},  //  1 us low
    {true, 1000},   //  1 us high
    {false, 50000}, // 50 us low
    {true, 3000},   //  3 us high, then a 3-3-3 burst
    {false, 3000},
    {true, 3000},
    {false, 3000},
    {true, 3000},
    {false, 895000},  // idle low for the rest of the 1 ms frame
};

constexpr size_t kPatternSegmentCount = sizeof(kPatternSegments) / sizeof(kPatternSegments[0]);
constexpr const char* kPatternName = "irregular pattern, 1 ms";

// The pattern state machine lives next to the 10 kHz and 100 kHz square waves.
constexpr unsigned kPatternPioIndex = 1;
constexpr unsigned kPatternSm = 2;

}  // namespace config
