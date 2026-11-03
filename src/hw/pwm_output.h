// Outputs on the RP2350 hardware PWM slices.
//
// A slice has one counter, so both of its pins (channel A on the even GPIO,
// channel B on the odd GPIO) always share a frequency. Only the duty cycle can
// differ per channel.

#pragma once

#include "signal_config.h"

// Two pins of one slice, same frequency, independent duty cycles.
// Returns the slice number. The slice is configured but not enabled.
unsigned pwm_output_init_pair(const config::PwmPairConfig& cfg);

// One pin producing a short high pulse once per period.
// Returns the slice number. The slice is configured but not enabled.
unsigned pwm_output_init_pulse(const config::PulseConfig& cfg);
