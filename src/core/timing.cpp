#include "timing.h"

#include <cmath>

namespace timing {

uint64_t ns_to_cycles(uint32_t sys_hz, uint64_t ns) {
    // Integer math with round-to-nearest. ns * sys_hz stays well inside 64 bits
    // for any duration that fits in uint32_t nanoseconds.
    return (ns * sys_hz + 500000000ull) / 1000000000ull;
}

SquareTiming compute_square_timing(uint32_t sys_hz, double freq_hz, double duty_percent) {
    SquareTiming t;

    if (sys_hz == 0 || !(freq_hz > 0.0)) {
        t.error = "frequency must be greater than zero";
        return t;
    }
    if (!(duty_percent > 0.0 && duty_percent < 100.0)) {
        t.error = "duty cycle must be between 0 and 100 percent (exclusive)";
        return t;
    }

    const double period_exact = static_cast<double>(sys_hz) / freq_hz;
    if (period_exact < 2.0 * kSquarePhaseOverheadCycles - 0.5) {
        t.error = "frequency too high for the PIO square wave program";
        return t;
    }

    const uint64_t period = static_cast<uint64_t>(std::llround(period_exact));
    uint64_t high = static_cast<uint64_t>(std::llround(static_cast<double>(period) * duty_percent / 100.0));

    // Each phase needs at least the fixed instruction overhead. Very small or
    // very large duty cycles at high frequencies get pushed to that minimum.
    if (high < kSquarePhaseOverheadCycles) {
        high = kSquarePhaseOverheadCycles;
    }
    if (period - high < kSquarePhaseOverheadCycles) {
        high = period - kSquarePhaseOverheadCycles;
    }
    const uint64_t low = period - high;

    // The loop counts live in 32-bit PIO registers.
    const uint64_t max_phase = static_cast<uint64_t>(UINT32_MAX) + kSquarePhaseOverheadCycles;
    if (high > max_phase || low > max_phase) {
        t.error = "frequency too low for a 32-bit PIO loop counter";
        return t;
    }

    t.valid = true;
    t.high_count = static_cast<uint32_t>(high - kSquarePhaseOverheadCycles);
    t.low_count = static_cast<uint32_t>(low - kSquarePhaseOverheadCycles);
    t.high_cycles = high;
    t.low_cycles = low;
    t.actual_hz = static_cast<double>(sys_hz) / static_cast<double>(period);
    t.actual_duty_percent = 100.0 * static_cast<double>(high) / static_cast<double>(period);
    return t;
}

PwmTiming compute_pwm_timing(uint32_t sys_hz, double freq_hz) {
    PwmTiming t;

    if (sys_hz == 0 || !(freq_hz > 0.0)) {
        t.error = "frequency must be greater than zero";
        return t;
    }

    const double cycles_per_period = static_cast<double>(sys_hz) / freq_hz;
    if (cycles_per_period < 2.0) {
        t.error = "frequency too high for the PWM slice";
        return t;
    }

    // Smallest divider whose period still fits in the 16-bit counter.
    const uint32_t div = static_cast<uint32_t>(std::ceil(cycles_per_period / kPwmMaxPeriodCounts));
    const uint32_t clkdiv = div < 1 ? 1 : div;
    if (clkdiv > kPwmMaxIntDivider) {
        t.error = "frequency too low for the PWM slice (divider > 255)";
        return t;
    }

    uint64_t period = static_cast<uint64_t>(std::llround(cycles_per_period / clkdiv));
    if (period > kPwmMaxPeriodCounts) {
        period = kPwmMaxPeriodCounts;  // Rounding pushed it one count over.
    }

    t.valid = true;
    t.clkdiv = clkdiv;
    t.top = static_cast<uint32_t>(period - 1);
    t.counter_hz = static_cast<double>(sys_hz) / clkdiv;
    t.actual_hz = t.counter_hz / static_cast<double>(period);
    return t;
}

uint32_t pwm_level_for_duty(const PwmTiming& pwm, double duty_percent) {
    if (!(duty_percent > 0.0)) {
        return 0;
    }
    const double period = static_cast<double>(pwm.top) + 1.0;
    if (duty_percent >= 100.0) {
        return pwm.top + 1;
    }
    return static_cast<uint32_t>(std::llround(period * duty_percent / 100.0));
}

uint32_t pwm_level_for_high_time_ns(const PwmTiming& pwm, uint32_t high_ns) {
    const double counts = static_cast<double>(high_ns) * pwm.counter_hz / 1e9;
    long long level = std::llround(counts);
    if (level < 1) {
        level = 1;
    }
    if (level > static_cast<long long>(pwm.top) + 1) {
        level = static_cast<long long>(pwm.top) + 1;
    }
    return static_cast<uint32_t>(level);
}

double pwm_high_time_ns(const PwmTiming& pwm, uint32_t level) {
    return static_cast<double>(level) * 1e9 / pwm.counter_hz;
}

PatternEncoding encode_pattern(uint32_t sys_hz, const PatternSegment* segments, size_t segment_count,
                               uint32_t* out_words, size_t out_capacity) {
    PatternEncoding e;

    if (sys_hz == 0 || segments == nullptr || segment_count == 0) {
        e.error = "pattern is empty";
        return e;
    }
    if (segment_count > out_capacity) {
        e.error = "pattern has more segments than the output buffer holds";
        return e;
    }

    uint64_t total = 0;
    for (size_t i = 0; i < segment_count; ++i) {
        const uint64_t cycles = ns_to_cycles(sys_hz, segments[i].duration_ns);
        if (cycles < kPatternSegmentOverheadCycles) {
            e.error = "pattern segment shorter than the PIO minimum (3 cycles)";
            return e;
        }
        const uint64_t count = cycles - kPatternSegmentOverheadCycles;
        if (count > kPatternMaxCount) {
            e.error = "pattern segment too long for a 31-bit loop count";
            return e;
        }
        out_words[i] = (static_cast<uint32_t>(count) << 1) | (segments[i].level ? 1u : 0u);
        total += cycles;
    }

    e.valid = true;
    e.word_count = segment_count;
    e.total_cycles = total;
    e.period_us = static_cast<double>(total) * 1e6 / static_cast<double>(sys_hz);
    return e;
}

}  // namespace timing
