#include "core/video_frame.h"

#include <cmath>
#include <initializer_list>

#include "core/protocols/nes.h"
#include "core/protocols/ps2.h"

namespace video_frame {

namespace {

// Levels at the start of the frame. The color pins start with the first bar
// (white), which vga_frame() sets at cycle 0.
constexpr bool kIdleHigh[kPinCount] = {
    true,   // HSYNC (active low)
    true,   // VSYNC (active low)
    false,  // Red
    false,  // Green
    false,  // Blue
    false,  // NES latch
    true,   // NES clock
    false,  // NES data (low after the previous read)
    true,   // PS/2 clock
    true,   // PS/2 data
    false, false, false,
};

}  // namespace

proto::VgaTiming vga_timing(const config::VideoConfig& c) {
    proto::VgaTiming t;
    t.pixel_cycles = c.pixel_cycles;
    t.h_visible = c.h_visible;
    t.h_front = c.h_front;
    t.h_sync = c.h_sync;
    t.h_back = c.h_back;
    t.v_visible = c.v_visible;
    t.v_front = c.v_front;
    t.v_sync = c.v_sync;
    t.v_back = c.v_back;
    return t;
}

const char* build(Frame& f, const config::VideoConfig& c, uint32_t sys_hz, uint32_t* pool) {
    const proto::VgaTiming vga = vga_timing(c);
    if (c.h_visible % proto::kVgaBarCount != 0) return "the visible width must split into 8 equal bars";
    if (c.frames != 2) return "the video preset holds two frames: key down, then key up";
    const double total = vga.frame_cycles() * c.frames;
    if (total >= 4294967296.0) return "the video frame is too long";
    f.frame_cycles = static_cast<uint32_t>(total);
    f.window_count = 0;
    size_t used = 0;
    for (unsigned p = 0; p < kPinCount; ++p) {
        f.pins[p].init(pool + used, kPinCapacity[p], kIdleHigh[p]);
        used += kPinCapacity[p];
    }
    auto window = [&](const char* part, const char* label, double start, double end) {
        if (f.window_count < kMaxWindows) {
            f.windows[f.window_count++] = {part, label, static_cast<uint32_t>(start), static_cast<uint32_t>(end + 0.5)};
        }
    };
    // Microseconds to cycles, on the nearest whole pixel.
    const double px = c.pixel_cycles;
    auto at_us = [&](double us) { return std::round(us * sys_hz / 1e6 / px) * px; };

    const double half_clock = at_us(c.nes_clock_period_us / 2.0);
    const proto::NesTiming nes{at_us(c.nes_latch_us), at_us(c.nes_first_clock_us), 2 * half_clock};

    for (unsigned frame = 0; frame < c.frames; ++frame) {
        const double start = vga.frame_cycles() * frame;
        const double end = proto::vga_frame({f.pins[kHsync], f.pins[kVsync], f.pins[kRed], f.pins[kGreen],
                                             f.pins[kBlue]},
                                            start, vga);
        window("vga", "frame", start, end);

        // The controller is read in the first line after the picture.
        const double read = start + vga.line_cycles() * c.v_visible;
        const double read_end = proto::nes_read({f.pins[kNesLatch], f.pins[kNesClock], f.pins[kNesData]}, read, nes,
                                                c.nes_buttons[frame]);
        window("nes", "read", read, read_end);

        // Key down in the first frame, up in the second.
        const proto::Ps2Pins ps2{f.pins[kPs2Clock], f.pins[kPs2Data]};
        const double key = start + at_us(c.ps2_first_us);
        if (frame == 0) {
            const double key_end = proto::ps2_write(ps2, key, sys_hz, c.ps2_clock_hz, c.ps2_key);
            window("ps2", "make", key, key_end);
        } else {
            const double prefix_end = proto::ps2_write(ps2, key, sys_hz, c.ps2_clock_hz, proto::kPs2Break);
            const double code = prefix_end + at_us(c.ps2_byte_gap_us);
            const double key_end = proto::ps2_write(ps2, code, sys_hz, c.ps2_clock_hz, c.ps2_key);
            window("ps2", "break", key, key_end);
        }
    }

    for (unsigned p = 0; p < kPinCount; ++p) {
        const wave::PinWave& w = f.pins[p];
        if (w.overflow) return "a video pin needs more edges than kPinCapacity allows";
        if (w.out_of_order) return "two transactions overlap on one video pin";
        if (w.count > 0 && w.last >= f.frame_cycles) return "a video signal runs past the end of the frame";
    }
    // Everything except the picture must end where it started, so the loop is seamless.
    for (Pin p : {kHsync, kVsync, kNesLatch, kNesClock, kNesData, kPs2Clock, kPs2Data}) {
        if (f.pins[p].level != f.pins[p].initial) return "a video pin does not end the frame at its idle level";
    }
    return nullptr;
}

}  // namespace video_frame
