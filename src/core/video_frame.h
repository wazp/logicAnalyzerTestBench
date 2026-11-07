// Builds the "Video and input" timeline frame for GP10-GP22 (see
// src/core/presets.h): a VGA picture of color bars, an NES controller read
// once per video frame, and a PS/2 keyboard pressing and releasing a key. One
// wave per pin, like src/core/protocol_frame.h, so timeline::encode() plays it
// on the same state machine.
//
// Every edge is placed on a whole VGA pixel (pixel_cycles clk_sys cycles), so
// controller and keyboard edges either coincide with video edges or are a
// pixel away from them, and the timeline encoder never has to move a video
// edge. SDK-free so it can be unit tested on the host.

#pragma once

#include <cstddef>
#include <cstdint>

#include "core/protocol_frame.h"
#include "core/protocols/vga.h"
#include "core/wave.h"
#include "signal_config.h"

namespace video_frame {

// Pin index inside the timeline (bit n of a timeline word = GP10 + n).
enum Pin : unsigned {
    kHsync,
    kVsync,
    kRed,
    kGreen,
    kBlue,
    kNesLatch,
    kNesClock,
    kNesData,
    kPs2Clock,
    kPs2Data,
    kUnused20,  // GP20-GP22 are held low in this preset.
    kUnused21,
    kUnused22,
    kPinCount
};
static_assert(kPinCount == pins::kTimelinePinCount, "pin enum must match board_pins.h");

using Window = protocol_frame::Window;
constexpr size_t kMaxWindows = 16;

// Toggle storage each pin needs for the default config (two frames), with
// headroom. Visible lines toggle red 4 times, green 2 and blue 8.
constexpr size_t kPinCapacity[kPinCount] = {
    2200,  // HSYNC: 2 per line, 1050 lines
    8,     // VSYNC
    4000,  // Red
    2048,  // Green
    7800,  // Blue
    8,     // NES latch
    64,    // NES clock
    64,    // NES data
    128,   // PS/2 clock
    128,   // PS/2 data
    0, 0, 0,
};
constexpr size_t pool_size() {
    size_t total = 0;
    for (size_t c : kPinCapacity) total += c;
    return total;
}
constexpr size_t kPoolSize = pool_size();

struct Frame {
    wave::PinWave pins[kPinCount];
    uint32_t frame_cycles = 0;
    Window windows[kMaxWindows];
    size_t window_count = 0;
};

proto::VgaTiming vga_timing(const config::VideoConfig& c);

// Builds the frame at `sys_hz` into `out`, using `pool` (kPoolSize words) for
// the toggle times. Returns nullptr on success, else a description.
const char* build(Frame& out, const config::VideoConfig& c, uint32_t sys_hz, uint32_t* pool);

}  // namespace video_frame
