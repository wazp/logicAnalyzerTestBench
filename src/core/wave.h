// One output pin over a repeating frame, recorded as the clk_sys cycle times
// where its level toggles. Protocol encoders (src/core/protocols/) write these;
// the timeline encoder (timeline.h) merges them into PIO words.
//
// Storage is caller provided, so the firmware can use static arrays (no heap)
// and host tests can use whatever they like. SDK-free.

#pragma once

#include <cmath>
#include <cstddef>
#include <cstdint>

namespace wave {

// Converts a time in nanoseconds to clk_sys cycles (not rounded).
inline double ns_to_cycles(double ns, double sys_hz) { return ns * sys_hz / 1e9; }

struct PinWave {
    bool initial = false;  // Level at the start of the frame.
    uint32_t* toggles = nullptr;
    size_t capacity = 0;
    size_t count = 0;
    bool overflow = false;      // More toggles than capacity.
    bool out_of_order = false;  // A set() went back in time.

    // Level after the last recorded toggle, and that toggle's time.
    bool level = false;
    uint32_t last = 0;

    void init(uint32_t* storage, size_t storage_capacity, bool initial_level) {
        initial = initial_level;
        toggles = storage;
        capacity = storage_capacity;
        count = 0;
        overflow = false;
        out_of_order = false;
        level = initial_level;
        last = 0;
    }

    // The pin has level `lvl` from cycle `at` (rounded to the nearest cycle)
    // on. Calls must be in time order. Setting the current level is a no-op,
    // and two toggles on the same cycle cancel out.
    void set(double at, bool lvl) {
        if (lvl == level) {
            return;
        }
        const double rounded = std::floor(at + 0.5);
        const uint32_t t = rounded <= 0.0 ? 0u : static_cast<uint32_t>(rounded);
        if (count > 0 && t < last) {
            out_of_order = true;
            return;
        }
        level = lvl;
        if (count > 0 && t == last) {
            --count;  // Back to the previous level with no time in between.
            last = count > 0 ? toggles[count - 1] : 0;
            return;
        }
        if (t == 0 && count == 0) {
            initial = lvl;  // A change at the very start just sets the initial level.
            return;
        }
        if (count == capacity) {
            overflow = true;
            return;
        }
        toggles[count++] = t;
        last = t;
    }

    // Level at cycle t (for tests and checks).
    bool level_at(uint32_t t) const {
        bool lvl = initial;
        for (size_t i = 0; i < count && toggles[i] <= t; ++i) {
            lvl = !lvl;
        }
        return lvl;
    }
};

}  // namespace wave
