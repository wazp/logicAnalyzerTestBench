// Sanity checks on the shipped defaults in src/signal_config.h: every default
// must be valid at 150 MHz, the requested values must come out exact, and no
// two signals may fight over a pin or a PIO state machine.

#include <cstdint>
#include <set>
#include <utility>

#include "signal_config.h"
#include "test_harness.h"

namespace {
constexpr uint32_t kSys = 150000000;
}

TEST(default_square_waves_are_exact) {
    for (const auto& s : config::kSquareSignals) {
        const auto t = timing::compute_square_timing(kSys, s.freq_hz, s.duty_percent);
        CHECK(t.valid);
        CHECK_EQ(t.actual_hz, s.freq_hz);
        CHECK_EQ(t.actual_duty_percent, s.duty_percent);
    }
}

TEST(default_pwm_pair_is_exact) {
    const auto p = timing::compute_pwm_timing(kSys, config::kPwmPair.freq_hz);
    CHECK(p.valid);
    CHECK_EQ(p.actual_hz, config::kPwmPair.freq_hz);
    const double period = p.top + 1.0;
    CHECK_EQ(timing::pwm_level_for_duty(p, config::kPwmPair.duty_a_percent) / period * 100.0,
             config::kPwmPair.duty_a_percent);
    CHECK_EQ(timing::pwm_level_for_duty(p, config::kPwmPair.duty_b_percent) / period * 100.0,
             config::kPwmPair.duty_b_percent);
}

TEST(default_pulse_is_exact) {
    const auto p = timing::compute_pwm_timing(kSys, config::kPulse.freq_hz);
    CHECK(p.valid);
    const uint32_t level = timing::pwm_level_for_high_time_ns(p, config::kPulse.high_ns);
    CHECK_NEAR(timing::pwm_high_time_ns(p, level), config::kPulse.high_ns, 1e-6);
}

TEST(default_pattern_is_1ms) {
    uint32_t words[config::kPatternSegmentCount];
    const auto e = timing::encode_pattern(kSys, config::kPatternSegments, config::kPatternSegmentCount, words,
                                          config::kPatternSegmentCount);
    CHECK(e.valid);
    CHECK_EQ(e.total_cycles, 150000u);
    CHECK_NEAR(e.period_us, 1000.0, 1e-9);
}

// The bouncing button on GP26: what the lesson promises (edge counts, settle
// times, period) must hold for the encoded segments the board plays.
struct Edges {
    unsigned falling = 0;
    unsigned rising = 0;
};

static Edges count_edges(size_t from, size_t to) {  // Segment indexes, `to` excluded.
    const size_t n = config::kBounceSegmentCount;
    Edges e;
    for (size_t i = from; i < to; ++i) {
        const bool prev = config::kBounceSegments[(i + n - 1) % n].level;
        const bool now = config::kBounceSegments[i].level;
        if (prev && !now) ++e.falling;
        if (!prev && now) ++e.rising;
    }
    return e;
}

TEST(default_bounce_is_500ms_and_bounces) {
    uint32_t words[config::kBounceSegmentCount];
    const auto e = timing::encode_pattern(kSys, config::kBounceSegments, config::kBounceSegmentCount, words,
                                          config::kBounceSegmentCount);
    CHECK(e.valid);
    CHECK_EQ(e.total_cycles, 75000000u);  // 500 ms at 150 MHz.

    // Segments alternate, so every boundary is an edge, and the cycle starts with the press.
    const size_t n = config::kBounceSegmentCount;
    for (size_t i = 0; i < n; ++i) {
        CHECK(config::kBounceSegments[i].level != config::kBounceSegments[(i + 1) % n].level);
    }
    CHECK(!config::kBounceSegments[0].level);

    // Press: up to and including the long "held" segment; release: the rest.
    size_t held = 0;
    while (config::kBounceSegments[held].duration_ns < 100000000u) ++held;
    const Edges press = count_edges(0, held + 1);
    const Edges release = count_edges(held + 1, config::kBounceSegmentCount);
    CHECK_EQ(press.falling, 6u);
    CHECK_EQ(press.rising, 5u);
    CHECK_EQ(release.rising, 3u);
    CHECK_EQ(release.falling, 2u);

    uint64_t press_ns = 0;
    for (size_t i = 0; i < held; ++i) press_ns += config::kBounceSegments[i].duration_ns;
    CHECK_EQ(press_ns, 583000u);
    CHECK_EQ(press_ns + config::kBounceSegments[held].duration_ns, 200000000u);  // Held for 200 ms.
}

TEST(no_pin_or_state_machine_conflicts) {
    std::set<unsigned> used_pins;
    std::set<std::pair<unsigned, unsigned>> used_sms;

    auto claim_pin = [&](unsigned pin) {
        CHECK(pin <= pins::kMaxGpio);
        CHECK(!pins::is_reserved(pin));
        CHECK(used_pins.insert(pin).second);  // Fails on duplicates.
    };

    for (const auto& s : config::kSquareSignals) {
        claim_pin(s.pin);
        CHECK(s.pio_index < 2);  // PIO2 is for the bounce signal and the Wi-Fi driver.
        CHECK(s.sm < 4);
        CHECK(used_sms.insert({s.pio_index, s.sm}).second);
    }
    claim_pin(config::kPwmPair.pin_a);
    claim_pin(config::kPwmPair.pin_b);
    claim_pin(config::kPulse.pin);
    claim_pin(pins::kPattern);
    CHECK(config::kPatternPioIndex < 2);
    CHECK(used_sms.insert({config::kPatternPioIndex, config::kPatternSm}).second);

    for (unsigned p = 0; p < pins::kTimelinePinCount; ++p) {
        claim_pin(pins::kTimelineBase + p);
    }
    CHECK(config::kTimelinePioIndex < 2);
    CHECK(used_sms.insert({config::kTimelinePioIndex, config::kTimelineSm}).second);
    // PIO0 and PIO1 are completely used, which is what sends the CYW43 driver to PIO2.
    CHECK_EQ(used_sms.size(), 8u);

    // The bounce signal is the only one on PIO2, leaving three state machines for the driver.
    claim_pin(pins::kBounce);
    CHECK_EQ(config::kBouncePioIndex, 2u);
    CHECK(used_sms.insert({config::kBouncePioIndex, config::kBounceSm}).second);
}
