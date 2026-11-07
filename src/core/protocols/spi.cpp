#include "core/protocols/spi.h"

namespace proto {

double spi_transfer(SpiPins pins, double start, double sys_hz, uint32_t clock_hz, const uint8_t* mosi,
                    const uint8_t* miso, size_t len, const SpiFaults& faults) {
    const double half = sys_hz / clock_hz / 2.0;
    const bool late_miso = faults.miso_after_rise >= 0.0;
    pins.cs.set(start, false);
    double t = start;  // Data for the next bit is put out at t, sampled at t + half.
    const size_t bits = faults.stop_after_bits != 0 && faults.stop_after_bits < len * 8 ? faults.stop_after_bits : len * 8;
    for (size_t n = 0; n < bits; ++n) {
        const unsigned shift = 7 - n % 8;  // MSB first.
        const bool miso_bit = (miso[n / 8] >> shift) & 1u;
        pins.mosi.set(t, (mosi[n / 8] >> shift) & 1u);
        if (!late_miso) pins.miso.set(t, miso_bit);
        pins.sck.set(t + half, true);  // Rising edge: both sides sample.
        if (late_miso) pins.miso.set(t + half + faults.miso_after_rise, miso_bit);
        pins.sck.set(t + 2 * half, false);  // Falling edge: data may change.
        t += 2 * half;
    }
    const double end = t + half;  // CS hold time after the last clock.
    pins.cs.set(end, true);
    pins.mosi.set(end, false);
    pins.miso.set(end, true);
    return end;
}

}  // namespace proto
