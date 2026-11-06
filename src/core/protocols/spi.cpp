#include "core/protocols/spi.h"

namespace proto {

double spi_transfer(SpiPins pins, double start, double sys_hz, uint32_t clock_hz, const uint8_t* mosi,
                    const uint8_t* miso, size_t len) {
    const double half = sys_hz / clock_hz / 2.0;
    pins.cs.set(start, false);
    double t = start;  // Data for the next bit is put out at t, sampled at t + half.
    for (size_t i = 0; i < len; ++i) {
        for (int b = 7; b >= 0; --b) {
            pins.mosi.set(t, (mosi[i] >> b) & 1u);
            pins.miso.set(t, (miso[i] >> b) & 1u);
            pins.sck.set(t + half, true);   // Rising edge: both sides sample.
            pins.sck.set(t + 2 * half, false);  // Falling edge: data may change.
            t += 2 * half;
        }
    }
    const double end = t + half;  // CS hold time after the last clock.
    pins.cs.set(end, true);
    pins.mosi.set(end, false);
    pins.miso.set(end, true);
    return end;
}

}  // namespace proto
