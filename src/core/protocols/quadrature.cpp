#include "core/protocols/quadrature.h"

namespace proto {

double Quadrature::move(double start, double step_cycles, int steps) {
    const int direction = steps >= 0 ? 1 : -1;
    const int count = steps >= 0 ? steps : -steps;
    double t = start;
    for (int i = 0; i < count; ++i) {
        t = start + step_cycles * i;
        phase_ = (phase_ + direction + 4) % 4;
        a_.set(t, phase_ == 1 || phase_ == 2);
        b_.set(t, phase_ == 2 || phase_ == 3);
    }
    return t;
}

}  // namespace proto
