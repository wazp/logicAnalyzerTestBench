// Merges several pins' waves (wave.h) into the word stream played by
// src/hw/timeline.pio, one PIO state machine driving up to 13 pins.
//
// Word layout (32 bits, shifted out LSB first):
//   bits 0..12   level of each pin (bit 0 = the first pin of the group)
//   bits 13..31  loop count; the word lasts count + 3 cycles
//
// Rules the encoder applies:
//   - A word lasts at least 3 cycles (the PIO loop overhead). An edge closer
//     than that to the previous one is moved later, so edges on different
//     pins may shift by up to 2 cycles (13 ns at 150 MHz). Edges on the same
//     cycle stay together.
//   - A word lasts at most 2^19 - 1 + 3 cycles (about 3.5 ms at 150 MHz);
//     longer steady stretches are split into several words.
//
// SDK-free so it can be unit tested on the host.

#pragma once

#include <cstddef>
#include <cstdint>

#include "core/wave.h"

namespace timeline {

constexpr unsigned kMaxPins = 13;
constexpr unsigned kCountBits = 32 - kMaxPins;
constexpr uint32_t kOverheadCycles = 3;  // out pins + out x + final jmp.
constexpr uint32_t kMaxCount = (1u << kCountBits) - 1;
constexpr uint32_t kMaxWordCycles = kMaxCount + kOverheadCycles;

struct Result {
    bool valid = false;
    const char* error = nullptr;
    size_t word_count = 0;
    uint64_t total_cycles = 0;  // Sum of all words, equals the frame length when valid.
    uint32_t max_shift_cycles = 0;  // Largest delay applied to any edge.
    size_t shifted_edges = 0;       // How many edges were delayed.
};

// Encodes `pin_count` waves (pin 0 = bit 0) over a frame of `frame_cycles`.
// All toggle times must be below frame_cycles - kOverheadCycles.
Result encode(const wave::PinWave* pins, size_t pin_count, uint32_t frame_cycles, uint32_t* words, size_t max_words);

// Helpers for reading words back (tests, status).
inline uint32_t word_levels(uint32_t word) { return word & ((1u << kMaxPins) - 1); }
inline uint32_t word_cycles(uint32_t word) { return (word >> kMaxPins) + kOverheadCycles; }

}  // namespace timeline
