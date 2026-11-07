#include "core/protocols/nes.h"

namespace proto {

double nes_read(NesPins pins, double start, const NesTiming& t, uint8_t buttons) {
    auto pressed = [&](unsigned n) { return ((buttons >> n) & 1u) != 0; };

    pins.latch.set(start, true);
    pins.data.set(start, !pressed(0));  // Parallel load: button A appears right away.
    const double latch_end = start + t.latch_cycles;
    pins.latch.set(latch_end, false);

    double rise = latch_end;
    for (unsigned n = 0; n < 8; ++n) {
        const double fall = latch_end + t.first_clock_cycles + t.clock_period_cycles * n;
        rise = fall + t.clock_period_cycles / 2;
        pins.clock.set(fall, false);
        pins.clock.set(rise, true);
        // The rising edge shifts in the next button, or the grounded serial
        // input after the last one.
        pins.data.set(rise, n < 7 ? !pressed(n + 1) : false);
    }
    return rise;
}

}  // namespace proto
