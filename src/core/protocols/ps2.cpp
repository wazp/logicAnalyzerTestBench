#include "core/protocols/ps2.h"

namespace proto {

double ps2_write(Ps2Pins pins, double start, double sys_hz, uint32_t clock_hz, uint8_t byte) {
    const double bit = sys_hz / clock_hz;
    bool levels[11];
    levels[0] = false;
    for (unsigned b = 0; b < 8; ++b) levels[1 + b] = (byte >> b) & 1u;
    levels[9] = ps2_parity(byte);
    levels[10] = true;

    for (unsigned k = 0; k < 11; ++k) {
        const double at = start + bit * k;
        pins.data.set(at, levels[k]);
        pins.clock.set(at + bit / 4, false);
        pins.clock.set(at + bit * 3 / 4, true);
    }
    return start + bit * 11;
}

}  // namespace proto
