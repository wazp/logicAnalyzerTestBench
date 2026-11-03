// GPIO allocation for the Raspberry Pi Pico 2 W.
//
// This is the single source of truth for which pin does what. If you change a
// pin here, also update the pinout table in README.md.
//
// Kept free of Pico SDK includes so host tests can check it too.

#pragma once

namespace pins {

// Test signal outputs (all 3.3V push-pull, driven from IOVDD).
constexpr unsigned kSquare1Hz = 0;
constexpr unsigned kSquare10Hz = 1;
constexpr unsigned kSquare100Hz = 2;
constexpr unsigned kSquare1kHz = 3;
constexpr unsigned kSquare10kHz = 4;
constexpr unsigned kSquare100kHz = 5;
constexpr unsigned kPwm25 = 6;    // PWM slice 3, channel A
constexpr unsigned kPwm75 = 7;    // PWM slice 3, channel B
constexpr unsigned kPulse = 8;    // PWM slice 4, channel A
constexpr unsigned kPattern = 9;  // PIO (slice 4 channel B is left unused)

// Pins wired to the CYW43439 wireless chip on the Pico 2 W. Never use these.
//   GP23 WL_ON, GP24 WL_D (data/IRQ), GP25 WL_CS, GP29 WL_CLK (also VSYS/3 ADC)
constexpr unsigned kReservedPins[] = {23, 24, 25, 29};

// Highest GPIO broken out on the RP2350A package used by the Pico 2 W.
constexpr unsigned kMaxGpio = 29;

constexpr bool is_reserved(unsigned pin) {
    for (unsigned r : kReservedPins) {
        if (r == pin) {
            return true;
        }
    }
    return false;
}

// RP2350 PWM: GPIO n belongs to slice (n / 2) % 8 for GPIO 0-15, channel A on
// even pins and B on odd pins. Both channels of a slice share one frequency.
constexpr unsigned pwm_slice_for(unsigned pin) { return (pin >> 1) & 7u; }
constexpr bool pwm_is_channel_a(unsigned pin) { return (pin & 1u) == 0; }

static_assert(!is_reserved(kSquare1Hz) && !is_reserved(kSquare10Hz) && !is_reserved(kSquare100Hz) &&
                  !is_reserved(kSquare1kHz) && !is_reserved(kSquare10kHz) && !is_reserved(kSquare100kHz) &&
                  !is_reserved(kPwm25) && !is_reserved(kPwm75) && !is_reserved(kPulse) && !is_reserved(kPattern),
              "a signal pin collides with a pin reserved for the CYW43 wireless chip");

// GP6 and GP7 must be the A and B channels of the same slice, because they
// share one PWM frequency and only differ in duty cycle.
static_assert(pwm_slice_for(kPwm25) == pwm_slice_for(kPwm75) && pwm_is_channel_a(kPwm25) &&
                  !pwm_is_channel_a(kPwm75),
              "PWM duty pair must be channel A and B of one slice");

// The pulse output needs its own slice because its frequency is independent.
static_assert(pwm_slice_for(kPulse) != pwm_slice_for(kPwm25), "pulse output must not share the duty pair slice");

}  // namespace pins
