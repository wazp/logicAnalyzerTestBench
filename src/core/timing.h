// Pure timing math for the signal generators.
//
// Nothing in this file touches the Pico SDK or hardware registers, so it can be
// compiled and unit tested on the host (see tests/). The hardware modules in
// src/hw/ call these functions and then program the peripherals with the
// results.
//
// All "cycles" are system clock cycles (clk_sys, 150 MHz by default on RP2350).

#pragma once

#include <cstddef>
#include <cstdint>

namespace timing {

// ---------------------------------------------------------------------------
// PIO square wave / duty cycle generator (src/hw/square_wave.pio)
// ---------------------------------------------------------------------------

// Each phase (high or low) of square_wave.pio costs this many cycles on top of
// the loop count loaded into the state machine: one `mov` plus the final
// `jmp x--` that falls through when X is 0.
constexpr uint32_t kSquarePhaseOverheadCycles = 2;

struct SquareTiming {
    bool valid = false;
    const char* error = nullptr;  // Human readable reason when !valid.

    uint32_t high_count = 0;  // Value loaded into Y (high phase loop count).
    uint32_t low_count = 0;   // Value loaded into ISR (low phase loop count).

    uint64_t high_cycles = 0;  // Actual high time in clk_sys cycles.
    uint64_t low_cycles = 0;   // Actual low time in clk_sys cycles.

    double actual_hz = 0.0;            // What the pin really produces.
    double actual_duty_percent = 0.0;  // High time as a percent of the period.
};

// Converts a requested frequency and duty cycle into PIO loop counts.
// The period is rounded to the nearest whole cycle, so the actual frequency can
// differ slightly from the request when sys_hz is not an exact multiple.
// Each phase must be at least kSquarePhaseOverheadCycles long.
SquareTiming compute_square_timing(uint32_t sys_hz, double freq_hz, double duty_percent);

// ---------------------------------------------------------------------------
// Hardware PWM slice (src/hw/pwm_output.cpp)
// ---------------------------------------------------------------------------

constexpr uint32_t kPwmMaxPeriodCounts = 65536;  // 16-bit counter, TOP <= 65535.
constexpr uint32_t kPwmMaxIntDivider = 255;      // 8-bit integer divider.

struct PwmTiming {
    bool valid = false;
    const char* error = nullptr;

    uint32_t clkdiv = 1;  // Integer clock divider (fractional part unused).
    uint32_t top = 0;     // Counter wraps after TOP, so period = TOP + 1 counts.

    double counter_hz = 0.0;  // sys_hz / clkdiv, the rate one count lasts.
    double actual_hz = 0.0;
};

// Picks the smallest integer divider that lets the period fit in 16 bits.
// Smallest divider means the finest duty cycle resolution. Only integer
// dividers are used because fractional dividers add period jitter.
PwmTiming compute_pwm_timing(uint32_t sys_hz, double freq_hz);

// Compare level for a duty cycle in percent. The output is high while the
// counter is below the level, so level == TOP + 1 means always high.
uint32_t pwm_level_for_duty(const PwmTiming& pwm, double duty_percent);

// Compare level for a fixed high time, e.g. a 1 us pulse. Clamped to the
// range [1, TOP + 1] so a valid pulse is always visible.
uint32_t pwm_level_for_high_time_ns(const PwmTiming& pwm, uint32_t high_ns);

// Actual high time in nanoseconds that a given level produces.
double pwm_high_time_ns(const PwmTiming& pwm, uint32_t level);

// ---------------------------------------------------------------------------
// PIO pattern player (src/hw/pattern.pio)
// ---------------------------------------------------------------------------

// pattern.pio spends `out pins`, `out x` and the final `jmp x--` on every
// segment, so a segment lasts (loop count + 3) cycles.
constexpr uint32_t kPatternSegmentOverheadCycles = 3;
constexpr uint32_t kPatternMaxCount = 0x7FFFFFFFu;  // 31 bits for the count.

struct PatternSegment {
    bool level;            // Pin level during this segment.
    uint32_t duration_ns;  // How long the level is held.
};

struct PatternEncoding {
    bool valid = false;
    const char* error = nullptr;
    size_t word_count = 0;      // Number of words written to the output buffer.
    uint64_t total_cycles = 0;  // One full repetition of the pattern.
    double period_us = 0.0;     // total_cycles expressed in microseconds.
};

// Encodes one 32-bit word per segment: bit 0 is the pin level and bits 31..1
// are the loop count. The state machine shifts right, so it reads the level
// first and the count second.
PatternEncoding encode_pattern(uint32_t sys_hz, const PatternSegment* segments, size_t segment_count,
                               uint32_t* out_words, size_t out_capacity);

// Converts a duration to clk_sys cycles, rounding to the nearest cycle.
uint64_t ns_to_cycles(uint32_t sys_hz, uint64_t ns);

}  // namespace timing
