// Streams a word buffer into a PIO state machine's TX FIFO forever, with no
// CPU involvement: a data DMA channel copies the words (paced by the FIFO),
// then chains to a control channel that rewinds the data channel's read
// address and restarts it.
//
// Used by the GP9 and GP26 patterns and the GP10-GP22 protocol timeline.

#pragma once

#include <cstddef>
#include <cstdint>

#include "hardware/pio.h"

// Starts streaming right away: DMA fills the FIFO and then waits until the
// state machine (still disabled) starts consuming. `words` must stay valid
// forever. `start_pointer` must be a variable holding `words` that also stays
// valid; the control channel reads it on every loop.
void dma_loop_start(PIO pio, unsigned sm, const uint32_t* words, size_t word_count,
                    const uint32_t* const* start_pointer);
