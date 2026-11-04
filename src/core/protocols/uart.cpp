#include "core/protocols/uart.h"

namespace proto {

double uart_write(wave::PinWave& pin, double start, double sys_hz, const UartFormat& format, const uint8_t* data,
                  size_t len) {
    const double bit = uart_bit_cycles(sys_hz, format.baud);
    size_t k = 0;  // Bit index from `start`, so rounding never accumulates.
    auto put = [&](bool level) { pin.set(start + bit * static_cast<double>(k++), level); };

    for (size_t i = 0; i < len; ++i) {
        const uint8_t byte = data[i];
        put(false);  // Start bit.
        unsigned ones = 0;
        for (unsigned b = 0; b < format.data_bits; ++b) {
            const bool level = (byte >> b) & 1u;
            ones += level ? 1u : 0u;
            put(level);
        }
        if (format.parity == 'E') put(ones % 2 != 0);
        if (format.parity == 'O') put(ones % 2 == 0);
        for (unsigned s = 0; s < format.stop_bits; ++s) put(true);
    }
    return start + bit * static_cast<double>(k);
}

}  // namespace proto
