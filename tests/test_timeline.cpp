// Unit tests for the timeline encoder (src/core/timeline.cpp): merging pins,
// the 3-cycle minimum word, splitting long stretches, and frame totals.

#include <cstdint>
#include <vector>

#include "core/timeline.h"
#include "test_harness.h"

namespace {

struct TestPin {
    std::vector<uint32_t> storage = std::vector<uint32_t>(64);
    wave::PinWave w;
    explicit TestPin(bool initial) { w.init(storage.data(), storage.size(), initial); }
};

uint64_t total_cycles(const std::vector<uint32_t>& words, size_t count) {
    uint64_t t = 0;
    for (size_t i = 0; i < count; ++i) t += timeline::word_cycles(words[i]);
    return t;
}

// Level of pin `bit` at cycle t, read back from the encoded words.
bool level_at(const std::vector<uint32_t>& words, size_t count, unsigned bit, uint64_t t) {
    uint64_t start = 0;
    for (size_t i = 0; i < count; ++i) {
        const uint64_t end = start + timeline::word_cycles(words[i]);
        if (t < end) return (timeline::word_levels(words[i]) >> bit) & 1u;
        start = end;
    }
    return false;
}

}  // namespace

TEST(timeline_merges_pins_exactly) {
    TestPin a(false), b(true);
    a.w.set(100, true);
    a.w.set(200, false);
    b.w.set(150, false);
    const wave::PinWave pins[] = {a.w, b.w};
    std::vector<uint32_t> words(16);
    const auto r = timeline::encode(pins, 2, 1000, words.data(), words.size());
    CHECK(r.valid);
    CHECK_EQ(r.word_count, 4u);
    CHECK_EQ(r.total_cycles, 1000u);
    CHECK_EQ(total_cycles(words, r.word_count), 1000u);
    CHECK_EQ(r.shifted_edges, 0u);
    CHECK_EQ(timeline::word_levels(words[0]), 0b10u);
    CHECK_EQ(timeline::word_cycles(words[0]), 100u);
    CHECK(level_at(words, r.word_count, 0, 150));
    CHECK(!level_at(words, r.word_count, 1, 150));
    CHECK(!level_at(words, r.word_count, 0, 999));
}

TEST(timeline_keeps_simultaneous_edges_together) {
    TestPin a(false), b(false);
    a.w.set(500, true);
    b.w.set(500, true);
    const wave::PinWave pins[] = {a.w, b.w};
    std::vector<uint32_t> words(16);
    const auto r = timeline::encode(pins, 2, 1000, words.data(), words.size());
    CHECK(r.valid);
    CHECK_EQ(r.word_count, 2u);
    CHECK_EQ(timeline::word_levels(words[1]), 0b11u);
}

TEST(timeline_delays_edges_closer_than_three_cycles) {
    TestPin a(false), b(false);
    a.w.set(100, true);
    b.w.set(101, true);  // Only 1 cycle later: must wait for the 3-cycle word.
    const wave::PinWave pins[] = {a.w, b.w};
    std::vector<uint32_t> words(16);
    const auto r = timeline::encode(pins, 2, 1000, words.data(), words.size());
    CHECK(r.valid);
    CHECK_EQ(r.shifted_edges, 1u);
    CHECK_EQ(r.max_shift_cycles, 2u);
    CHECK(!level_at(words, r.word_count, 1, 102));
    CHECK(level_at(words, r.word_count, 1, 103));
    CHECK_EQ(r.total_cycles, 1000u);
}

TEST(timeline_splits_long_stretches) {
    TestPin a(true);
    const uint32_t frame = 3 * timeline::kMaxWordCycles + 1;  // Would leave a 1-cycle remainder.
    const wave::PinWave pins[] = {a.w};
    std::vector<uint32_t> words(16);
    const auto r = timeline::encode(pins, 1, frame, words.data(), words.size());
    CHECK(r.valid);
    CHECK_EQ(r.word_count, 4u);
    CHECK_EQ(r.total_cycles, frame);
    for (size_t i = 0; i < r.word_count; ++i) {
        CHECK(timeline::word_cycles(words[i]) >= timeline::kOverheadCycles);
        CHECK(timeline::word_cycles(words[i]) <= timeline::kMaxWordCycles);
        CHECK_EQ(timeline::word_levels(words[i]), 1u);
    }
}

TEST(timeline_rejects_bad_input) {
    TestPin a(false);
    a.w.set(999, true);
    const wave::PinWave pins[] = {a.w};
    std::vector<uint32_t> words(16);
    CHECK(!timeline::encode(pins, 1, 1000, words.data(), words.size()).valid);  // Too close to the end.
    TestPin b(false);
    for (uint32_t t = 10; t < 500; t += 10) b.w.set(t, (t / 10) % 2 == 1);
    const wave::PinWave many[] = {b.w};
    CHECK(!timeline::encode(many, 1, 1000, words.data(), 4).valid);  // Word buffer too small.
    CHECK(!timeline::encode(pins, 0, 1000, words.data(), words.size()).valid);
}

TEST(wave_set_ignores_repeats_and_cancels_same_cycle_toggles) {
    TestPin a(false);
    a.w.set(10, false);  // Already low.
    CHECK_EQ(a.w.count, 0u);
    a.w.set(20, true);
    a.w.set(20.4, false);  // Same cycle after rounding: cancels.
    CHECK_EQ(a.w.count, 0u);
    a.w.set(0, true);  // Change at t = 0 sets the initial level.
    CHECK(a.w.initial);
    CHECK_EQ(a.w.count, 0u);
    a.w.set(30, false);
    a.w.set(25, true);
    CHECK(a.w.out_of_order);
}
