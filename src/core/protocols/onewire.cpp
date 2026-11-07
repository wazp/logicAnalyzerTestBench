#include "core/protocols/onewire.h"

namespace proto {

namespace {

constexpr double kResetLowUs = kOneWireResetLowUs;
constexpr double kPresenceWaitUs = 30.0;   // After release, before the device pulls low (15-60).
constexpr double kPresenceLowUs = kOneWirePresenceLowUs;
constexpr double kResetRecoveryUs = 480.0;  // From release to the first slot.
constexpr double kSlotUs = 70.0;
constexpr double kWrite1LowUs = 6.0;
constexpr double kWrite0LowUs = 60.0;
constexpr double kReadLowUs = 6.0;       // The controller's start of a read slot.
constexpr double kRead0HoldUs = 30.0;    // How long the device holds a 0 low.

}  // namespace

OneWire::OneWire(wave::PinWave& dq, double sys_hz, double start_at) : dq_(dq), sys_hz_(sys_hz), t_(start_at) {}

void OneWire::low_then_high(double low_us, double slot_us) {
    dq_.set(t_, false);
    dq_.set(t_ + us(low_us), true);
    t_ += us(slot_us);
}

void OneWire::reset(bool presence) {
    dq_.set(t_, false);
    const double release = t_ + us(kResetLowUs);
    dq_.set(release, true);
    if (presence) {
        dq_.set(release + us(kPresenceWaitUs), false);  // Presence pulse from the device.
        dq_.set(release + us(kPresenceWaitUs + kPresenceLowUs), true);
    }
    t_ = release + us(kResetRecoveryUs);
}

void OneWire::write_byte(uint8_t value) {
    for (int b = 0; b < 8; ++b) {
        low_then_high(((value >> b) & 1u) ? kWrite1LowUs : kWrite0LowUs, kSlotUs);
    }
}

void OneWire::read_byte(uint8_t value) {
    for (int b = 0; b < 8; ++b) {
        // For a 0 the device keeps the line low after the controller lets go.
        low_then_high(((value >> b) & 1u) ? kReadLowUs : kRead0HoldUs, kSlotUs);
    }
}

uint8_t onewire_crc8(const uint8_t* data, size_t len) {
    uint8_t crc = 0;
    for (size_t i = 0; i < len; ++i) {
        uint8_t in = data[i];
        for (int b = 0; b < 8; ++b) {
            const bool mix = (crc ^ in) & 1u;
            crc >>= 1;
            if (mix) crc ^= 0x8C;
            in >>= 1;
        }
    }
    return crc;
}

}  // namespace proto
