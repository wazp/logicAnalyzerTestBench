// The timeline pins GP10-GP22: builds the frame of the active preset (the
// protocol frame, src/core/protocol_frame.h, or the video frame,
// src/core/video_frame.h), encodes it into timeline words and plays it on one
// PIO state machine (timeline.pio), looped by DMA with no CPU involvement.

#pragma once

#include "core/presets.h"

// Sets up the state machine and DMA and adds the status rows. The state
// machine is left disabled so main() can start it in sync with the other
// signals. Panics with a clear message if the frame does not fit.
void timeline_output_init(unsigned pio_index, unsigned sm, presets::Preset preset);
