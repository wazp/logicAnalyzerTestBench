#include "core/protocols/vga.h"

namespace proto {

double vga_frame(VgaPins pins, double start, const VgaTiming& t) {
    const double px = t.pixel_cycles;
    const unsigned bar_pixels = t.h_visible / kVgaBarCount;
    const unsigned vsync_start = t.v_visible + t.v_front;

    for (unsigned line = 0; line < t.frame_lines(); ++line) {
        const double line_start = start + t.line_cycles() * line;
        // The vertical sync pulse starts and ends with a line.
        if (line == vsync_start) pins.vsync.set(line_start, false);
        if (line == vsync_start + t.v_sync) pins.vsync.set(line_start, true);

        if (line < t.v_visible) {
            for (unsigned bar = 0; bar < kVgaBarCount; ++bar) {
                const double at = line_start + px * (bar * bar_pixels);
                pins.red.set(at, kVgaBars[bar].r);
                pins.green.set(at, kVgaBars[bar].g);
                pins.blue.set(at, kVgaBars[bar].b);
            }
            // Color must be off outside the visible area: monitors measure
            // the black level during blanking.
            const double blank = line_start + px * t.h_visible;
            pins.red.set(blank, false);
            pins.green.set(blank, false);
            pins.blue.set(blank, false);
        }
        const double sync = line_start + px * (t.h_visible + t.h_front);
        pins.hsync.set(sync, false);
        pins.hsync.set(sync + px * t.h_sync, true);
    }
    return start + t.frame_cycles();
}

}  // namespace proto
