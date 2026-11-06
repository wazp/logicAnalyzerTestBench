// Unit tests for the protocol encoders (src/core/protocols/) and the default
// protocol frame (src/core/protocol_frame.cpp). Each test decodes the
// waveform the way a logic analyzer's decoder would, by sampling it.

#include <cstdint>
#include <string>
#include <vector>

#include "core/protocol_frame.h"
#include "core/protocols/i2c.h"
#include "core/protocols/nec.h"
#include "core/protocols/onewire.h"
#include "core/protocols/quadrature.h"
#include "core/protocols/spi.h"
#include "core/protocols/uart.h"
#include "core/protocols/ws2812.h"
#include "core/timeline.h"
#include "test_harness.h"

namespace {

constexpr double kSys = 150e6;

struct TestPin {
    std::vector<uint32_t> storage = std::vector<uint32_t>(4096);
    wave::PinWave w;
    explicit TestPin(bool initial) { w.init(storage.data(), storage.size(), initial); }
    bool at(double t) const { return w.level_at(static_cast<uint32_t>(t)); }
};

double us(double v) { return v * kSys / 1e6; }

// Times of rising (true) or falling (false) edges of a pin.
std::vector<uint32_t> edges(const wave::PinWave& w, bool rising) {
    std::vector<uint32_t> out;
    bool level = w.initial;
    for (size_t i = 0; i < w.count; ++i) {
        level = !level;
        if (level == rising) out.push_back(w.toggles[i]);
    }
    return out;
}

// Bytes sampled MSB first on each rising clock edge (SPI, I²C data bits).
std::vector<int> sample_on_rising(const wave::PinWave& clock, const wave::PinWave& data) {
    std::vector<int> bits;
    for (uint32_t t : edges(clock, true)) bits.push_back(data.level_at(t) ? 1 : 0);
    return bits;
}

int bits_to_byte(const std::vector<int>& bits, size_t from) {
    int v = 0;
    for (size_t i = 0; i < 8; ++i) v = (v << 1) | bits[from + i];
    return v;
}

}  // namespace

// --- UART ------------------------------------------------------------------

TEST(uart_frames_a_byte_lsb_first) {
    TestPin tx(true);
    const uint8_t data[] = {0x41};  // 'A' = 0100 0001
    const double start = 1000;
    const double end = proto::uart_write(tx.w, start, kSys, {}, data, 1);
    const double bit = kSys / 115200;
    CHECK_NEAR(end, start + 10 * bit, 1e-6);
    const int expected[] = {0, 1, 0, 0, 0, 0, 0, 1, 0, 1};  // start, bits 0..7, stop
    for (int k = 0; k < 10; ++k) {
        CHECK_EQ(tx.at(start + (k + 0.5) * bit) ? 1 : 0, expected[k]);
    }
}

TEST(uart_even_parity_and_two_stop_bits) {
    TestPin tx(true);
    const uint8_t data[] = {0x07};  // Three ones: even parity bit is 1.
    proto::UartFormat f;
    f.parity = 'E';
    f.stop_bits = 2;
    const double bit = kSys / f.baud;
    const double end = proto::uart_write(tx.w, 0, kSys, f, data, 1);
    CHECK_NEAR(end, 12 * bit, 1e-6);
    CHECK(tx.at(9.5 * bit));  // Parity.
    CHECK(tx.at(10.5 * bit) && tx.at(11.5 * bit));
}

// --- I²C -------------------------------------------------------------------

TEST(i2c_write_then_read_with_repeated_start) {
    TestPin scl(true), sda(true);
    proto::I2cBus bus(scl.w, sda.w, kSys, 100000, 1000);
    bus.start();
    bus.byte(proto::i2c_address_byte(0x48, false), true);
    bus.byte(0x00, true);
    bus.repeated_start();
    bus.byte(proto::i2c_address_byte(0x48, true), true);
    bus.byte(0x19, true);
    bus.byte(0x00, false);
    bus.stop();

    const auto bits = sample_on_rising(scl.w, sda.w);
    // 5 bytes x 9 clocks, plus the clocks that carry the repeated START and the STOP.
    CHECK_EQ(bits.size(), 47u);
    CHECK_EQ(bits_to_byte(bits, 0), 0x90);
    CHECK_EQ(bits[8], 0);  // ACK
    CHECK_EQ(bits_to_byte(bits, 9), 0x00);
    CHECK_EQ(bits_to_byte(bits, 19), 0x91);  // After the repeated START clock at index 18.
    CHECK_EQ(bits_to_byte(bits, 28), 0x19);
    CHECK_EQ(bits[36], 0);                   // Controller ACKs the first data byte.
    CHECK_EQ(bits_to_byte(bits, 37), 0x00);
    CHECK_EQ(bits[45], 1);                   // ...and NAKs the last one.

    // START and repeated START: SDA falls while SCL is high. STOP: SDA rises
    // while SCL is high. No other SDA edge happens while SCL is high.
    int starts = 0, stops = 0;
    bool level = sda.w.initial;
    for (size_t i = 0; i < sda.w.count; ++i) {
        level = !level;
        const uint32_t t = sda.w.toggles[i];
        if (scl.w.level_at(t)) (level ? stops : starts)++;
    }
    CHECK_EQ(starts, 2);
    CHECK_EQ(stops, 1);
    CHECK(scl.w.level && sda.w.level);  // Bus idle at the end.
}

TEST(i2c_clock_is_100khz) {
    TestPin scl(true), sda(true);
    proto::I2cBus bus(scl.w, sda.w, kSys, 100000, 0);
    bus.start();
    bus.byte(0xA5, true);
    const auto rises = edges(scl.w, true);
    for (size_t i = 1; i < rises.size(); ++i) CHECK_NEAR(rises[i] - rises[i - 1], 1500.0, 1.0);
}

// --- SPI -------------------------------------------------------------------

TEST(spi_mode0_jedec_id) {
    TestPin sck(false), mosi(false), miso(true), cs(true);
    const uint8_t out[] = {0x9F, 0, 0, 0};
    const uint8_t in[] = {0xFF, 0xEF, 0x40, 0x18};
    const double end = proto::spi_transfer({sck.w, mosi.w, miso.w, cs.w}, 1000, kSys, 1000000, out, in, 4);
    const auto mo = sample_on_rising(sck.w, mosi.w);
    const auto mi = sample_on_rising(sck.w, miso.w);
    CHECK_EQ(mo.size(), 32u);
    CHECK_EQ(bits_to_byte(mo, 0), 0x9F);
    CHECK_EQ(bits_to_byte(mi, 8), 0xEF);
    CHECK_EQ(bits_to_byte(mi, 16), 0x40);
    CHECK_EQ(bits_to_byte(mi, 24), 0x18);
    // CS low around every clock, high again at the end; SCK idles low.
    for (uint32_t t : edges(sck.w, true)) CHECK(!cs.w.level_at(t));
    CHECK(cs.at(end + 1));
    CHECK(!sck.w.level);
    CHECK_NEAR(end - 1000, 32 * 150 + 75, 1e-6);  // 1 MHz: 150 cycles per bit, plus CS hold.
}

// --- WS2812 ----------------------------------------------------------------

TEST(ws2812_bits_are_pulse_widths) {
    TestPin d(false);
    const proto::Rgb led[] = {{0xFF, 0x00, 0x81}};  // GRB on the wire: 00 FF 81
    const double end = proto::ws2812_write(d.w, 1000, kSys, {}, led, 1);
    CHECK_NEAR(end, 1000 + 24 * 187.5, 1e-6);
    const auto rises = edges(d.w, true);
    const auto falls = edges(d.w, false);
    CHECK_EQ(rises.size(), 24u);
    uint32_t grb = 0;
    for (size_t i = 0; i < 24; ++i) {
        const uint32_t width = falls[i] - rises[i];
        CHECK(width == 60 || width == 120);  // 0.4 us or 0.8 us at 150 MHz.
        grb = (grb << 1) | (width == 120 ? 1u : 0u);
    }
    CHECK_EQ(grb, 0x00FF81u);
}

// --- 1-Wire ----------------------------------------------------------------

TEST(onewire_crc8_matches_reference) {
    const uint8_t check[] = {'1', '2', '3', '4', '5', '6', '7', '8', '9'};
    CHECK_EQ(proto::onewire_crc8(check, 9), 0xA1);
    uint8_t pad[9];
    protocol_frame::onewire_scratchpad(config::kProtocols, pad);
    CHECK_EQ(proto::onewire_crc8(pad, 9), 0);  // CRC over data plus CRC is zero.
    CHECK_EQ(pad[0], 0x91);
    CHECK_EQ(pad[1], 0x01);
}

TEST(onewire_reset_presence_and_slots) {
    TestPin dq(true);
    proto::OneWire ow(dq.w, kSys, 0);
    ow.reset();
    CHECK(!dq.at(us(479)));
    CHECK(dq.at(us(481)));
    CHECK(!dq.at(us(480 + 31)));   // Presence pulse.
    CHECK(dq.at(us(480 + 151)));
    CHECK_NEAR(ow.time(), us(960), 1e-6);

    const double slots = ow.time();
    ow.write_byte(0xCC);  // 0011 0011, LSB first: 0,0,1,1,0,0,1,1
    ow.read_byte(0x91);   // 1001 0001, LSB first: 1,0,0,0,1,0,0,1
    const int written[] = {0, 0, 1, 1, 0, 0, 1, 1};
    const int read[] = {1, 0, 0, 0, 1, 0, 0, 1};
    for (int i = 0; i < 8; ++i) {
        const double slot = slots + us(70) * i;
        CHECK(!dq.at(slot + 1));  // Every slot starts with the controller pulling low.
        CHECK_EQ(dq.at(slot + us(15)) ? 1 : 0, written[i]);  // Device samples at about 15-30 us.
        const double rslot = slots + us(70) * (8 + i);
        CHECK_EQ(dq.at(rslot + us(15)) ? 1 : 0, read[i]);  // Controller samples at 15 us.
    }
}

// --- IR (NEC) --------------------------------------------------------------

TEST(nec_frame_decodes_to_address_and_command) {
    TestPin ir(true);
    const double end = proto::nec_frame(ir.w, 1000, kSys, 0x00, 0x45) - 1000;
    // Low = burst. Measure each space (high) after a burst to read the bits.
    const auto falls = edges(ir.w, false);
    const auto rises = edges(ir.w, true);
    CHECK_EQ(falls.size(), 34u);  // Leader + 32 bits + final burst.
    CHECK_NEAR(rises[0] - falls[0], us(9000), 1.0);
    CHECK_NEAR(falls[1] - rises[0], us(4500), 1.0);
    uint32_t value = 0;
    for (int i = 0; i < 32; ++i) {
        const double space = falls[i + 2] - rises[i + 1];
        CHECK(std::abs(space - us(562.5)) < 2 || std::abs(space - us(1687.5)) < 2);
        if (space > us(1000)) value |= 1u << i;  // LSB first.
    }
    CHECK_EQ(value & 0xFF, 0x00u);
    CHECK_EQ((value >> 8) & 0xFF, 0xFFu);
    CHECK_EQ((value >> 16) & 0xFF, 0x45u);
    CHECK_EQ((value >> 24) & 0xFF, 0xBAu);
    CHECK_NEAR(end, us(9000 + 4500 + 16 * 1125 + 16 * 2250 + 562.5), 2.0);  // 67.5 ms for 16 zeros and 16 ones.
}

// --- Quadrature ------------------------------------------------------------

TEST(quadrature_a_leads_forward_b_leads_backward) {
    TestPin a(false), b(false);
    proto::Quadrature q(a.w, b.w);
    q.move(100, 1000, 4);
    // Forward: A rises first (B low), then B rises (A high).
    CHECK(a.at(150) && !b.at(150));
    CHECK(a.at(1150) && b.at(1150));
    CHECK_EQ(q.phase(), 0);
    q.move(10000, 1000, -1);
    // Backward from phase 0 to 3: B rises while A is low.
    CHECK(!a.at(10050) && b.at(10050));
}

// --- The default frame ------------------------------------------------------

TEST(default_protocol_frame_builds_and_encodes) {
    std::vector<uint32_t> pool(protocol_frame::kPoolSize);
    static protocol_frame::Frame frame;
    const char* error = protocol_frame::build(frame, config::kProtocols, 150000000, pool.data());
    CHECK(error == nullptr);
    CHECK_EQ(frame.frame_cycles, 18000000u);  // 120 ms.

    std::vector<uint32_t> words(16384);
    const auto r = timeline::encode(frame.pins, protocol_frame::kPinCount, frame.frame_cycles, words.data(),
                                    words.size());
    CHECK(r.valid);
    CHECK_EQ(r.total_cycles, 18000000u);
    CHECK(r.max_shift_cycles <= 2);
    CHECK(r.word_count < 16384);

    // The WS2812 updates carry the rainbow and every protocol shows up.
    int uart = 0, i2c_nak = 0, spi = 0, ws = 0, ow = 0, ir = 0, quad = 0;
    for (size_t i = 0; i < frame.window_count; ++i) {
        const std::string p = frame.windows[i].protocol;
        const std::string label = frame.windows[i].label;
        uart += p == "uart";
        i2c_nak += p == "i2c" && label == "nak";
        spi += p == "spi";
        ws += p == "ws2812";
        ow += p == "onewire";
        ir += p == "ir";
        quad += p == "quadrature";
        CHECK(frame.windows[i].end < frame.frame_cycles);
    }
    CHECK_EQ(uart, 8);
    CHECK_EQ(i2c_nak, 1);
    CHECK_EQ(spi, 12);
    CHECK_EQ(ws, 12);
    CHECK_EQ(ow, 2);
    CHECK_EQ(ir, 2);
    CHECK_EQ(quad, 2);
}

TEST(default_uart_messages) {
    char text[32];
    protocol_frame::uart_message(config::kProtocols, 1, text, sizeof(text));
    CHECK_EQ(std::string(text), "Test bench #1\r\n");
}
