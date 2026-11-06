// Unit tests for the "Video and input" preset: the VGA, NES and PS/2 encoders
// and the default video frame (src/core/video_frame.cpp). Like
// test_protocols.cpp, each test reads the waveform the way an analyzer or the
// receiving device would.

#include <cstdint>
#include <initializer_list>
#include <vector>

#include "core/protocols/nes.h"
#include "core/protocols/ps2.h"
#include "core/protocols/vga.h"
#include "core/timeline.h"
#include "core/video_frame.h"
#include "signal_config.h"
#include "test_harness.h"

namespace {

constexpr uint32_t kSys = 150000000;

struct Built {
    std::vector<uint32_t> pool = std::vector<uint32_t>(video_frame::kPoolSize);
    video_frame::Frame f;
    const char* error;
    Built() { error = video_frame::build(f, config::kVideo, kSys, pool.data()); }
    bool at(video_frame::Pin p, double t) const { return f.pins[p].level_at(static_cast<uint32_t>(t)); }
};

// Times of rising (true) or falling (false) edges of a pin.
std::vector<uint32_t> edges(const wave::PinWave& w, bool rising) {
    std::vector<uint32_t> out;
    bool level = w.initial;
    for (size_t i = 0; i < w.count; ++i) {
        level = !level;
        if (level == rising) out.push_back(w.toggles[i]);
    }
    return out;
}

const proto::VgaTiming kVga = video_frame::vga_timing(config::kVideo);

}  // namespace

TEST(video_frame_builds_and_fits_the_timeline) {
    Built b;
    CHECK(b.error == nullptr);
    CHECK_EQ(b.f.frame_cycles, 2u * 525u * 800u * 6u);
    std::vector<uint32_t> words(14336);
    const timeline::Result r =
        timeline::encode(b.f.pins, video_frame::kPinCount, b.f.frame_cycles, words.data(), words.size());
    CHECK(r.valid);
    CHECK_EQ(r.total_cycles, b.f.frame_cycles);
    // Every edge is on a whole pixel, so the encoder never moves one.
    CHECK_EQ(r.shifted_edges, 0u);
    CHECK(r.word_count < words.size());
}

TEST(vga_lines_and_frames_have_640x480_timing) {
    Built b;
    // 25 MHz pixels: 32 us lines (31.25 kHz), 16.8 ms frames (59.52 Hz).
    CHECK_NEAR(kVga.line_cycles(), 4800, 0);
    CHECK_NEAR(kSys / kVga.frame_cycles(), 59.5238, 0.001);

    const auto hfall = edges(b.f.pins[video_frame::kHsync], false);
    const auto hrise = edges(b.f.pins[video_frame::kHsync], true);
    CHECK_EQ(hfall.size(), 1050u);
    CHECK_EQ(hfall[0], 656u * 6u);  // After 640 visible pixels and the 16 pixel front porch.
    for (size_t i = 0; i < hfall.size(); ++i) {
        CHECK_EQ(hrise[i] - hfall[i], 96u * 6u);
        if (i > 0) CHECK_EQ(hfall[i] - hfall[i - 1], 4800u);
    }

    const auto vfall = edges(b.f.pins[video_frame::kVsync], false);
    const auto vrise = edges(b.f.pins[video_frame::kVsync], true);
    CHECK_EQ(vfall.size(), 2u);
    CHECK_EQ(vfall[0], 490u * 4800u);  // After 480 visible lines and the 10 line front porch.
    CHECK_EQ(vrise[0] - vfall[0], 2u * 4800u);
    CHECK_EQ(vfall[1] - vfall[0], 525u * 4800u);
}

TEST(vga_draws_eight_color_bars_and_blanks_outside_the_picture) {
    Built b;
    for (unsigned line : {0u, 240u, 479u, 525u + 100u}) {
        const double line_start = 4800.0 * line;
        for (unsigned bar = 0; bar < proto::kVgaBarCount; ++bar) {
            const double mid = line_start + 6.0 * (bar * 80 + 40);
            CHECK_EQ(b.at(video_frame::kRed, mid), proto::kVgaBars[bar].r);
            CHECK_EQ(b.at(video_frame::kGreen, mid), proto::kVgaBars[bar].g);
            CHECK_EQ(b.at(video_frame::kBlue, mid), proto::kVgaBars[bar].b);
        }
        for (video_frame::Pin p : {video_frame::kRed, video_frame::kGreen, video_frame::kBlue}) {
            CHECK(!b.at(p, line_start + 6.0 * 700));  // In the horizontal blanking.
        }
    }
    for (video_frame::Pin p : {video_frame::kRed, video_frame::kGreen, video_frame::kBlue}) {
        CHECK(!b.at(p, 4800.0 * 500 + 6.0 * 40));  // A blank line in the vertical blanking.
    }
}

// Reads the buttons like the console: A at the end of the latch, then one bit
// after each rising clock edge. Low = pressed.
TEST(nes_reads_decode_to_the_configured_buttons) {
    Built b;
    const auto latch = edges(b.f.pins[video_frame::kNesLatch], false);
    const auto clock = edges(b.f.pins[video_frame::kNesClock], true);
    CHECK_EQ(latch.size(), 2u);
    CHECK_EQ(clock.size(), 16u);
    const auto latch_rise = edges(b.f.pins[video_frame::kNesLatch], true);
    for (size_t read = 0; read < latch.size(); ++read) {
        CHECK_EQ(latch[read] - latch_rise[read], 12u * 150u);
        CHECK_EQ(latch_rise[read] % 4800u, 0u);  // Starts a line.
        CHECK_EQ(latch_rise[read] / 4800u, 480u + 525u * read);  // The first line after the picture.
        uint8_t buttons = b.at(video_frame::kNesData, latch[read] - 1) ? 0 : 1;
        for (unsigned n = 1; n < 8; ++n) {
            const uint32_t rise = clock[read * 8 + n - 1];
            if (!b.at(video_frame::kNesData, rise + 10)) buttons |= static_cast<uint8_t>(1u << n);
        }
        CHECK_EQ(buttons, config::kVideo.nes_buttons[read]);
        // Clock pulses: 12 us apart, low for 6 us.
        const uint32_t first_rise = clock[read * 8];
        CHECK(!b.at(video_frame::kNesClock, first_rise - 1));
        CHECK(b.at(video_frame::kNesClock, first_rise - 900 - 1));
        // After the 8th clock the shift register outputs its grounded input.
        CHECK(!b.at(video_frame::kNesData, clock[read * 8 + 7] + 10));
    }
}

// Reads the keyboard like the computer: one bit per falling clock edge.
TEST(ps2_keyboard_presses_and_releases_the_a_key) {
    Built b;
    const auto falls = edges(b.f.pins[video_frame::kPs2Clock], false);
    CHECK_EQ(falls.size(), 33u);  // 3 bytes of 11 bits.
    std::vector<uint8_t> bytes;
    for (size_t i = 0; i + 11 <= falls.size(); i += 11) {
        CHECK(!b.at(video_frame::kPs2Data, falls[i]));  // Start bit.
        uint8_t byte = 0;
        unsigned ones = 0;
        for (unsigned k = 0; k < 8; ++k) {
            const bool bit = b.at(video_frame::kPs2Data, falls[i + 1 + k]);
            byte |= static_cast<uint8_t>(bit << k);
            ones += bit;
        }
        ones += b.at(video_frame::kPs2Data, falls[i + 9]);
        CHECK_EQ(ones % 2, 1u);                             // Odd parity.
        CHECK(b.at(video_frame::kPs2Data, falls[i + 10]));  // Stop bit.
        bytes.push_back(byte);
        // 12.5 kHz: 80 us per bit.
        CHECK_EQ(falls[i + 1] - falls[i], 80u * 150u);
    }
    CHECK(bytes == (std::vector<uint8_t>{0x1C, 0xF0, 0x1C}));
    // The key goes down in the first video frame and up in the second.
    CHECK(falls[0] < 840000u * 6u);
    CHECK(falls[11] > 420000u * 6u);
    // Data only changes while the clock is high.
    const wave::PinWave& data = b.f.pins[video_frame::kPs2Data];
    for (size_t i = 0; i < data.count; ++i) CHECK(b.at(video_frame::kPs2Clock, data.toggles[i]));
}

TEST(video_frame_puts_every_edge_on_a_pixel) {
    Built b;
    for (unsigned p = 0; p < video_frame::kPinCount; ++p) {
        const wave::PinWave& w = b.f.pins[p];
        for (size_t i = 0; i < w.count; ++i) CHECK_EQ(w.toggles[i] % 6u, 0u);
    }
}
