// Irregular repeating pattern on PIO (pattern.pio), fed by two chained DMA
// channels so it loops forever with no CPU involvement. Used for GP9 and the
// GP26 bouncing button; each call sets up one more pin.

#pragma once

#include "signal_config.h"

// Encodes the pattern, sets up the state machine and DMA, and starts the DMA
// so the TX FIFO is pre-filled. The state machine itself is left disabled so
// main() can start it in sync with the square waves.
void pattern_output_init(unsigned pin, const char* name, unsigned pio_index, unsigned sm,
                         const timing::PatternSegment* segments, size_t segment_count);
