#include "core/faults_frame.h"

#include <cmath>
#include <cstdio>
#include <cstring>

#include "core/protocols/i2c.h"
#include "core/protocols/onewire.h"
#include "core/protocols/spi.h"
#include "core/protocols/uart.h"

namespace faults_frame {

namespace {

// Pin levels at the start of the frame, as in the Protocols preset; the
// interrupt line idles high (active low).
constexpr bool kIdleHigh[kPinCount] = {
    true,   // UART TX
    true,   // UART with parity
    true,   // I²C SCL
    true,   // I²C SDA
    false,  // SPI SCK (mode 0)
    false,  // SPI MOSI
    true,   // SPI MISO
    true,   // SPI CS
    false,  // WS2812
    true,   // 1-Wire
    true,   // Interrupt line
    false, false,
};

}  // namespace

size_t uart_message(const config::FaultsConfig& c, unsigned number, char* out, size_t size) {
    const int n = std::snprintf(out, size, "%s%u\r\n", c.uart_text, number);
    return n < 0 ? 0 : static_cast<size_t>(n) < size ? static_cast<size_t>(n) : size - 1;
}

uint32_t slow_baud(const config::FaultsConfig& c) {
    return static_cast<uint32_t>(std::lround(c.uart_baud * (1.0 - c.uart_slow_percent / 100.0)));
}

void onewire_scratchpad(const config::FaultsConfig& c, uint8_t (&out)[9]) {
    // A DS18B20 scratchpad (see protocol_frame.cpp), CRC over the good bytes,
    // then one byte damaged on the way, so the CRC no longer matches.
    out[0] = static_cast<uint8_t>(c.onewire_raw_temp & 0xFF);
    out[1] = static_cast<uint8_t>(c.onewire_raw_temp >> 8);
    out[2] = 0x4B;
    out[3] = 0x46;
    out[4] = 0x7F;
    out[5] = 0xFF;
    out[6] = 0x0C;
    out[7] = 0x10;
    out[8] = proto::onewire_crc8(out, 8);
    out[c.onewire_bad_byte] ^= c.onewire_bad_xor;
}

void ws2812_colors(const config::FaultsConfig& c, proto::Rgb* out) {
    for (unsigned i = 0; i < c.ws2812_leds; ++i) out[i] = {c.ws2812_level, c.ws2812_level, c.ws2812_level};
}

proto::Ws2812Fault ws2812_fault(const config::FaultsConfig& c) {
    return {c.ws2812_bad_led, c.ws2812_bad_bit, static_cast<double>(c.ws2812_bad_high_ns)};
}

const char* build(Frame& f, const config::FaultsConfig& c, uint32_t sys_hz, uint32_t* pool) {
    f.window_count = 0;
    f.frame_cycles = static_cast<uint32_t>(static_cast<double>(c.frame_us) * sys_hz / 1e6);
    size_t used = 0;
    for (unsigned p = 0; p < kPinCount; ++p) {
        f.pins[p].init(pool + used, kPinCapacity[p], kIdleHigh[p]);
        used += kPinCapacity[p];
    }
    const double hz = static_cast<double>(sys_hz);
    auto at_us = [&](double us) { return us * hz / 1e6; };
    auto window = [&](const char* part, const char* label, double start, double end) {
        if (f.window_count < kMaxWindows) {
            f.windows[f.window_count++] = {part, label, static_cast<uint32_t>(start), static_cast<uint32_t>(end + 0.5)};
        }
    };

    // --- UART 8N1: good, slow sender, framing error ---
    {
        char text[48];
        const proto::UartFormat good{c.uart_baud, 8, 'N', 1};
        const proto::UartFormat slow{slow_baud(c), 8, 'N', 1};
        size_t len = uart_message(c, 1, text, sizeof(text));
        double start = at_us(c.uart_good_us);
        window("uart", "good", start, proto::uart_write(f.pins[kUartTx], start, hz, good,
                                                        reinterpret_cast<const uint8_t*>(text), len));
        len = uart_message(c, 2, text, sizeof(text));
        start = at_us(c.uart_slow_us);
        window("uart", "slow", start, proto::uart_write(f.pins[kUartTx], start, hz, slow,
                                                        reinterpret_cast<const uint8_t*>(text), len));
        len = uart_message(c, 3, text, sizeof(text));
        start = at_us(c.uart_framing_us);
        proto::UartFaults framing;
        framing.bad_stop = static_cast<long>(std::strlen(c.uart_text));  // The message number.
        window("uart", "framing", start, proto::uart_write(f.pins[kUartTx], start, hz, good,
                                                           reinterpret_cast<const uint8_t*>(text), len, framing));
    }

    // --- UART 8E1: good, then a parity error ---
    {
        const proto::UartFormat even{c.uart_baud, 8, 'E', 1};
        const auto* text = reinterpret_cast<const uint8_t*>(c.parity_text);
        const size_t len = std::strlen(c.parity_text);
        double start = at_us(c.parity_good_us);
        window("parity", "good", start, proto::uart_write(f.pins[kUartParity], start, hz, even, text, len));
        start = at_us(c.parity_bad_us);
        proto::UartFaults parity;
        parity.bad_parity = c.parity_bad_index;
        window("parity", "bad", start, proto::uart_write(f.pins[kUartParity], start, hz, even, text, len, parity));
    }

    // --- I²C: a stretched read, then a write whose data the sensor refuses ---
    {
        double start = at_us(c.i2c_read_us);
        proto::I2cBus bus(f.pins[kI2cScl], f.pins[kI2cSda], hz, c.i2c_hz, start);
        bus.start();
        bus.byte(proto::i2c_address_byte(c.i2c_address, false), true);
        bus.byte(0x00, true);  // Temperature register.
        bus.repeated_start();
        bus.byte(proto::i2c_address_byte(c.i2c_address, true), true);
        bus.stretch(at_us(c.i2c_stretch_us));  // The sensor is not ready: it holds SCL low.
        bus.byte(static_cast<uint8_t>(c.i2c_value >> 8), true);
        bus.byte(static_cast<uint8_t>(c.i2c_value & 0xFF), false);
        bus.stop();
        window("i2c", "stretch", start, bus.time());

        start = at_us(c.i2c_write_us);
        proto::I2cBus write(f.pins[kI2cScl], f.pins[kI2cSda], hz, c.i2c_hz, start);
        write.start();
        write.byte(proto::i2c_address_byte(c.i2c_address, false), true);
        write.byte(c.i2c_config_register, true);
        write.byte(c.i2c_config_value, false);  // NAK: the sensor does not accept the data.
        write.stop();
        window("i2c", "data_nak", start, write.time());
    }

    // --- SPI: an aborted transfer and its retry, then a device in the wrong mode ---
    {
        const proto::SpiPins pins{f.pins[kSpiSck], f.pins[kSpiMosi], f.pins[kSpiMiso], f.pins[kSpiCs]};
        const uint8_t mosi[4] = {c.spi_command, 0, 0, 0};
        const uint8_t miso[4] = {0xFF, c.spi_reply[0], c.spi_reply[1], c.spi_reply[2]};
        proto::SpiFaults abort;
        abort.stop_after_bits = c.spi_abort_bits;
        double start = at_us(c.spi_abort_us);
        const double abort_end = proto::spi_transfer(pins, start, hz, c.spi_hz, mosi, miso, 4, abort);
        const double retry = at_us(c.spi_retry_us);
        if (abort_end >= retry) return "the SPI retry starts before the aborted transfer ends";
        window("spi", "abort", start, proto::spi_transfer(pins, retry, hz, c.spi_hz, mosi, miso, 4));

        proto::SpiFaults mode1;
        mode1.miso_after_rise = wave::ns_to_cycles(c.spi_mode1_delay_ns, hz);
        if (mode1.miso_after_rise >= hz / c.spi_hz / 2.0) return "the wrong-mode MISO delay must be under half a clock";
        start = at_us(c.spi_mode1_us);
        window("spi", "mode1", start, proto::spi_transfer(pins, start, hz, c.spi_hz, mosi, miso, 4, mode1));
    }

    // --- WS2812: the same dim white on every LED, one bit too short ---
    {
        if (c.ws2812_leds > protocol_frame::kMaxWs2812Leds) return "too many WS2812 LEDs";
        proto::Rgb leds[protocol_frame::kMaxWs2812Leds];
        ws2812_colors(c, leds);
        for (unsigned i = 0; i < c.ws2812_count; ++i) {
            const double start = at_us(c.ws2812_first_us + i * c.ws2812_period_us);
            const double end =
                proto::ws2812_write(f.pins[kWs2812], start, hz, {}, leds, c.ws2812_leds, ws2812_fault(c));
            window("ws2812", "update", start, end);
        }
    }

    // --- 1-Wire: nobody answers, then a read with a bad CRC ---
    {
        double start = at_us(c.onewire_absent_us);
        proto::OneWire absent(f.pins[kOneWire], hz, start);
        absent.reset(false);
        window("onewire", "absent", start, absent.time());

        start = at_us(c.onewire_read_us);
        proto::OneWire ow(f.pins[kOneWire], hz, start);
        ow.reset();
        ow.write_byte(0xCC);  // Skip ROM.
        ow.write_byte(0xBE);  // Read Scratchpad.
        uint8_t pad[9];
        onewire_scratchpad(c, pad);
        for (uint8_t byte : pad) ow.read_byte(byte);
        window("onewire", "bad_crc", start, ow.time());
    }

    // --- Interrupt line: real pulses and glitches, in time order ---
    {
        struct Pulse {
            uint32_t at_us;
            uint32_t width_ns;
            const char* label;
        };
        Pulse pulses[5] = {{c.irq_pulse_us[0], c.irq_pulse_ns, "pulse"}, {c.irq_pulse_us[1], c.irq_pulse_ns, "pulse"},
                           {c.glitch_at_us[0], c.glitch_ns[0], "glitch"}, {c.glitch_at_us[1], c.glitch_ns[1], "glitch"},
                           {c.glitch_at_us[2], c.glitch_ns[2], "glitch"}};
        for (unsigned i = 1; i < 5; ++i) {  // Insertion sort by time.
            for (unsigned j = i; j > 0 && pulses[j].at_us < pulses[j - 1].at_us; --j) {
                const Pulse tmp = pulses[j];
                pulses[j] = pulses[j - 1];
                pulses[j - 1] = tmp;
            }
        }
        for (const Pulse& p : pulses) {
            const double start = at_us(p.at_us);
            const double end = start + wave::ns_to_cycles(p.width_ns, hz);
            f.pins[kIrq].set(start, false);
            f.pins[kIrq].set(end, true);
            window("irq", p.label, start, end);
        }
    }

    for (unsigned p = 0; p < kPinCount; ++p) {
        const wave::PinWave& w = f.pins[p];
        if (w.overflow) return "a faults pin needs more edges than kPinCapacity allows";
        if (w.out_of_order) return "transactions overlap on one faults pin";
        if (w.level != w.initial) return "a faults pin does not end the frame at its idle level";
        if (w.count > 0 && w.last >= f.frame_cycles) return "a fault runs past the end of the frame";
    }
    return nullptr;
}

}  // namespace faults_frame
