// Builds the 120 ms protocol frame for GP10-GP22: every protocol in
// config::ProtocolConfig placed on its own pins, as one wave per pin.
// timeline::encode() then turns the waves into PIO words.
//
// Also records where each transaction sits in the frame (Window), so the
// exporter can hand the web guide one example of each and the console can
// describe them. SDK-free so it can be unit tested on the host.

#pragma once

#include <cstddef>
#include <cstdint>

#include "core/protocols/ws2812.h"
#include "core/wave.h"
#include "signal_config.h"

namespace protocol_frame {

// Pin index inside the timeline (bit n of a timeline word = GP10 + n).
enum Pin : unsigned {
    kUartTx,
    kUartRx,
    kI2cScl,
    kI2cSda,
    kSpiSck,
    kSpiMosi,
    kSpiMiso,
    kSpiCs,
    kWs2812,
    kOneWire,
    kIr,
    kQuadA,
    kQuadB,
    kPinCount
};
static_assert(kPinCount == pins::kTimelinePinCount, "pin enum must match board_pins.h");

// One transaction in the frame, for documentation and the web guide.
struct Window {
    const char* protocol;  // "uart", "i2c", "spi", "ws2812", "onewire", "ir", "quadrature"
    const char* label;     // e.g. "read", "nak", "convert"
    uint32_t start;        // Cycles from the frame start.
    uint32_t end;
};

constexpr size_t kMaxWindows = 64;

// Toggle storage each pin needs for the default config, with headroom.
// Sum of all of them is kPoolSize.
constexpr size_t kPinCapacity[kPinCount] = {
    800,   // UART TX: 4 messages x 15 characters x 10 bits
    256,   // UART RX
    1536,  // I²C SCL
    1024,  // I²C SDA
    1024,  // SPI SCK
    512,   // SPI MOSI
    512,   // SPI MISO
    64,    // SPI CS
    5120,  // WS2812: 12 updates x 8 LEDs x 24 bits x 2 edges
    512,   // 1-Wire
    256,   // IR
    128,   // Quadrature A
    128,   // Quadrature B
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
const char* build(Frame& out, const config::ProtocolConfig& c, uint32_t sys_hz, uint32_t* pool);

// The bytes and text the frame carries, for tests, the exporter and lessons.
size_t uart_message(const config::ProtocolConfig& c, unsigned index, char* out, size_t size);  // index from 1
void onewire_scratchpad(const config::ProtocolConfig& c, uint8_t (&out)[9]);
constexpr unsigned kMaxWs2812Leds = 16;
void ws2812_colors(const config::ProtocolConfig& c, unsigned update, proto::Rgb* out);  // c.ws2812_leds entries

}  // namespace protocol_frame
