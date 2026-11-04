// Quadrature encoder outputs A and B, 90 degrees apart. One step is one
// edge on either line, so a full cycle of both lines is four steps:
//
//   phase:  0   1   2   3
//   A:      0   1   1   0
//   B:      0   0   1   1
//
// Turning forward (phase + 1) A leads B: A rises while B is low. Turning back,
// B leads A. Decoders count +1 or -1 per edge from that order.

#pragma once

#include "core/wave.h"

namespace proto {

class Quadrature {
public:
    // Both pins must currently be low (phase 0).
    Quadrature(wave::PinWave& a, wave::PinWave& b) : a_(a), b_(b) {}

    // Moves `steps` steps (negative turns backwards), one every `step_cycles`,
    // the first at cycle `start`. Returns the time of the last step.
    double move(double start, double step_cycles, int steps);

    int phase() const { return phase_; }

private:
    wave::PinWave& a_;
    wave::PinWave& b_;
    int phase_ = 0;
};

}  // namespace proto
