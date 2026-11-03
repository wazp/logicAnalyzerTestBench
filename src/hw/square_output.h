// Square wave / duty cycle outputs on PIO (square_wave.pio).
//
// Each output owns one PIO state machine and one pin, so frequencies are fully
// independent of each other (unlike PWM, where pin pairs share a slice).

#pragma once

#include "hardware/pio.h"
#include "signal_config.h"

// Claims the state machine, loads the program into that PIO if needed,
// configures the pin and loads the loop counts. Leaves the state machine
// disabled so main() can start every output on the same clock cycle.
// Panics with a message if the config cannot be generated.
void square_output_init(const config::SquareSignalConfig& cfg);
