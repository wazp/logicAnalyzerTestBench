// A small table of "what is each pin doing" records. Output modules add one
// entry per pin when they start, and the serial console prints the table.

#pragma once

#include <cstddef>

struct SignalStatus {
    unsigned pin;
    const char* name;
    char peripheral[24];  // e.g. "PIO0 SM2" or "PWM3 A"
    double requested_hz;
    double actual_hz;
    double duty_percent;  // Actual duty cycle (high time / period).
    char detail[48];      // Extra info, e.g. pulse width or pattern length.
};

void status_add(const SignalStatus& s);
size_t status_count();
const SignalStatus& status_get(size_t index);
