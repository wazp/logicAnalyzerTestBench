// Unit tests for the fault options of the protocol encoders and the "Faults"
// preset frame (src/core/faults_frame.cpp). Each test decodes the waveform the
// way a logic analyzer's decoder would, by sampling it, and checks that the
// fault is exactly the documented one.

#include <cstdint>
#include <cstring>
#include <string>
#include <vector>

#include "core/faults_frame.h"
#include "core/protocols/onewire.h"
#include "core/timeline.h"
#include "test_harness.h"

namespace {

constexpr uint32_t kSysHz = 150000000;
constexpr double kSys = kSysHz;

struct Built {
    std::vector<uint32_t> pool = std::vector<uint32_t>(faults_frame::kPoolSize);
    faults_frame::Frame f;
    const char* error;
    Built() { error = faults_frame::build(f, config::kFaults, kSysHz, pool.data()); }
    const wave::PinWave& pin(faults_frame::Pin p) const { return f.pins[p]; }
    const faults_frame::Window& window(const char* part, const char* label) const {
        for (size_t i = 0; i < f.window_count; ++i) {
            if (std::strcmp(f.windows[i].protocol, part) == 0 && std::strcmp(f.windows[i].label, label) == 0) {
                return f.windows[i];
            }
        }
        static faults_frame::Window none{"", "", 0, 0};
        return none;
    }
};

std::vector<uint32_t> edges(const wave::PinWave& w, bool rising, uint32_t from = 0, uint32_t to = UINT32_MAX) {
    std::vector<uint32_t> out;
    bool level = w.initial;
    for (size_t i = 0; i < w.count; ++i) {
        level = !level;
        if (level == rising && w.toggles[i] >= from && w.toggles[i] <= to) out.push_back(w.toggles[i]);
    }
    return out;
}

// One UART character the way a decoder reads it: from the falling edge at
// `start`, sample in the middle of each bit at `baud`. Returns the 8 data bits
// and reports the parity bit (if any) and the first stop bit.
struct UartChar {
    int value;
    int parity;
    int stop;
};

UartChar uart_read(const wave::PinWave& w, double start, double baud, bool parity) {
    const double bit = kSys / baud;
    auto at = [&](double k) { return w.level_at(static_cast<uint32_t>(start + (k + 0.5) * bit)) ? 1 : 0; };
    int v = 0;
    for (int b = 0; b < 8; ++b) v |= at(1 + b) << b;
    return {v, parity ? at(9) : -1, at(parity ? 10 : 9)};
}

// Reads a whole message: each character starts at the next falling edge after
// the previous one's stop bit.
std::vector<UartChar> uart_message(const wave::PinWave& w, uint32_t from, uint32_t to, double baud, bool parity) {
    std::vector<UartChar> out;
    const double bit = kSys / baud;
    const double length = (parity ? 11 : 10) * bit;
    double next = from;
    for (uint32_t fall : edges(w, false, from, to)) {
        if (fall + 1 < next) continue;
        out.push_back(uart_read(w, fall, baud, parity));
        next = fall + length - bit / 2;  // A low stop bit runs into the next start bit; wait half a bit before.
    }
    return out;
}

std::string text(const std::vector<UartChar>& chars) {
    std::string s;
    for (const UartChar& c : chars) s += static_cast<char>(c.value);
    return s;
}

std::vector<int> bits_on_rising(const wave::PinWave& clock, const wave::PinWave& data, uint32_t from, uint32_t to) {
    std::vector<int> bits;
    for (uint32_t t : edges(clock, true, from, to)) bits.push_back(data.level_at(t) ? 1 : 0);
    return bits;
}

int byte_at(const std::vector<int>& bits, size_t from) {
    int v = 0;
    for (size_t i = 0; i < 8; ++i) v = (v << 1) | bits[from + i];
    return v;
}

}  // namespace

TEST(faults_frame_builds_and_encodes) {
    Built b;
    CHECK(b.error == nullptr);
    std::vector<uint32_t> words(16384);
    const timeline::Result r = timeline::encode(b.f.pins, faults_frame::kPinCount, b.f.frame_cycles, words.data(),
                                                words.size());
    CHECK(r.valid);
    CHECK_EQ(r.total_cycles, b.f.frame_cycles);
}

TEST(faults_uart_good_slow_and_framing) {
    Built b;
    const config::FaultsConfig& c = config::kFaults;
    const auto& tx = b.pin(faults_frame::kUartTx);

    const auto& good = b.window("uart", "good");
    CHECK_EQ(text(uart_message(tx, good.start, good.end, c.uart_baud, false)), std::string("Fault bench #1\r\n"));

    // The slow message decodes at its own rate, and its bit time is 3% long.
    const auto& slow = b.window("uart", "slow");
    const uint32_t slow_baud = faults_frame::slow_baud(c);
    CHECK_EQ(slow_baud, 111744u);
    CHECK_EQ(text(uart_message(tx, slow.start, slow.end, slow_baud, false)), std::string("Fault bench #2\r\n"));
    const double message_cycles = slow.end - slow.start;
    CHECK_NEAR(message_cycles / (16 * 10), kSys / slow_baud, 1.0);

    // Message 3: the stop bit of the number is low. Up to there every stop bit
    // is high; after it a decoder loses step, as a real one would.
    const auto& framing = b.window("uart", "framing");
    const auto chars = uart_message(tx, framing.start, framing.end, c.uart_baud, false);
    const size_t bad = std::strlen(c.uart_text);
    CHECK(chars.size() > bad);
    for (size_t i = 0; i <= bad && i < chars.size(); ++i) CHECK_EQ(chars[i].stop, i == bad ? 0 : 1);
    CHECK_EQ(chars[bad].value, '3');
}

TEST(faults_uart_parity_error_in_one_character) {
    Built b;
    const config::FaultsConfig& c = config::kFaults;
    const auto& w = b.pin(faults_frame::kUartParity);
    for (const char* label : {"good", "bad"}) {
        const auto& win = b.window("parity", label);
        const auto chars = uart_message(w, win.start, win.end, c.uart_baud, true);
        CHECK_EQ(text(chars), std::string(c.parity_text));
        for (size_t i = 0; i < chars.size(); ++i) {
            const int ones = __builtin_popcount(static_cast<unsigned>(chars[i].value));
            const bool even_ok = (ones + chars[i].parity) % 2 == 0;
            const bool expect_ok = std::strcmp(label, "good") == 0 || static_cast<long>(i) != c.parity_bad_index;
            CHECK_EQ(even_ok, expect_ok);
        }
    }
}

TEST(faults_i2c_stretch_and_data_nak) {
    Built b;
    const config::FaultsConfig& c = config::kFaults;
    const auto& scl = b.pin(faults_frame::kI2cScl);
    const auto& sda = b.pin(faults_frame::kI2cSda);

    // The read: 4 bytes + repeated start; the longest SCL low is the stretch.
    const auto& read = b.window("i2c", "stretch");
    const auto falls = edges(scl, false, read.start, read.end);
    const auto rises = edges(scl, true, read.start, read.end);
    double longest = 0;
    for (uint32_t f : falls) {
        for (uint32_t r : rises) {
            if (r > f) {
                if (r - f > longest) longest = r - f;
                break;
            }
        }
    }
    const double half = kSys / c.i2c_hz / 2;
    CHECK_NEAR(longest, half + c.i2c_stretch_us * kSys / 1e6, 2.0);
    const auto bits = bits_on_rising(scl, sda, read.start, read.end);
    // Write address, register, (repeated start clock), read address, MSB, LSB.
    CHECK_EQ(byte_at(bits, 0), 0x90);
    CHECK_EQ(byte_at(bits, 19), 0x91);
    CHECK_EQ(byte_at(bits, 28), c.i2c_value >> 8);

    // The write: address ACK, register ACK, data NAK.
    const auto& write = b.window("i2c", "data_nak");
    const auto wbits = bits_on_rising(scl, sda, write.start, write.end);
    CHECK_EQ(wbits.size(), 28u);  // 27 bits, then the STOP condition's SCL rise.
    CHECK_EQ(byte_at(wbits, 0), 0x90);
    CHECK_EQ(wbits[8], 0);
    CHECK_EQ(byte_at(wbits, 9), c.i2c_config_register);
    CHECK_EQ(wbits[17], 0);
    CHECK_EQ(byte_at(wbits, 18), c.i2c_config_value);
    CHECK_EQ(wbits[26], 1);  // NAK.
}

TEST(faults_spi_abort_and_wrong_mode) {
    Built b;
    const config::FaultsConfig& c = config::kFaults;
    const auto& sck = b.pin(faults_frame::kSpiSck);
    const auto& miso = b.pin(faults_frame::kSpiMiso);
    const auto& cs = b.pin(faults_frame::kSpiCs);

    // Two CS frames in the abort window: 12 clocks, then a full 32.
    const auto& abort = b.window("spi", "abort");
    const auto cs_falls = edges(cs, false, abort.start, abort.end);
    const auto cs_rises = edges(cs, true, abort.start, abort.end);
    CHECK_EQ(cs_falls.size(), 2u);
    CHECK_EQ(cs_rises.size(), 2u);
    CHECK_EQ(edges(sck, true, cs_falls[0], cs_rises[0]).size(), static_cast<size_t>(c.spi_abort_bits));
    const auto retry = bits_on_rising(sck, miso, cs_falls[1], cs_rises[1]);
    CHECK_EQ(retry.size(), 32u);
    CHECK_EQ(byte_at(retry, 8), c.spi_reply[0]);

    // The wrong-mode device: sampled in mode 0, every bit arrives one clock
    // late, so the answer reads shifted right by one, with the previous bit on top.
    const auto& mode1 = b.window("spi", "mode1");
    const auto shifted = bits_on_rising(sck, miso, mode1.start, mode1.end);
    CHECK_EQ(shifted.size(), 32u);
    const uint32_t sent = 0xFF000000u | c.spi_reply[0] << 16 | c.spi_reply[1] << 8 | c.spi_reply[2];
    const uint32_t expected = (sent >> 1) | 0x80000000u;  // MISO idles high before the first clock.
    uint32_t got = 0;
    for (int bit : shifted) got = got << 1 | static_cast<uint32_t>(bit);
    CHECK_EQ(got, expected);
}

TEST(faults_ws2812_one_short_bit) {
    Built b;
    const config::FaultsConfig& c = config::kFaults;
    const auto& w = b.pin(faults_frame::kWs2812);
    const auto& win = b.window("ws2812", "update");
    const auto rises = edges(w, true, win.start, win.end);
    const auto falls = edges(w, false, win.start, win.end);
    CHECK_EQ(rises.size(), c.ws2812_leds * 24u);
    const size_t bad = static_cast<size_t>(c.ws2812_bad_led) * 24 + (23 - c.ws2812_bad_bit);
    for (size_t i = 0; i < rises.size(); ++i) {
        const double high_ns = (falls[i] - rises[i]) * 1e9 / kSys;
        const int bit = 23 - static_cast<int>(i % 24);
        const bool one = (c.ws2812_level >> (bit % 8)) & 1;
        const double expected = i == bad ? c.ws2812_bad_high_ns : one ? 800.0 : 400.0;
        CHECK_NEAR(high_ns, expected, 7.0);
    }
}

TEST(faults_onewire_absent_and_bad_crc) {
    Built b;
    const config::FaultsConfig& c = config::kFaults;
    const auto& w = b.pin(faults_frame::kOneWire);
    const auto& absent = b.window("onewire", "absent");
    CHECK_EQ(edges(w, false, absent.start, absent.end).size(), 1u);  // Only the controller's reset pulse.

    uint8_t pad[9];
    faults_frame::onewire_scratchpad(c, pad);
    CHECK(proto::onewire_crc8(pad, 8) != pad[8]);
    pad[c.onewire_bad_byte] ^= c.onewire_bad_xor;
    CHECK_EQ(proto::onewire_crc8(pad, 8), pad[8]);
}

TEST(faults_irq_pulses_and_glitches_keep_their_width) {
    Built b;
    const config::FaultsConfig& c = config::kFaults;
    std::vector<uint32_t> words(16384);
    const timeline::Result r = timeline::encode(b.f.pins, faults_frame::kPinCount, b.f.frame_cycles, words.data(),
                                                words.size());
    CHECK(r.valid);
    // Replay the encoded words and measure every low pulse on the interrupt line.
    std::vector<double> lows_ns;
    uint64_t t = 0;
    bool was_high = true;
    uint64_t fell = 0;
    for (size_t i = 0; i < r.word_count; ++i) {
        const bool high = (timeline::word_levels(words[i]) >> faults_frame::kIrq) & 1u;
        if (was_high && !high) fell = t;
        if (!was_high && high) lows_ns.push_back((t - fell) * 1e9 / kSys);
        was_high = high;
        t += timeline::word_cycles(words[i]);
    }
    CHECK_EQ(lows_ns.size(), 5u);
    std::vector<double> expected = {static_cast<double>(c.irq_pulse_ns), static_cast<double>(c.glitch_ns[0]),
                                    static_cast<double>(c.glitch_ns[1]), static_cast<double>(c.irq_pulse_ns),
                                    static_cast<double>(c.glitch_ns[2])};
    for (size_t i = 0; i < lows_ns.size() && i < expected.size(); ++i) CHECK_NEAR(lows_ns[i], expected[i], 0.5);
}
