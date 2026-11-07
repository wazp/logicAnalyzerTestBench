// Builds the "Verify" timeline frame for GP10-GP22 (see src/core/presets.h):
// a binary counter on GP10-GP21 and frequency bursts on GP22, for checking an
// analyzer's inputs, skew and top speed. One wave per pin, like
// src/core/protocol_frame.h, so timeline::encode() plays it on the same state
// machine.
//
// Every edge is on a whole clk_sys cycle, and burst half periods divide the
// counter step, so the timeline encoder never has to move an edge: all the
// counter bits that change together change in the same PIO instruction.
// SDK-free so it can be unit tested on the host.

#pragma once

#include <cstddef>
#include <cstdint>

#include "core/protocol_frame.h"
#include "core/wave.h"
#include "signal_config.h"

namespace verify_frame {

constexpr unsigned kCounterPins = 12;  // GP10-GP21: pin index n is counter bit n.
constexpr unsigned kBurstPin = 12;     // GP22.
constexpr unsigned kPinCount = 13;
static_assert(kPinCount == pins::kTimelinePinCount, "pin count must match board_pins.h");

constexpr unsigned kBurstCount = 8;

using Window = protocol_frame::Window;
constexpr size_t kMaxWindows = kBurstCount;

// Toggle storage: bit n of a 12-bit count toggles 2^(12-n) times per frame.
constexpr size_t counter_capacity(unsigned bit) { return (size_t{1} << (kCounterPins - bit)) + 4; }
constexpr size_t kBurstCapacity = 512;  // 8 bursts x 16 periods x 2 edges, with room for more periods.
constexpr size_t pool_size() {
    size_t total = kBurstCapacity;
    for (unsigned b = 0; b < kCounterPins; ++b) total += counter_capacity(b);
    return total;
}
constexpr size_t kPoolSize = pool_size();

struct Frame {
    wave::PinWave pins[kPinCount];
    uint32_t frame_cycles = 0;
    Window windows[kMaxWindows];
    size_t window_count = 0;
};

// Builds the frame at `sys_hz` into `out`, using `pool` (kPoolSize words) for
// the toggle times. Returns nullptr on success, else a description.
const char* build(Frame& out, const config::VerifyConfig& c, uint32_t sys_hz, uint32_t* pool);

}  // namespace verify_frame
