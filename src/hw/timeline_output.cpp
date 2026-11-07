#include "hw/timeline_output.h"

#include <cstdio>

#include "core/faults_frame.h"
#include "core/protocol_frame.h"
#include "core/timeline.h"
#include "core/video_frame.h"
#include "hardware/clocks.h"
#include "hardware/pio.h"
#include "hw/dma_loop.h"
#include "signal_config.h"
#include "status.h"
#include "timeline.pio.h"

namespace {

// The protocol frame needs about 7,500 words and the video frame about 9,900;
// this leaves room for longer messages or more transactions in
// signal_config.h.
constexpr size_t kMaxWords = 14336;

uint32_t words[kMaxWords];
const uint32_t* words_start = words;

// Toggle times while building the frame. Only needed during init, but static
// because it is far too big for the stack. Only one preset is built per boot,
// so they all share it.
constexpr size_t max_size(size_t a, size_t b) { return a > b ? a : b; }
constexpr size_t kPoolSize = max_size(max_size(protocol_frame::kPoolSize, video_frame::kPoolSize), faults_frame::kPoolSize);
uint32_t pool[kPoolSize];
protocol_frame::Frame frame;
video_frame::Frame video;
faults_frame::Frame faults;

unsigned pio_index_used;
unsigned sm_used;

// Share of the frame a pin spends high, in percent.
double duty_percent(const wave::PinWave& w, uint32_t frame_cycles) {
    uint64_t high = 0;
    bool level = w.initial;
    uint32_t since = 0;
    for (size_t i = 0; i < w.count; ++i) {
        if (level) high += w.toggles[i] - since;
        level = !level;
        since = w.toggles[i];
    }
    if (level) high += frame_cycles - since;
    return 100.0 * static_cast<double>(high) / frame_cycles;
}

void add_row(unsigned pin, const wave::PinWave& w, uint32_t frame_cycles, const char* name, double rate_hz,
             const char* detail) {
    SignalStatus s = {};
    s.pin = pins::kTimelineBase + pin;
    s.name = name;
    snprintf(s.peripheral, sizeof(s.peripheral), "PIO%u SM%u+DMA", pio_index_used, sm_used);
    s.requested_hz = rate_hz;
    s.actual_hz = rate_hz;  // Edges are placed per bit from the frame start, so the average rate is exact.
    s.duty_percent = duty_percent(w, frame_cycles);
    snprintf(s.detail, sizeof(s.detail), "%s", detail);
    status_add(s);
}

void add_row(protocol_frame::Pin pin, const char* name, double rate_hz, const char* detail) {
    add_row(pin, frame.pins[pin], frame.frame_cycles, name, rate_hz, detail);
}

void add_row(video_frame::Pin pin, const char* name, double rate_hz, const char* detail) {
    add_row(pin, video.pins[pin], video.frame_cycles, name, rate_hz, detail);
}

void add_row(faults_frame::Pin pin, const char* name, double rate_hz, const char* detail) {
    add_row(pin, faults.pins[pin], faults.frame_cycles, name, rate_hz, detail);
}

// Builds the active preset's frame and encodes it into `words`.
timeline::Result build_and_encode(presets::Preset preset, uint32_t sys_hz) {
    if (preset == presets::Preset::kVideo) {
        if (const char* error = video_frame::build(video, config::kVideo, sys_hz, pool)) {
            panic("Video preset: %s", error);
        }
        return timeline::encode(video.pins, video_frame::kPinCount, video.frame_cycles, words, kMaxWords);
    }
    if (preset == presets::Preset::kFaults) {
        if (const char* error = faults_frame::build(faults, config::kFaults, sys_hz, pool)) {
            panic("Faults preset: %s", error);
        }
        return timeline::encode(faults.pins, faults_frame::kPinCount, faults.frame_cycles, words, kMaxWords);
    }
    if (const char* error = protocol_frame::build(frame, config::kProtocols, sys_hz, pool)) {
        panic("Protocol signals: %s", error);
    }
    return timeline::encode(frame.pins, protocol_frame::kPinCount, frame.frame_cycles, words, kMaxWords);
}

void add_protocol_rows() {
    const config::ProtocolConfig& c = config::kProtocols;
    char detail[48];
    snprintf(detail, sizeof(detail), "8N1, %u messages per %lu ms", c.uart_count,
             static_cast<unsigned long>(c.frame_us / 1000));
    add_row(protocol_frame::kUartTx, "UART TX", c.uart_baud, detail);
    add_row(protocol_frame::kUartRx, "UART RX (device reply)", c.uart_baud, "8N1, replies OK");
    snprintf(detail, sizeof(detail), "sensor at 0x%02X, NAK from 0x%02X", c.i2c_address, c.i2c_missing_address);
    add_row(protocol_frame::kI2cScl, "I2C SCL", c.i2c_hz, detail);
    add_row(protocol_frame::kI2cSda, "I2C SDA", c.i2c_hz, detail);
    snprintf(detail, sizeof(detail), "mode 0, command 0x%02X every %lu ms", c.spi_command,
             static_cast<unsigned long>(c.spi_period_us / 1000));
    add_row(protocol_frame::kSpiSck, "SPI SCK", c.spi_hz, detail);
    add_row(protocol_frame::kSpiMosi, "SPI MOSI", c.spi_hz, detail);
    add_row(protocol_frame::kSpiMiso, "SPI MISO (device reply)", c.spi_hz, "JEDEC ID EF 40 18");
    add_row(protocol_frame::kSpiCs, "SPI CS (active low)", 0.0, detail);
    snprintf(detail, sizeof(detail), "%u LEDs, update every %lu ms", c.ws2812_leds,
             static_cast<unsigned long>(c.ws2812_period_us / 1000));
    add_row(protocol_frame::kWs2812, "WS2812 data", 800000.0, detail);
    add_row(protocol_frame::kOneWire, "1-Wire (DS18B20)", 0.0, "standard speed, convert + read");
    snprintf(detail, sizeof(detail), "NEC addr 0x%02X cmd 0x%02X + repeat", c.ir_address, c.ir_command);
    add_row(protocol_frame::kIr, "IR remote (active low)", 0.0, detail);
    snprintf(detail, sizeof(detail), "%u steps fwd + back, %lu us/step", c.quadrature_steps,
             static_cast<unsigned long>(c.quadrature_step_us));
    add_row(protocol_frame::kQuadA, "Quadrature A", 0.0, detail);
    add_row(protocol_frame::kQuadB, "Quadrature B", 0.0, detail);
}

void add_video_rows(uint32_t sys_hz) {
    const config::VideoConfig& c = config::kVideo;
    const proto::VgaTiming vga = video_frame::vga_timing(c);
    const double line_hz = sys_hz / vga.line_cycles();
    const double frame_hz = sys_hz / vga.frame_cycles();
    char detail[48];
    snprintf(detail, sizeof(detail), "%ux%u, %.3f MHz pixels", c.h_visible, c.v_visible,
             sys_hz / 1e6 / c.pixel_cycles);
    add_row(video_frame::kHsync, "VGA HSYNC (active low)", line_hz, detail);
    snprintf(detail, sizeof(detail), "%u lines per frame", vga.frame_lines());
    add_row(video_frame::kVsync, "VGA VSYNC (active low)", frame_hz, detail);
    add_row(video_frame::kRed, "VGA red", 0.0, "8 color bars");
    add_row(video_frame::kGreen, "VGA green", 0.0, "8 color bars");
    add_row(video_frame::kBlue, "VGA blue", 0.0, "8 color bars");
    snprintf(detail, sizeof(detail), "read per frame: 0x%02X, 0x%02X", c.nes_buttons[0], c.nes_buttons[1]);
    add_row(video_frame::kNesLatch, "NES latch", frame_hz, detail);
    add_row(video_frame::kNesClock, "NES clock", frame_hz, detail);
    add_row(video_frame::kNesData, "NES data (controller)", frame_hz, detail);
    snprintf(detail, sizeof(detail), "key 0x%02X down, then F0 %02X up", c.ps2_key, c.ps2_key);
    add_row(video_frame::kPs2Clock, "PS/2 clock (keyboard)", c.ps2_clock_hz, detail);
    add_row(video_frame::kPs2Data, "PS/2 data (keyboard)", c.ps2_clock_hz, detail);
}

void add_faults_rows() {
    const config::FaultsConfig& c = config::kFaults;
    char detail[48];
    snprintf(detail, sizeof(detail), "8N1: good, %.0f%% slow, framing error", c.uart_slow_percent);
    add_row(faults_frame::kUartTx, "UART TX (faults)", c.uart_baud, detail);
    add_row(faults_frame::kUartParity, "UART 8E1 (faults)", c.uart_baud, "good, then a parity error");
    snprintf(detail, sizeof(detail), "0x%02X: clock stretch, data NAK", c.i2c_address);
    add_row(faults_frame::kI2cScl, "I2C SCL (faults)", c.i2c_hz, detail);
    add_row(faults_frame::kI2cSda, "I2C SDA (faults)", c.i2c_hz, detail);
    snprintf(detail, sizeof(detail), "CS abort after %u bits, retry", c.spi_abort_bits);
    add_row(faults_frame::kSpiSck, "SPI SCK (faults)", c.spi_hz, detail);
    add_row(faults_frame::kSpiMosi, "SPI MOSI (faults)", c.spi_hz, detail);
    add_row(faults_frame::kSpiMiso, "SPI MISO (faults)", c.spi_hz, "then a device in mode 1");
    add_row(faults_frame::kSpiCs, "SPI CS (faults)", 0.0, detail);
    snprintf(detail, sizeof(detail), "LED %ld has a %lu ns bit", c.ws2812_bad_led + 1,
             static_cast<unsigned long>(c.ws2812_bad_high_ns));
    add_row(faults_frame::kWs2812, "WS2812 data (faults)", 800000.0, detail);
    add_row(faults_frame::kOneWire, "1-Wire (faults)", 0.0, "no presence, then a bad CRC");
    add_row(faults_frame::kIrq, "Interrupt (active low)", 0.0, "2 pulses, 3 glitches");
}

}  // namespace

void timeline_output_init(unsigned pio_index, unsigned sm, presets::Preset preset) {
    pio_index_used = pio_index;
    sm_used = sm;
    const uint32_t sys_hz = clock_get_hz(clk_sys);
    const timeline::Result r = build_and_encode(preset, sys_hz);
    if (!r.valid) {
        panic("%s preset: %s", presets::title(preset), r.error);
    }

    // --- PIO state machine ---
    PIO pio = PIO_INSTANCE(pio_index);
    pio_sm_claim(pio, sm);
    const uint offset = pio_add_program(pio, &timeline_program);
    for (unsigned p = 0; p < pins::kTimelinePinCount; ++p) {
        pio_gpio_init(pio, pins::kTimelineBase + p);
    }
    pio_sm_set_consecutive_pindirs(pio, sm, pins::kTimelineBase, pins::kTimelinePinCount, true);

    pio_sm_config cfg = timeline_program_get_default_config(offset);
    sm_config_set_out_pins(&cfg, pins::kTimelineBase, pins::kTimelinePinCount);
    sm_config_set_out_shift(&cfg, true, true, 32);  // Shift right, autopull every 32 bits.
    sm_config_set_fifo_join(&cfg, PIO_FIFO_JOIN_TX);  // 8-deep TX FIFO for extra slack.
    sm_config_set_clkdiv_int_frac8(&cfg, 1, 0);
    pio_sm_init(pio, sm, offset, &cfg);
    // Idle levels until the state machine starts (UART, I²C, CS... high).
    pio_sm_set_pins_with_mask(pio, sm, timeline::word_levels(words[0]) << pins::kTimelineBase,
                              ((1u << pins::kTimelinePinCount) - 1) << pins::kTimelineBase);

    dma_loop_start(pio, sm, words, r.word_count, &words_start);

    // --- Status rows, one per pin ---
    if (preset == presets::Preset::kVideo) {
        add_video_rows(sys_hz);
    } else if (preset == presets::Preset::kFaults) {
        add_faults_rows();
    } else {
        add_protocol_rows();
    }
}
