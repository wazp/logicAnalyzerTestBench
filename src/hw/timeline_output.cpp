#include "hw/timeline_output.h"

#include <cstdio>

#include "core/protocol_frame.h"
#include "core/timeline.h"
#include "hardware/clocks.h"
#include "hardware/pio.h"
#include "hw/dma_loop.h"
#include "signal_config.h"
#include "status.h"
#include "timeline.pio.h"

namespace {

// The default frame needs about 7,500 words; this leaves room for longer
// messages or more transactions in signal_config.h.
constexpr size_t kMaxWords = 14336;

uint32_t words[kMaxWords];
const uint32_t* words_start = words;

// Toggle times while building the frame. Only needed during init, but static
// because it is far too big for the stack.
uint32_t pool[protocol_frame::kPoolSize];
protocol_frame::Frame frame;

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

void add_row(unsigned pio_index, unsigned sm, protocol_frame::Pin pin, const char* name, double rate_hz,
             const char* detail) {
    SignalStatus s = {};
    s.pin = pins::kTimelineBase + pin;
    s.name = name;
    snprintf(s.peripheral, sizeof(s.peripheral), "PIO%u SM%u+DMA", pio_index, sm);
    s.requested_hz = rate_hz;
    s.actual_hz = rate_hz;  // Edges are placed per bit from the frame start, so the average rate is exact.
    s.duty_percent = duty_percent(frame.pins[pin], frame.frame_cycles);
    snprintf(s.detail, sizeof(s.detail), "%s", detail);
    status_add(s);
}

}  // namespace

void timeline_output_init(unsigned pio_index, unsigned sm) {
    const uint32_t sys_hz = clock_get_hz(clk_sys);
    const config::ProtocolConfig& c = config::kProtocols;
    if (const char* error = protocol_frame::build(frame, c, sys_hz, pool)) {
        panic("Protocol signals: %s", error);
    }
    const timeline::Result r =
        timeline::encode(frame.pins, protocol_frame::kPinCount, frame.frame_cycles, words, kMaxWords);
    if (!r.valid) {
        panic("Protocol signals: %s", r.error);
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
    char detail[48];
    snprintf(detail, sizeof(detail), "8N1, %u messages per %lu ms", c.uart_count,
             static_cast<unsigned long>(c.frame_us / 1000));
    add_row(pio_index, sm, protocol_frame::kUartTx, "UART TX", c.uart_baud, detail);
    add_row(pio_index, sm, protocol_frame::kUartRx, "UART RX (device reply)", c.uart_baud, "8N1, replies OK");
    snprintf(detail, sizeof(detail), "sensor at 0x%02X, NAK from 0x%02X", c.i2c_address, c.i2c_missing_address);
    add_row(pio_index, sm, protocol_frame::kI2cScl, "I2C SCL", c.i2c_hz, detail);
    add_row(pio_index, sm, protocol_frame::kI2cSda, "I2C SDA", c.i2c_hz, detail);
    snprintf(detail, sizeof(detail), "mode 0, command 0x%02X every %lu ms", c.spi_command,
             static_cast<unsigned long>(c.spi_period_us / 1000));
    add_row(pio_index, sm, protocol_frame::kSpiSck, "SPI SCK", c.spi_hz, detail);
    add_row(pio_index, sm, protocol_frame::kSpiMosi, "SPI MOSI", c.spi_hz, detail);
    add_row(pio_index, sm, protocol_frame::kSpiMiso, "SPI MISO (device reply)", c.spi_hz, "JEDEC ID EF 40 18");
    add_row(pio_index, sm, protocol_frame::kSpiCs, "SPI CS (active low)", 0.0, detail);
    snprintf(detail, sizeof(detail), "%u LEDs, update every %lu ms", c.ws2812_leds,
             static_cast<unsigned long>(c.ws2812_period_us / 1000));
    add_row(pio_index, sm, protocol_frame::kWs2812, "WS2812 data", 800000.0, detail);
    add_row(pio_index, sm, protocol_frame::kOneWire, "1-Wire (DS18B20)", 0.0, "standard speed, convert + read");
    snprintf(detail, sizeof(detail), "NEC addr 0x%02X cmd 0x%02X + repeat", c.ir_address, c.ir_command);
    add_row(pio_index, sm, protocol_frame::kIr, "IR remote (active low)", 0.0, detail);
    snprintf(detail, sizeof(detail), "%u steps fwd + back, %lu us/step", c.quadrature_steps,
             static_cast<unsigned long>(c.quadrature_step_us));
    add_row(pio_index, sm, protocol_frame::kQuadA, "Quadrature A", 0.0, detail);
    add_row(pio_index, sm, protocol_frame::kQuadB, "Quadrature B", 0.0, detail);

}
