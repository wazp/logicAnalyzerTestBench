#include "core/protocols/nec.h"

namespace proto {

namespace {

constexpr double kUnitUs = 562.5;

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
    c.burst(16 * kUnitUs);  // 9 ms leader.
    c.space(8 * kUnitUs);   // 4.5 ms.
    const uint8_t bytes[] = {address, static_cast<uint8_t>(~address), command, static_cast<uint8_t>(~command)};
    for (uint8_t byte : bytes) {
        for (int b = 0; b < 8; ++b) {
            c.burst(kUnitUs);
            c.space(((byte >> b) & 1u) ? 3 * kUnitUs : kUnitUs);
        }
    }
    c.burst(kUnitUs);  // Final burst marks the end of the last bit's space.
    return c.t;
}

double nec_repeat(wave::PinWave& pin, double start, double sys_hz) {
    Cursor c{pin, sys_hz, start};
    c.burst(16 * kUnitUs);
    c.space(4 * kUnitUs);  // 2.25 ms.
    c.burst(kUnitUs);
    return c.t;
}

}  // namespace proto
