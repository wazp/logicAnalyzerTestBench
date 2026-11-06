// I²C waveform with both sides simulated: the controller's clock, address and
// data, and the target's ACK bits and read data.
//
// Real I²C is open drain with pull-ups. Here both lines are driven push-pull,
// which looks the same to a logic analyzer but must never be connected to a
// real bus.
//
// Timing for one bit (period = sys_hz / clock_hz, split in two halves):
//   SCL low half: SDA changes in the middle of it
//   SCL high half: SDA stable, the receiver samples it
// START: SDA falls while SCL is high. STOP: SDA rises while SCL is high.

#pragma once

#include <cstdint>

#include "core/wave.h"

namespace proto {

class I2cBus {
public:
    // Both pins must be idle high. `start_at` is the first edge's cycle.
    I2cBus(wave::PinWave& scl, wave::PinWave& sda, double sys_hz, uint32_t clock_hz, double start_at);

    void start();           // From idle.
    void repeated_start();  // From the low half after an ACK bit.
    void stop();            // Ends with both lines high.

    // Eight data bits MSB first, then the ACK bit: SDA low when `ack`, high
    // (NAK) otherwise. Whoever receives the byte drives the ACK.
    void byte(uint8_t value, bool ack);

    double time() const { return t_; }

private:
    wave::PinWave& scl_;
    wave::PinWave& sda_;
    double half_;
    double t_;  // Start of the current SCL low half.

    void bit(bool level);
};

// The SDA byte that addresses a target: 7-bit address, then R/W (1 = read).
inline uint8_t i2c_address_byte(uint8_t address, bool read) {
    return static_cast<uint8_t>((address << 1) | (read ? 1 : 0));
}

}  // namespace proto
