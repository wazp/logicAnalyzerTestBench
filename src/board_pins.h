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

// Protocol signals, GP10-GP22, all played by one PIO state machine from a
// precomputed timeline (src/hw/timeline_output.cpp). They must stay one
// contiguous block in this order: the PIO writes them as one 13-bit word.
constexpr unsigned kTimelineBase = 10;
constexpr unsigned kUartTx = 10;
constexpr unsigned kUartRx = 11;  // The simulated device's reply.
constexpr unsigned kI2cScl = 12;
constexpr unsigned kI2cSda = 13;
constexpr unsigned kSpiSck = 14;
constexpr unsigned kSpiMosi = 15;
constexpr unsigned kSpiMiso = 16;
constexpr unsigned kSpiCs = 17;
constexpr unsigned kWs2812 = 18;
constexpr unsigned kOneWire = 19;
constexpr unsigned kIrRemote = 20;
constexpr unsigned kQuadratureA = 21;
constexpr unsigned kQuadratureB = 22;
constexpr unsigned kTimelinePinCount = 13;

// A push button that bounces, played by PIO2 like the GP9 pattern. GP27 and
// GP28 are still free.
constexpr unsigned kBounce = 26;

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
                  !is_reserved(kPwm25) && !is_reserved(kPwm75) && !is_reserved(kPulse) && !is_reserved(kPattern) &&
                  !is_reserved(kBounce),
              "a signal pin collides with a pin reserved for the CYW43 wireless chip");

static_assert(kTimelineBase + kTimelinePinCount - 1 == kQuadratureB && kUartTx == kTimelineBase &&
                  kUartRx == kTimelineBase + 1 && kI2cScl == kTimelineBase + 2 && kI2cSda == kTimelineBase + 3 &&
                  kSpiSck == kTimelineBase + 4 && kSpiMosi == kTimelineBase + 5 && kSpiMiso == kTimelineBase + 6 &&
                  kSpiCs == kTimelineBase + 7 && kWs2812 == kTimelineBase + 8 && kOneWire == kTimelineBase + 9 &&
                  kIrRemote == kTimelineBase + 10 && kQuadratureA == kTimelineBase + 11,
              "protocol pins must be one contiguous block in timeline order");

constexpr bool timeline_overlaps_reserved() {
    for (unsigned pin = kTimelineBase; pin < kTimelineBase + kTimelinePinCount; ++pin) {
        if (is_reserved(pin)) return true;
    }
    return false;
}
static_assert(!timeline_overlaps_reserved(), "a protocol pin collides with a pin reserved for the CYW43 chip");
static_assert(kTimelineBase > kPattern, "protocol pins must not overlap the basic signals");
static_assert(kBounce >= kTimelineBase + kTimelinePinCount, "the bounce pin must not overlap the protocol pins");

// GP6 and GP7 must be the A and B channels of the same slice, because they
// share one PWM frequency and only differ in duty cycle.
static_assert(pwm_slice_for(kPwm25) == pwm_slice_for(kPwm75) && pwm_is_channel_a(kPwm25) &&
                  !pwm_is_channel_a(kPwm75),
              "PWM duty pair must be channel A and B of one slice");

// The pulse output needs its own slice because its frequency is independent.
static_assert(pwm_slice_for(kPulse) != pwm_slice_for(kPwm25), "pulse output must not share the duty pair slice");

}  // namespace pins
