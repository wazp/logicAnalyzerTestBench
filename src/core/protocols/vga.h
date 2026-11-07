// VGA video timing with a digital (one bit per color) picture of color bars.
//
// A line is the visible pixels, then the front porch, the horizontal sync
// pulse and the back porch. A frame is the visible lines, then the same three
// parts vertically. Both sync pulses are active low, as 640x480 requires.
// Every edge sits on a whole pixel, and pixels are whole clk_sys cycles, so
// the timing is exact.

#pragma once

#include "core/wave.h"

namespace proto {

struct VgaTiming {
    unsigned pixel_cycles = 6;
    unsigned h_visible = 640, h_front = 16, h_sync = 96, h_back = 48;
    unsigned v_visible = 480, v_front = 10, v_sync = 2, v_back = 33;

    unsigned line_pixels() const { return h_visible + h_front + h_sync + h_back; }
    unsigned frame_lines() const { return v_visible + v_front + v_sync + v_back; }
    double line_cycles() const { return static_cast<double>(line_pixels()) * pixel_cycles; }
    double frame_cycles() const { return line_cycles() * frame_lines(); }
};

struct VgaPins {
    wave::PinWave& hsync;
    wave::PinWave& vsync;
    wave::PinWave& red;
    wave::PinWave& green;
    wave::PinWave& blue;
};

struct Rgb1 {
    bool r, g, b;
};

// The classic eight bars, left to right: white, yellow, cyan, green, magenta,
// red, blue, black.
constexpr unsigned kVgaBarCount = 8;
constexpr Rgb1 kVgaBars[kVgaBarCount] = {{true, true, true},  {true, true, false},  {false, true, true},
                                          {false, true, false}, {true, false, true},  {true, false, false},
                                          {false, false, true}, {false, false, false}};
constexpr const char* kVgaBarNames[kVgaBarCount] = {"white", "yellow", "cyan", "green",
                                                    "magenta", "red", "blue", "black"};

// Writes one frame of color bars from cycle `start` (the first visible pixel
// of the first line). The sync pins must idle high. Returns the frame end.
double vga_frame(VgaPins pins, double start, const VgaTiming& t);

}  // namespace proto
