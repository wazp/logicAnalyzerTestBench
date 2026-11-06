#include "core/protocols/nec.h"

namespace proto {

namespace {

struct Cursor {
    wave::PinWave& pin;
    double sys_hz;
    double t;

    double us(double v) const { return wave::ns_to_cycles(v * 1000.0, sys_hz); }
    void burst(double length_us) {
        pin.set(t, false);
        t += us(length_us);
        pin.set(t, true);
    }
    void space(double length_us) { t += us(length_us); }
};

}  // namespace

double nec_frame(wave::PinWave& pin, double start, double sys_hz, uint8_t address, uint8_t command) {
    Cursor c{pin, sys_hz, start};
    c.burst(kNecLeaderUs);
    c.space(kNecLeaderSpaceUs);
    const uint8_t bytes[] = {address, static_cast<uint8_t>(~address), command, static_cast<uint8_t>(~command)};
    for (uint8_t byte : bytes) {
        for (int b = 0; b < 8; ++b) {
            c.burst(kNecUnitUs);
            c.space(((byte >> b) & 1u) ? 3 * kNecUnitUs : kNecUnitUs);
        }
    }
    c.burst(kNecUnitUs);  // Final burst marks the end of the last bit's space.
    return c.t;
}

double nec_repeat(wave::PinWave& pin, double start, double sys_hz) {
    Cursor c{pin, sys_hz, start};
    c.burst(kNecLeaderUs);
    c.space(kNecRepeatSpaceUs);
    c.burst(kNecUnitUs);
    return c.t;
}

}  // namespace proto
