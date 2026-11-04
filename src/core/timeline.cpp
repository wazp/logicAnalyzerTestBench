#include "core/timeline.h"

namespace timeline {

namespace {

struct Writer {
    uint32_t* words;
    size_t max_words;
    size_t count = 0;
    uint64_t total = 0;
    bool full = false;

    // Emits `levels` for `cycles`, split into words no longer than allowed.
    void emit(uint32_t levels, uint64_t cycles) {
        while (cycles > 0) {
            uint64_t chunk = cycles > kMaxWordCycles ? kMaxWordCycles : cycles;
            // Never leave a remainder shorter than one word can be.
            if (cycles - chunk > 0 && cycles - chunk < kOverheadCycles) {
                chunk -= kOverheadCycles;
            }
            if (count == max_words) {
                full = true;
                return;
            }
            words[count++] = levels | (static_cast<uint32_t>(chunk - kOverheadCycles) << kMaxPins);
            total += chunk;
            cycles -= chunk;
        }
    }
};

}  // namespace

Result encode(const wave::PinWave* pins, size_t pin_count, uint32_t frame_cycles, uint32_t* words, size_t max_words) {
    Result r;
    if (pin_count == 0 || pin_count > kMaxPins) {
        r.error = "pin count must be 1 to 13";
        return r;
    }
    if (frame_cycles < kOverheadCycles) {
        r.error = "frame too short";
        return r;
    }
    uint32_t levels = 0;
    size_t next[kMaxPins] = {};
    for (size_t p = 0; p < pin_count; ++p) {
        if (pins[p].overflow) {
            r.error = "a pin has more edges than its buffer holds";
            return r;
        }
        if (pins[p].out_of_order) {
            r.error = "a pin's edges are not in time order";
            return r;
        }
        if (pins[p].count > 0 && pins[p].toggles[pins[p].count - 1] + kOverheadCycles > frame_cycles) {
            r.error = "an edge is too close to the end of the frame";
            return r;
        }
        if (pins[p].initial) {
            levels |= 1u << p;
        }
    }

    Writer w{words, max_words};
    uint64_t segment_start = 0;
    while (true) {
        // Earliest pending edge on any pin.
        uint64_t edge = frame_cycles;
        for (size_t p = 0; p < pin_count; ++p) {
            if (next[p] < pins[p].count && pins[p].toggles[next[p]] < edge) {
                edge = pins[p].toggles[next[p]];
            }
        }
        if (edge == frame_cycles) {
            w.emit(levels, frame_cycles - segment_start);
            break;
        }
        // The current word must last at least kOverheadCycles.
        const uint64_t at = edge < segment_start + kOverheadCycles ? segment_start + kOverheadCycles : edge;
        if (at + kOverheadCycles > frame_cycles) {
            r.error = "edges pile up at the end of the frame";
            return r;
        }
        w.emit(levels, at - segment_start);
        // Apply every edge that falls at or before `at`.
        for (size_t p = 0; p < pin_count; ++p) {
            while (next[p] < pins[p].count && pins[p].toggles[next[p]] <= at) {
                const uint64_t shift = at - pins[p].toggles[next[p]];
                if (shift > 0) {
                    ++r.shifted_edges;
                    if (shift > r.max_shift_cycles) r.max_shift_cycles = static_cast<uint32_t>(shift);
                }
                levels ^= 1u << p;
                ++next[p];
            }
        }
        segment_start = at;
    }

    if (w.full) {
        r.error = "timeline does not fit the word buffer";
        return r;
    }
    r.valid = true;
    r.word_count = w.count;
    r.total_cycles = w.total;
    return r;
}

}  // namespace timeline
