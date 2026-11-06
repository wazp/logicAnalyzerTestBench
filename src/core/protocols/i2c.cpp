#include "core/protocols/i2c.h"

namespace proto {

I2cBus::I2cBus(wave::PinWave& scl, wave::PinWave& sda, double sys_hz, uint32_t clock_hz, double start_at)
    : scl_(scl), sda_(sda), half_(sys_hz / clock_hz / 2.0), t_(start_at) {}

void I2cBus::start() {
    sda_.set(t_, false);         // SDA falls while SCL is high: START.
    scl_.set(t_ + half_, false);  // Hold time, then the first low half begins.
    t_ += half_;
}

void I2cBus::repeated_start() {
    const double q = half_ / 2.0;
    sda_.set(t_ + q, true);      // Release SDA while SCL is low.
    scl_.set(t_ + half_, true);  // Clock high (setup time for the new START).
    sda_.set(t_ + 2 * half_, false);  // SDA falls while SCL is high: repeated START.
    scl_.set(t_ + 3 * half_, false);
    t_ += 3 * half_;
}

void I2cBus::stop() {
    const double q = half_ / 2.0;
    sda_.set(t_ + q, false);  // SDA low while SCL is low...
    scl_.set(t_ + half_, true);
    sda_.set(t_ + 2 * half_, true);  // ...then rises while SCL is high: STOP.
    t_ += 2 * half_;
}

void I2cBus::bit(bool level) {
    sda_.set(t_ + half_ / 2.0, level);  // Change data in the middle of SCL low.
    scl_.set(t_ + half_, true);
    scl_.set(t_ + 2 * half_, false);
    t_ += 2 * half_;
}

void I2cBus::byte(uint8_t value, bool ack) {
    for (int b = 7; b >= 0; --b) {
        bit((value >> b) & 1u);
    }
    bit(!ack);
}

}  // namespace proto
