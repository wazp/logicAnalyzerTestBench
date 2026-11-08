// Unit tests for the "Verify" preset frame (src/core/verify_frame.cpp): the
// counter counts, its bits change together, and the bursts have the
// configured frequencies, all after timeline encoding.

#include <cstdint>
#include <vector>

#include "core/timeline.h"
#include "core/verify_frame.h"
#include "test_harness.h"

namespace {

constexpr uint32_t kSysHz = 150000000;

struct Encoded {
    std::vector<uint32_t> pool = std::vector<uint32_t>(verify_frame::kPoolSize);
    verify_frame::Frame f;
    const char* error;
    std::vector<uint32_t> words = std::vector<uint32_t>(16384);
    timeline::Result r;
    Encoded() {
        error = verify_frame::build(f, config::kVerify, kSysHz, pool.data());
        r = timeline::encode(f.pins, verify_frame::kPinCount, f.frame_cycles, words.data(), words.size());
    }
};

}  // namespace

TEST(verify_frame_builds_and_encodes_without_moving_edges) {
    Encoded e;
    CHECK(e.error == nullptr);
    CHECK(e.r.valid);
    CHECK_EQ(e.r.total_cycles, e.f.frame_cycles);
    CHECK_EQ(e.r.shifted_edges, 0u);
    CHECK(e.r.word_count < 14336);  // timeline_output.cpp's buffer.
}

TEST(verify_counter_counts_and_its_bits_change_together) {
    Encoded e;
    const uint32_t step = static_cast<uint32_t>(uint64_t{config::kVerify.counter_step_ns} * kSysHz / 1000000000u);
    // Replay the words and read the counter in the middle of every step.
    uint64_t t = 0;
    size_t i = 0;
    uint32_t level = 0;
    for (uint32_t k = 0; k < (1u << verify_frame::kCounterPins); ++k) {
        const uint64_t mid = uint64_t{k} * step + step / 2;
        while (i < e.r.word_count && t + timeline::word_cycles(e.words[i]) <= mid) t += timeline::word_cycles(e.words[i++]);
        level = timeline::word_levels(e.words[i]);
        CHECK_EQ(level & 0xFFFu, k);
    }
    // Every word boundary where the counter changes is a whole step: no counter edge is ever split across words.
    t = 0;
    uint32_t previous = timeline::word_levels(e.words[0]) & 0xFFFu;
    for (size_t w = 0; w < e.r.word_count; ++w) {
        const uint32_t counter = timeline::word_levels(e.words[w]) & 0xFFFu;
        if (counter != previous) CHECK_EQ(t % step, 0u);
        previous = counter;
        t += timeline::word_cycles(e.words[w]);
    }
}

TEST(verify_bursts_have_the_configured_frequencies) {
    Encoded e;
    const config::VerifyConfig& c = config::kVerify;
    const wave::PinWave& w = e.f.pins[verify_frame::kBurstPin];
    CHECK_EQ(e.f.window_count, static_cast<size_t>(verify_frame::kBurstCount));
    for (unsigned b = 0; b < verify_frame::kBurstCount; ++b) {
        const auto& win = e.f.windows[b];
        std::vector<uint32_t> rises;
        bool level = w.initial;
        for (size_t i = 0; i < w.count; ++i) {
            level = !level;
            if (level && w.toggles[i] >= win.start && w.toggles[i] < win.end) rises.push_back(w.toggles[i]);
        }
        CHECK_EQ(rises.size(), static_cast<size_t>(c.burst_periods));
        const double period_ns = (rises.back() - rises.front()) * 1e9 / kSysHz / (rises.size() - 1);
        CHECK_NEAR(period_ns, 1e9 / c.burst_hz[b], 1e-6);
    }
}
