#include "core/protocol_frame.h"

#include <cstdio>
#include <cstring>

#include "core/protocols/i2c.h"
#include "core/protocols/nec.h"
#include "core/protocols/onewire.h"
#include "core/protocols/quadrature.h"
#include "core/protocols/spi.h"
#include "core/protocols/uart.h"

namespace protocol_frame {

namespace {

// Pin levels at the start of the frame: everything idles where its protocol
// expects (UART, I²C, SPI CS and MISO, 1-Wire and the IR receiver high).
constexpr bool kIdleHigh[kPinCount] = {
    true,   // UART TX
    true,   // UART RX
    true,   // I²C SCL
    true,   // I²C SDA
    false,  // SPI SCK (mode 0)
    false,  // SPI MOSI
    true,   // SPI MISO (released, pulled up)
    true,   // SPI CS (inactive)
    false,  // WS2812
    true,   // 1-Wire
    true,   // IR receiver output (active low)
    false,  // Quadrature A
    false,  // Quadrature B
};

struct Builder {
    Frame& f;
    double sys_hz;

    double at_us(uint32_t us) const { return static_cast<double>(us) * sys_hz / 1e6; }
    wave::PinWave& pin(Pin p) { return f.pins[p]; }

    void window(const char* protocol, const char* label, double start, double end) {
        if (f.window_count < kMaxWindows) {
            f.windows[f.window_count++] = {protocol, label, static_cast<uint32_t>(start), static_cast<uint32_t>(end + 0.5)};
        }
    }
};

}  // namespace

size_t uart_message(const config::ProtocolConfig& c, unsigned index, char* out, size_t size) {
    const int n = std::snprintf(out, size, "%s%u\r\n", c.uart_text, index);
    return n < 0 ? 0 : static_cast<size_t>(n) < size ? static_cast<size_t>(n) : size - 1;
}

void onewire_scratchpad(const config::ProtocolConfig& c, uint8_t (&out)[9]) {
    // DS18B20 scratchpad: temperature LSB/MSB, alarm limits TH/TL, config
    // (0x7F = 12-bit resolution), three reserved bytes, then the CRC.
    out[0] = static_cast<uint8_t>(c.onewire_raw_temp & 0xFF);
    out[1] = static_cast<uint8_t>(c.onewire_raw_temp >> 8);
    out[2] = 0x4B;  // TH: 75 C
    out[3] = 0x46;  // TL: 70 C
    out[4] = 0x7F;
    out[5] = 0xFF;
    out[6] = 0x0C;
    out[7] = 0x10;
    out[8] = proto::onewire_crc8(out, 8);
}

void ws2812_colors(const config::ProtocolConfig& c, unsigned update, proto::Rgb* out) {
    // Eight hues around the color wheel, scaled to the brightness. Each update
    // moves the rainbow one LED along the strip.
    static constexpr proto::Rgb kWheel[8] = {{255, 0, 0},   {255, 128, 0}, {255, 255, 0}, {0, 255, 0},
                                             {0, 255, 255}, {0, 0, 255},   {128, 0, 255}, {255, 0, 128}};
    auto scale = [&](uint8_t v) { return static_cast<uint8_t>(v * c.ws2812_brightness / 255); };
    for (unsigned i = 0; i < c.ws2812_leds && i < kMaxWs2812Leds; ++i) {
        const proto::Rgb& w = kWheel[(i + update) % 8];
        out[i] = {scale(w.r), scale(w.g), scale(w.b)};
    }
}

const char* build(Frame& f, const config::ProtocolConfig& c, uint32_t sys_hz, uint32_t* pool) {
    f.window_count = 0;
    f.frame_cycles = static_cast<uint32_t>(static_cast<double>(c.frame_us) * sys_hz / 1e6);
    size_t used = 0;
    for (unsigned p = 0; p < kPinCount; ++p) {
        f.pins[p].init(pool + used, kPinCapacity[p], kIdleHigh[p]);
        used += kPinCapacity[p];
    }
    Builder b{f, static_cast<double>(sys_hz)};

    // --- UART: messages on TX, the device's reply on RX ---
    const proto::UartFormat uart{c.uart_baud, 8, 'N', 1};
    for (unsigned i = 0; i < c.uart_count; ++i) {
        char text[48];
        const size_t len = uart_message(c, i + 1, text, sizeof(text));
        const double start = b.at_us(c.uart_first_us + i * c.uart_period_us);
        const double end =
            proto::uart_write(b.pin(kUartTx), start, b.sys_hz, uart, reinterpret_cast<const uint8_t*>(text), len);
        b.window("uart", "message", start, end);
        const double reply_start = end + b.at_us(c.uart_reply_delay_us);
        const double reply_end =
            proto::uart_write(b.pin(kUartRx), reply_start, b.sys_hz, uart,
                              reinterpret_cast<const uint8_t*>(c.uart_reply), std::strlen(c.uart_reply));
        b.window("uart", "reply", reply_start, reply_end);
    }

    // --- I²C: register reads, then one NAK ---
    for (unsigned i = 0; i < c.i2c_count; ++i) {
        const double start = b.at_us(c.i2c_first_us + i * c.i2c_period_us);
        proto::I2cBus bus(b.pin(kI2cScl), b.pin(kI2cSda), b.sys_hz, c.i2c_hz, start);
        const bool missing = (i + 1 == c.i2c_count);
        bus.start();
        if (missing) {
            bus.byte(proto::i2c_address_byte(c.i2c_missing_address, false), false);  // Nobody answers.
            bus.stop();
            b.window("i2c", "nak", start, bus.time());
            continue;
        }
        bus.byte(proto::i2c_address_byte(c.i2c_address, false), true);
        bus.byte(c.i2c_register, true);
        bus.repeated_start();
        bus.byte(proto::i2c_address_byte(c.i2c_address, true), true);
        bus.byte(static_cast<uint8_t>(c.i2c_value >> 8), true);     // Controller ACKs: send more.
        bus.byte(static_cast<uint8_t>(c.i2c_value & 0xFF), false);  // Controller NAKs: last byte.
        bus.stop();
        b.window("i2c", "read", start, bus.time());
    }

    // --- SPI: JEDEC ID reads ---
    for (unsigned i = 0; i < c.spi_count; ++i) {
        const double start = b.at_us(c.spi_first_us + i * c.spi_period_us);
        const uint8_t mosi[4] = {c.spi_command, 0, 0, 0};
        // While the command goes out, the flash's output is still released
        // (reads as 0xFF with a pull-up); then it answers.
        const uint8_t miso[4] = {0xFF, c.spi_reply[0], c.spi_reply[1], c.spi_reply[2]};
        const double end = proto::spi_transfer({b.pin(kSpiSck), b.pin(kSpiMosi), b.pin(kSpiMiso), b.pin(kSpiCs)},
                                               start, b.sys_hz, c.spi_hz, mosi, miso, 4);
        b.window("spi", "jedec_id", start, end);
    }

    // --- WS2812: a moving rainbow ---
    if (c.ws2812_leds > kMaxWs2812Leds) {
        return "too many WS2812 LEDs";
    }
    for (unsigned i = 0; i < c.ws2812_count; ++i) {
        proto::Rgb leds[kMaxWs2812Leds];
        ws2812_colors(c, i, leds);
        const double start = b.at_us(c.ws2812_first_us + i * c.ws2812_period_us);
        const double end = proto::ws2812_write(b.pin(kWs2812), start, b.sys_hz, {}, leds, c.ws2812_leds);
        b.window("ws2812", "update", start, end);
    }

    // --- 1-Wire: start a conversion, later read the result ---
    {
        const double start = b.at_us(c.onewire_convert_us);
        proto::OneWire ow(b.pin(kOneWire), b.sys_hz, start);
        ow.reset();
        ow.write_byte(0xCC);  // Skip ROM: talk to the only device.
        ow.write_byte(0x44);  // Convert T.
        b.window("onewire", "convert", start, ow.time());
    }
    {
        const double start = b.at_us(c.onewire_read_us);
        proto::OneWire ow(b.pin(kOneWire), b.sys_hz, start);
        ow.reset();
        ow.write_byte(0xCC);  // Skip ROM.
        ow.write_byte(0xBE);  // Read Scratchpad.
        uint8_t pad[9];
        onewire_scratchpad(c, pad);
        for (uint8_t byte : pad) ow.read_byte(byte);
        b.window("onewire", "read", start, ow.time());
    }

    // --- IR remote: a key press and one repeat code ---
    {
        const double start = b.at_us(c.ir_first_us);
        const double end = proto::nec_frame(b.pin(kIr), start, b.sys_hz, c.ir_address, c.ir_command);
        b.window("ir", "frame", start, end);
        const double repeat = start + b.at_us(static_cast<uint32_t>(proto::kNecRepeatPeriodUs));
        const double repeat_end = proto::nec_repeat(b.pin(kIr), repeat, b.sys_hz);
        b.window("ir", "repeat", repeat, repeat_end);
    }

    // --- Quadrature: forward, then back to the start ---
    {
        proto::Quadrature q(b.pin(kQuadA), b.pin(kQuadB));
        const double step = b.at_us(c.quadrature_step_us);
        const double start = b.at_us(c.quadrature_first_us);
        const int steps = static_cast<int>(c.quadrature_steps);
        q.move(start, step, steps);
        const double back = start + step * steps;
        const double end = q.move(back, step, -steps);
        b.window("quadrature", "forward", start, back - step);
        b.window("quadrature", "backward", back, end);
        if (q.phase() != 0) {
            return "quadrature does not end where it started";
        }
    }

    for (unsigned p = 0; p < kPinCount; ++p) {
        const wave::PinWave& w = f.pins[p];
        if (w.overflow) return "a protocol pin needs more edges than kPinCapacity allows";
        if (w.out_of_order) return "protocol transactions overlap on one pin";
        if (w.level != w.initial) return "a protocol pin does not end the frame at its idle level";
        if (w.count > 0 && w.last >= f.frame_cycles) return "a protocol runs past the end of the frame";
    }
    return nullptr;
}

}  // namespace protocol_frame
