// Writes the protocol signals as JSON for the web guide
// (web/src/data/protocols.json): pins, timing facts, the decoded content a
// learner should find, and one example of each transaction as edge lists.
//
// It builds the same frame as the firmware (src/core/protocol_frame.cpp), so
// the waveforms in the lessons are exactly what the board outputs. Built and
// run by the host test project (tests/CMakeLists.txt); a ctest check fails if
// the committed JSON is out of date.
//
//   usage: export_protocols <output.json>

#include <cstdio>
#include <cstring>
#include <string>
#include <vector>

#include "core/protocol_frame.h"
#include "signal_config.h"

namespace {

constexpr uint32_t kSysHz = 150000000;

double ns(double cycles) { return cycles * 1e9 / kSysHz; }

struct PinInfo {
    protocol_frame::Pin pin;
    const char* protocol;
    const char* role;
    const char* name;
};

constexpr PinInfo kPins[] = {
    {protocol_frame::kUartTx, "uart", "tx", "UART TX"},
    {protocol_frame::kUartRx, "uart", "rx", "UART RX (device reply)"},
    {protocol_frame::kI2cScl, "i2c", "scl", "I²C SCL"},
    {protocol_frame::kI2cSda, "i2c", "sda", "I²C SDA"},
    {protocol_frame::kSpiSck, "spi", "sck", "SPI SCK"},
    {protocol_frame::kSpiMosi, "spi", "mosi", "SPI MOSI"},
    {protocol_frame::kSpiMiso, "spi", "miso", "SPI MISO (device reply)"},
    {protocol_frame::kSpiCs, "spi", "cs", "SPI CS"},
    {protocol_frame::kWs2812, "ws2812", "data", "WS2812 data"},
    {protocol_frame::kOneWire, "onewire", "dq", "1-Wire"},
    {protocol_frame::kIr, "ir", "out", "IR receiver output"},
    {protocol_frame::kQuadA, "quadrature", "a", "Quadrature A"},
    {protocol_frame::kQuadB, "quadrature", "b", "Quadrature B"},
};

std::string hex(const uint8_t* data, size_t len) {
    std::string out = "[";
    for (size_t i = 0; i < len; ++i) {
        char b[8];
        std::snprintf(b, sizeof(b), "%s%u", i ? ", " : "", data[i]);
        out += b;
    }
    return out + "]";
}

// JSON string with the characters our messages use escaped.
std::string quoted(const char* s) {
    std::string out = "\"";
    for (const char* p = s; *p; ++p) {
        if (*p == '\r') out += "\\r";
        else if (*p == '\n') out += "\\n";
        else if (*p == '"' || *p == '\\') (out += '\\') += *p;
        else out += *p;
    }
    return out + "\"";
}

// One example window: every pin of the protocol, as its level at the window
// start plus toggle times in ns relative to the window start.
void write_example(FILE* f, const protocol_frame::Frame& frame, const char* protocol, const char* label,
                   const char* title, double start, double end, bool last) {
    std::fprintf(f, "        {\"label\": \"%s\", \"title\": %s, \"durationNs\": %.9g, \"traces\": [", label,
                 quoted(title).c_str(), ns(end - start));
    bool first = true;
    for (const auto& p : kPins) {
        if (std::strcmp(p.protocol, protocol) != 0) continue;
        const wave::PinWave& w = frame.pins[p.pin];
        const uint32_t s = static_cast<uint32_t>(start);
        std::fprintf(f, "%s\n          {\"gpio\": %u, \"role\": \"%s\", \"initial\": %d, \"togglesNs\": [",
                     first ? "" : ",", pins::kTimelineBase + p.pin, p.role, w.level_at(s) ? 1 : 0);
        bool first_t = true;
        for (size_t i = 0; i < w.count; ++i) {
            const uint32_t t = w.toggles[i];
            if (t <= s || t >= end) continue;
            std::fprintf(f, "%s%.9g", first_t ? "" : ", ", ns(t - start));
            first_t = false;
        }
        std::fprintf(f, "]}");
        first = false;
    }
    std::fprintf(f, "\n        ]}%s\n", last ? "" : ",");
}

const protocol_frame::Window* find(const protocol_frame::Frame& frame, const char* protocol, const char* label) {
    for (size_t i = 0; i < frame.window_count; ++i) {
        if (!std::strcmp(frame.windows[i].protocol, protocol) && !std::strcmp(frame.windows[i].label, label)) {
            return &frame.windows[i];
        }
    }
    return nullptr;
}

// Start times of every window of a protocol and label, in ms, for the lessons.
std::string starts_ms(const protocol_frame::Frame& frame, const char* protocol, const char* label) {
    std::string out = "[";
    bool first = true;
    for (size_t i = 0; i < frame.window_count; ++i) {
        if (std::strcmp(frame.windows[i].protocol, protocol) || std::strcmp(frame.windows[i].label, label)) continue;
        char b[24];
        std::snprintf(b, sizeof(b), "%s%.9g", first ? "" : ", ", ns(frame.windows[i].start) / 1e6);
        out += b;
        first = false;
    }
    return out + "]";
}

}  // namespace

int main(int argc, char** argv) {
    if (argc != 2) {
        std::fprintf(stderr, "usage: %s <output.json>\n", argv[0]);
        return 2;
    }
    const config::ProtocolConfig& c = config::kProtocols;
    static std::vector<uint32_t> pool(protocol_frame::kPoolSize);
    static protocol_frame::Frame frame;
    if (const char* error = protocol_frame::build(frame, c, kSysHz, pool.data())) {
        std::fprintf(stderr, "protocol frame: %s\n", error);
        return 1;
    }
    FILE* f = std::fopen(argv[1], "w");
    if (f == nullptr) {
        std::perror(argv[1]);
        return 1;
    }
    const double us = kSysHz / 1e6;

    std::fprintf(f, "{\n");
    std::fprintf(f, "  \"_comment\": \"Generated by tools/export_protocols.cpp from src/signal_config.h. Do not edit.\",\n");
    std::fprintf(f, "  \"frameMs\": %.9g,\n", c.frame_us / 1000.0);
    std::fprintf(f, "  \"pins\": [\n");
    for (size_t i = 0; i < sizeof(kPins) / sizeof(kPins[0]); ++i) {
        const auto& p = kPins[i];
        std::fprintf(f, "    {\"gpio\": %u, \"protocol\": \"%s\", \"role\": \"%s\", \"name\": \"%s\", \"idleHigh\": %s}%s\n",
                     pins::kTimelineBase + p.pin, p.protocol, p.role, p.name,
                     frame.pins[p.pin].initial ? "true" : "false", i + 1 < sizeof(kPins) / sizeof(kPins[0]) ? "," : "");
    }
    std::fprintf(f, "  ],\n");

    // --- UART ---
    char msg[48];
    protocol_frame::uart_message(c, 1, msg, sizeof(msg));
    {
        const auto* m = find(frame, "uart", "message");
        const auto* r = find(frame, "uart", "reply");
        std::fprintf(f, "  \"uart\": {\n");
        std::fprintf(f, "    \"baud\": %u, \"format\": \"8N1\", \"bitNs\": %.9g,\n", c.uart_baud, 1e9 / c.uart_baud);
        std::fprintf(f, "    \"firstMessage\": %s, \"messageText\": %s, \"messageCount\": %u, \"reply\": %s,\n",
                     quoted(msg).c_str(), quoted(c.uart_text).c_str(), c.uart_count, quoted(c.uart_reply).c_str());
        std::fprintf(f, "    \"messageStartsMs\": %s, \"replyDelayMs\": %.9g,\n",
                     starts_ms(frame, "uart", "message").c_str(), c.uart_reply_delay_us / 1000.0);
        std::fprintf(f, "    \"examples\": [\n");
        write_example(f, frame, "uart", "first_character", "The first character", m->start - 20 * us,
                      m->start + 10.5 * kSysHz / c.uart_baud, false);
        write_example(f, frame, "uart", "message_and_reply", "Message and reply", m->start - 50 * us, r->end + 50 * us,
                      true);
        std::fprintf(f, "    ]\n  },\n");
    }

    // --- I²C ---
    {
        const auto* rd = find(frame, "i2c", "read");
        const auto* nak = find(frame, "i2c", "nak");
        const uint8_t value[2] = {static_cast<uint8_t>(c.i2c_value >> 8), static_cast<uint8_t>(c.i2c_value & 0xFF)};
        const double celsius = static_cast<int16_t>(c.i2c_value) / 16 * 0.0625;
        std::fprintf(f, "  \"i2c\": {\n");
        std::fprintf(f, "    \"clockHz\": %u, \"address\": %u, \"missingAddress\": %u, \"register\": %u,\n", c.i2c_hz,
                     c.i2c_address, c.i2c_missing_address, c.i2c_register);
        std::fprintf(f, "    \"value\": %s, \"temperatureC\": %.9g,\n", hex(value, 2).c_str(), celsius);
        std::fprintf(f, "    \"readStartsMs\": %s, \"nakStartsMs\": %s,\n", starts_ms(frame, "i2c", "read").c_str(),
                     starts_ms(frame, "i2c", "nak").c_str());
        std::fprintf(f, "    \"examples\": [\n");
        write_example(f, frame, "i2c", "read", "Reading the temperature", rd->start - 20 * us, rd->end + 20 * us, false);
        write_example(f, frame, "i2c", "nak", "Nobody at 0x49", nak->start - 20 * us, nak->end + 20 * us, true);
        std::fprintf(f, "    ]\n  },\n");
    }

    // --- SPI ---
    {
        const auto* w = find(frame, "spi", "jedec_id");
        std::fprintf(f, "  \"spi\": {\n");
        std::fprintf(f, "    \"clockHz\": %u, \"mode\": 0, \"command\": %u, \"reply\": %s,\n", c.spi_hz, c.spi_command,
                     hex(c.spi_reply, 3).c_str());
        std::fprintf(f, "    \"startsMs\": %s,\n", starts_ms(frame, "spi", "jedec_id").c_str());
        std::fprintf(f, "    \"examples\": [\n");
        write_example(f, frame, "spi", "jedec_id", "Reading the JEDEC ID", w->start - 2 * us, w->end + 2 * us, true);
        std::fprintf(f, "    ]\n  },\n");
    }

    // --- WS2812 ---
    {
        const auto* w = find(frame, "ws2812", "update");
        proto::Rgb leds[protocol_frame::kMaxWs2812Leds];
        protocol_frame::ws2812_colors(c, 0, leds);
        const proto::Ws2812Timing t;
        std::fprintf(f, "  \"ws2812\": {\n");
        std::fprintf(f, "    \"leds\": %u, \"bitNs\": %.9g, \"t0hNs\": %.9g, \"t1hNs\": %.9g,\n", c.ws2812_leds,
                     t.bit_ns, t.t0h_ns, t.t1h_ns);
        std::fprintf(f, "    \"startsMs\": %s,\n", starts_ms(frame, "ws2812", "update").c_str());
        std::fprintf(f, "    \"firstColors\": [");
        for (unsigned i = 0; i < c.ws2812_leds; ++i) {
            std::fprintf(f, "%s{\"r\": %u, \"g\": %u, \"b\": %u}", i ? ", " : "", leds[i].r, leds[i].g, leds[i].b);
        }
        std::fprintf(f, "],\n    \"examples\": [\n");
        write_example(f, frame, "ws2812", "first_led", "The first LED", w->start - 2 * us,
                      w->start + 24 * t.bit_ns * kSysHz / 1e9 + 0.3 * us, false);
        write_example(f, frame, "ws2812", "update", "One update, all LEDs", w->start - 5 * us, w->end + 50 * us, true);
        std::fprintf(f, "    ]\n  },\n");
    }

    // --- 1-Wire ---
    {
        const auto* conv = find(frame, "onewire", "convert");
        const auto* rd = find(frame, "onewire", "read");
        uint8_t pad[9];
        protocol_frame::onewire_scratchpad(c, pad);
        std::fprintf(f, "  \"onewire\": {\n");
        std::fprintf(f, "    \"scratchpad\": %s, \"temperatureC\": %.9g, \"convertAtMs\": %.9g, \"readAtMs\": %.9g,\n",
                     hex(pad, 9).c_str(), static_cast<int16_t>(c.onewire_raw_temp) * 0.0625,
                     c.onewire_convert_us / 1000.0, c.onewire_read_us / 1000.0);
        std::fprintf(f, "    \"examples\": [\n");
        write_example(f, frame, "onewire", "reset", "Reset and presence pulse", conv->start - 20 * us,
                      conv->start + 1000 * us, false);
        write_example(f, frame, "onewire", "convert", "Skip ROM, Convert T", conv->start - 20 * us, conv->end + 20 * us,
                      false);
        write_example(f, frame, "onewire", "read", "Read Scratchpad", rd->start - 20 * us, rd->end + 20 * us, true);
        std::fprintf(f, "    ]\n  },\n");
    }

    // --- IR remote ---
    {
        const auto* fr = find(frame, "ir", "frame");
        const auto* rep = find(frame, "ir", "repeat");
        std::fprintf(f, "  \"ir\": {\n");
        std::fprintf(f, "    \"address\": %u, \"command\": %u, \"frameStartMs\": %.9g, \"repeatStartMs\": %.9g,\n",
                     c.ir_address, c.ir_command, ns(fr->start) / 1e6, ns(rep->start) / 1e6);
        std::fprintf(f, "    \"examples\": [\n");
        write_example(f, frame, "ir", "frame", "Key press", fr->start - 50 * us, fr->end + 500 * us, false);
        write_example(f, frame, "ir", "repeat", "Repeat code", rep->start - 500 * us, rep->end + 100 * us, true);
        std::fprintf(f, "    ]\n  },\n");
    }

    // --- Quadrature: around the moment it changes direction ---
    {
        const auto* fwd = find(frame, "quadrature", "forward");
        const auto* back = find(frame, "quadrature", "backward");
        const double step = c.quadrature_step_us * us;
        std::fprintf(f, "  \"quadrature\": {\n");
        std::fprintf(f, "    \"steps\": %u, \"stepUs\": %u, \"forwardStartMs\": %.9g, \"backwardStartMs\": %.9g,\n",
                     c.quadrature_steps, c.quadrature_step_us, ns(fwd->start) / 1e6, ns(back->start) / 1e6);
        std::fprintf(f, "    \"examples\": [\n");
        write_example(f, frame, "quadrature", "turnaround", "Changing direction", back->start - 8.5 * step,
                      back->start + 7.5 * step, true);
        std::fprintf(f, "    ]\n  }\n");
    }

    std::fprintf(f, "}\n");
    std::fclose(f);
    return 0;
}
