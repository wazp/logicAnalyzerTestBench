// Builds the "Faults" timeline frame for GP10-GP22 (see src/core/presets.h):
// the buses of the Protocols preset, each with realistic mistakes next to a
// good transaction, plus an interrupt line with glitches. One wave per pin,
// like src/core/protocol_frame.h, so timeline::encode() plays it on the same
// state machine. SDK-free so it can be unit tested on the host.

#pragma once

#include <cstddef>
#include <cstdint>

#include "core/protocol_frame.h"
#include "core/protocols/ws2812.h"
#include "core/wave.h"
#include "signal_config.h"

namespace faults_frame {

// Pin index inside the timeline (bit n of a timeline word = GP10 + n). The
// buses sit on the same pins as in the Protocols preset, so the wiring does
// not change; the interrupt line takes the IR pin.
enum Pin : unsigned {
    kUartTx,
    kUartParity,
    kI2cScl,
    kI2cSda,
    kSpiSck,
    kSpiMosi,
    kSpiMiso,
    kSpiCs,
    kWs2812,
    kOneWire,
    kIrq,
    kUnused21,  // GP21 and GP22 are held low in this preset.
    kUnused22,
    kPinCount
};
static_assert(kPinCount == pins::kTimelinePinCount, "pin enum must match board_pins.h");

using Window = protocol_frame::Window;
constexpr size_t kMaxWindows = 24;

// Toggle storage each pin needs for the default config, with headroom.
constexpr size_t kPinCapacity[kPinCount] = {
    512,   // UART TX: 3 messages x 16 characters x 10 bits
    256,   // UART parity: 2 messages x 9 characters x 11 bits
    512,   // I²C SCL
    256,   // I²C SDA
    256,   // SPI SCK
    64,    // SPI MOSI
    128,   // SPI MISO
    16,    // SPI CS
    1024,  // WS2812: 2 updates x 8 LEDs x 24 bits x 2 edges
    256,   // 1-Wire
    16,    // Interrupt line
    0, 0,
};
constexpr size_t pool_size() {
    size_t total = 0;
    for (size_t c : kPinCapacity) total += c;
    return total;
}
constexpr size_t kPoolSize = pool_size();

struct Frame {
    wave::PinWave pins[kPinCount];
    uint32_t frame_cycles = 0;
    Window windows[kMaxWindows];
    size_t window_count = 0;
};

// Builds the frame at `sys_hz` into `out`, using `pool` (kPoolSize words) for
// the toggle times. Returns nullptr on success, else a description.
const char* build(Frame& out, const config::FaultsConfig& c, uint32_t sys_hz, uint32_t* pool);

// The content the frame carries, for tests, the exporter and lessons.
size_t uart_message(const config::FaultsConfig& c, unsigned number, char* out, size_t size);
uint32_t slow_baud(const config::FaultsConfig& c);  // Rounded to the nearest whole baud.
void onewire_scratchpad(const config::FaultsConfig& c, uint8_t (&out)[9]);  // As sent, CRC of the good bytes.
void ws2812_colors(const config::FaultsConfig& c, proto::Rgb* out);          // c.ws2812_leds entries, as meant.
proto::Ws2812Fault ws2812_fault(const config::FaultsConfig& c);

}  // namespace faults_frame
