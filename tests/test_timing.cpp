// Unit tests for src/core/timing.cpp. Reference clock is the RP2350 default
// of 150 MHz unless a test says otherwise.

#include <cstdint>

#include "core/timing.h"
#include "test_harness.h"

namespace {
constexpr uint32_t kSys = 150000000;
}

// --- PIO square wave -------------------------------------------------------

TEST(square_1hz_is_exact) {
    const auto t = timing::compute_square_timing(kSys, 1.0, 50.0);
    CHECK(t.valid);
    CHECK_EQ(t.high_cycles, 75000000u);
    CHECK_EQ(t.low_cycles, 75000000u);
    CHECK_EQ(t.high_count, 75000000u - timing::kSquarePhaseOverheadCycles);
    CHECK_EQ(t.low_count, 75000000u - timing::kSquarePhaseOverheadCycles);
    CHECK_EQ(t.actual_hz, 1.0);
    CHECK_EQ(t.actual_duty_percent, 50.0);
}

TEST(square_100khz_is_exact) {
    const auto t = timing::compute_square_timing(kSys, 100000.0, 50.0);
    CHECK(t.valid);
    CHECK_EQ(t.high_cycles, 750u);
    CHECK_EQ(t.high_count, 748u);
    CHECK_EQ(t.actual_hz, 100000.0);
}

TEST(square_duty_cycle_split) {
    const auto t = timing::compute_square_timing(kSys, 1000.0, 25.0);
    CHECK(t.valid);
    CHECK_EQ(t.high_cycles, 37500u);
    CHECK_EQ(t.low_cycles, 112500u);
    CHECK_EQ(t.actual_duty_percent, 25.0);
}

TEST(square_rounds_to_nearest_cycle) {
    // 150 MHz / 7 MHz = 21.43 cycles, rounded to 21, so 7.142857 MHz.
    const auto t = timing::compute_square_timing(kSys, 7000000.0, 50.0);
    CHECK(t.valid);
    CHECK_EQ(t.high_cycles + t.low_cycles, 21u);
    CHECK_NEAR(t.actual_hz, 150e6 / 21.0, 1e-6);
}

TEST(square_fastest_supported) {
    // Two cycles high, two low: clk_sys / 4.
    const auto t = timing::compute_square_timing(kSys, 37500000.0, 50.0);
    CHECK(t.valid);
    CHECK_EQ(t.high_count, 0u);
    CHECK_EQ(t.low_count, 0u);
    CHECK_EQ(t.actual_hz, 37500000.0);
}

TEST(square_extreme_duty_clamped_to_minimum_phase) {
    // 1% of a 4 cycle period would be 0 cycles, so it is held at 2.
    const auto t = timing::compute_square_timing(kSys, 37500000.0, 1.0);
    CHECK(t.valid);
    CHECK_EQ(t.high_cycles, 2u);
    CHECK_EQ(t.low_cycles, 2u);
}

TEST(square_rejects_bad_input) {
    CHECK(!timing::compute_square_timing(kSys, 0.0, 50.0).valid);
    CHECK(!timing::compute_square_timing(kSys, -5.0, 50.0).valid);
    CHECK(!timing::compute_square_timing(kSys, 1000.0, 0.0).valid);
    CHECK(!timing::compute_square_timing(kSys, 1000.0, 100.0).valid);
    CHECK(!timing::compute_square_timing(kSys, 60000000.0, 50.0).valid);  // Too fast.
    CHECK(!timing::compute_square_timing(kSys, 0.01, 50.0).valid);        // Counter overflow.
    CHECK(timing::compute_square_timing(kSys, 0.01, 50.0).error != nullptr);
}

TEST(square_lowest_frequency_fits_32_bits) {
    // About 0.0175 Hz is the floor at 150 MHz and 50% duty; 0.02 Hz must still work.
    const auto t = timing::compute_square_timing(kSys, 0.02, 50.0);
    CHECK(t.valid);
    CHECK_NEAR(t.actual_hz, 0.02, 1e-9);
}

// --- PWM -------------------------------------------------------------------

TEST(pwm_1khz_uses_divider_3) {
    const auto p = timing::compute_pwm_timing(kSys, 1000.0);
    CHECK(p.valid);
    CHECK_EQ(p.clkdiv, 3u);
    CHECK_EQ(p.top, 49999u);
    CHECK_EQ(p.actual_hz, 1000.0);
    CHECK_EQ(timing::pwm_level_for_duty(p, 25.0), 12500u);
    CHECK_EQ(timing::pwm_level_for_duty(p, 75.0), 37500u);
}

TEST(pwm_100khz_uses_divider_1) {
    const auto p = timing::compute_pwm_timing(kSys, 100000.0);
    CHECK(p.valid);
    CHECK_EQ(p.clkdiv, 1u);
    CHECK_EQ(p.top, 1499u);
}

TEST(pwm_low_frequency_is_approximate) {
    // 10 Hz needs divider 229, which does not divide 150 MHz evenly.
    const auto p = timing::compute_pwm_timing(kSys, 10.0);
    CHECK(p.valid);
    CHECK_EQ(p.clkdiv, 229u);
    CHECK(p.top <= 65535u);
    CHECK_NEAR(p.actual_hz, 10.0, 10.0 * 1e-4);
}

TEST(pwm_rejects_out_of_range) {
    CHECK(!timing::compute_pwm_timing(kSys, 5.0).valid);   // Needs divider > 255.
    CHECK(!timing::compute_pwm_timing(kSys, 0.0).valid);
    CHECK(!timing::compute_pwm_timing(kSys, 1e9).valid);
}

TEST(pwm_duty_edges) {
    const auto p = timing::compute_pwm_timing(kSys, 1000.0);
    CHECK_EQ(timing::pwm_level_for_duty(p, 0.0), 0u);
    CHECK_EQ(timing::pwm_level_for_duty(p, 100.0), p.top + 1);
}

TEST(pwm_pulse_high_time) {
    const auto p = timing::compute_pwm_timing(kSys, 1000.0);
    const uint32_t level = timing::pwm_level_for_high_time_ns(p, 1000);
    CHECK_EQ(level, 50u);  // 1 us at a 50 MHz counter clock.
    CHECK_NEAR(timing::pwm_high_time_ns(p, level), 1000.0, 1e-6);
    // Too short to resolve is clamped to one count so the pulse still shows.
    CHECK_EQ(timing::pwm_level_for_high_time_ns(p, 1), 1u);
    // Longer than the period is clamped to always high.
    CHECK_EQ(timing::pwm_level_for_high_time_ns(p, 5000000), p.top + 1);
}

// --- Pattern ---------------------------------------------------------------

TEST(ns_to_cycles_rounds) {
    CHECK_EQ(timing::ns_to_cycles(kSys, 1000), 150u);
    CHECK_EQ(timing::ns_to_cycles(kSys, 1), 0u);  // 0.15 cycles.
    CHECK_EQ(timing::ns_to_cycles(kSys, 7), 1u);  // 1.05 cycles.
    CHECK_EQ(timing::ns_to_cycles(kSys, 4000000000u), 600000000u);
}

TEST(pattern_word_layout) {
    const timing::PatternSegment segs[] = {{true, 10000}, {false, 1000}};
    uint32_t words[2] = {};
    const auto e = timing::encode_pattern(kSys, segs, 2, words, 2);
    CHECK(e.valid);
    CHECK_EQ(e.word_count, 2u);
    // 10 us = 1500 cycles, minus 3 overhead = 1497, shifted left with level 1.
    CHECK_EQ(words[0], (1497u << 1) | 1u);
    CHECK_EQ(words[1], (147u << 1) | 0u);
    CHECK_EQ(e.total_cycles, 1650u);
    CHECK_NEAR(e.period_us, 11.0, 1e-9);
}

TEST(pattern_rejects_bad_input) {
    uint32_t words[4] = {};
    const timing::PatternSegment too_short[] = {{true, 10}};  // 1.5 cycles.
    CHECK(!timing::encode_pattern(kSys, too_short, 1, words, 4).valid);

    const timing::PatternSegment ok[] = {{true, 1000}, {false, 1000}};
    CHECK(!timing::encode_pattern(kSys, ok, 2, words, 1).valid);  // Buffer too small.
    CHECK(!timing::encode_pattern(kSys, ok, 0, words, 4).valid);  // Empty.
}

TEST(pattern_minimum_segment) {
    // 20 ns = 3 cycles is the shortest segment, loop count 0.
    const timing::PatternSegment segs[] = {{true, 20}};
    uint32_t word = 0;
    const auto e = timing::encode_pattern(kSys, segs, 1, &word, 1);
    CHECK(e.valid);
    CHECK_EQ(word, 1u);
}
