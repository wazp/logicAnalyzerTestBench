#include "core/protocols/ws2812.h"

namespace proto {

double ws2812_write(wave::PinWave& pin, double start, double sys_hz, const Ws2812Timing& timing, const Rgb* leds,
                    size_t count, const Ws2812Fault& fault) {
    const double bit = wave::ns_to_cycles(timing.bit_ns, sys_hz);
    const double t0h = wave::ns_to_cycles(timing.t0h_ns, sys_hz);
    const double t1h = wave::ns_to_cycles(timing.t1h_ns, sys_hz);
    size_t k = 0;
    for (size_t i = 0; i < count; ++i) {
        const uint32_t grb = static_cast<uint32_t>(leds[i].g) << 16 | static_cast<uint32_t>(leds[i].r) << 8 | leds[i].b;
        for (int b = 23; b >= 0; --b) {
            const double slot = start + bit * static_cast<double>(k++);
            pin.set(slot, true);
            const bool faulty = static_cast<long>(i) == fault.led && b == fault.bit;
            const double high = faulty ? wave::ns_to_cycles(fault.high_ns, sys_hz) : ((grb >> b) & 1u) ? t1h : t0h;
            pin.set(slot + high, false);
        }
    }
    return start + bit * static_cast<double>(k);
}

}  // namespace proto
