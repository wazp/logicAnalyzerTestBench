// 1-Wire (Dallas/Maxim) at standard speed, both sides simulated: the
// controller's reset and time slots, and a DS18B20-style device's presence
// pulse and read bits.
//
// Real 1-Wire is open drain with a pull-up. Here the line is driven
// push-pull, which looks the same to a logic analyzer but must never be
// connected to a real bus.
//
// Timing (Maxim application note 126, standard speed, in microseconds):
//   reset:    controller low 480, release; the device waits 30 (spec 15-60),
//             pulls low for 120 (the presence pulse, spec 60-240) and
//             releases; the controller waits until 480 after its release
//   write 1:  low 6, high 64          write 0: low 60, high 10
//   read:     controller low 6, then releases. For a 0 the device keeps the
//             line low (here until 30); for a 1 it goes high at 6. The
//             controller samples at 15. Every slot is 70.
// Bytes go LSB first.

#pragma once

#include <cstddef>
#include <cstdint>

#include "core/wave.h"

namespace proto {

// Public so the guide's lessons can quote them (tools/export_protocols.cpp).
constexpr double kOneWireResetLowUs = 480.0;
constexpr double kOneWirePresenceLowUs = 120.0;

class OneWire {
public:
    // The pin must be idle high.
    OneWire(wave::PinWave& dq, double sys_hz, double start_at);

    void reset(bool presence = true);  // Without `presence`, no device answers.
    void write_byte(uint8_t value);
    void read_byte(uint8_t value);  // The device answers `value`.

    double time() const { return t_; }

private:
    wave::PinWave& dq_;
    double sys_hz_;
    double t_;

    double us(double microseconds) const { return wave::ns_to_cycles(microseconds * 1000.0, sys_hz_); }
    void low_then_high(double low_us, double slot_us);
};

// Dallas/Maxim CRC-8 (polynomial x^8 + x^5 + x^4 + 1, reflected), as used in
// the DS18B20 scratchpad and ROM codes.
uint8_t onewire_crc8(const uint8_t* data, size_t len);

}  // namespace proto
