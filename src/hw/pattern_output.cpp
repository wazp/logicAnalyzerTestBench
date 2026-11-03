#include "pattern_output.h"

#include <cstdio>

#include "hardware/clocks.h"
#include "hardware/dma.h"
#include "hardware/pio.h"
#include "pattern.pio.h"
#include "status.h"

namespace {

constexpr size_t kMaxSegments = 64;

// Encoded pattern words. The data DMA channel streams these into the PIO.
uint32_t pattern_words[kMaxSegments];

// The control DMA channel copies this pointer into the data channel's read
// address (and triggers it) each time the data channel finishes a pass.
const uint32_t* pattern_start = pattern_words;

}  // namespace

void pattern_output_init(unsigned pin, const char* name, unsigned pio_index, unsigned sm,
                         const timing::PatternSegment* segments, size_t segment_count) {
    const uint32_t sys_hz = clock_get_hz(clk_sys);
    const timing::PatternEncoding e =
        timing::encode_pattern(sys_hz, segments, segment_count, pattern_words, kMaxSegments);
    if (!e.valid) {
        panic("GP%u (%s): %s", pin, name, e.error);
    }

    // --- PIO state machine ---
    PIO pio = PIO_INSTANCE(pio_index);
    pio_sm_claim(pio, sm);
    const uint offset = pio_add_program(pio, &pattern_program);

    pio_gpio_init(pio, pin);
    pio_sm_set_consecutive_pindirs(pio, sm, pin, 1, true);

    pio_sm_config c = pattern_program_get_default_config(offset);
    sm_config_set_out_pins(&c, pin, 1);
    sm_config_set_out_shift(&c, true, true, 32);  // Shift right, autopull every 32 bits.
    sm_config_set_fifo_join(&c, PIO_FIFO_JOIN_TX);  // 8-deep TX FIFO for extra slack.
    sm_config_set_clkdiv_int_frac8(&c, 1, 0);
    pio_sm_init(pio, sm, offset, &c);
    pio_sm_set_pins_with_mask(pio, sm, 0, 1u << pin);

    // --- DMA: data channel streams the words, control channel rewinds it ---
    const uint data_ch = static_cast<uint>(dma_claim_unused_channel(true));
    const uint ctrl_ch = static_cast<uint>(dma_claim_unused_channel(true));

    dma_channel_config dc = dma_channel_get_default_config(data_ch);
    channel_config_set_transfer_data_size(&dc, DMA_SIZE_32);
    channel_config_set_read_increment(&dc, true);
    channel_config_set_write_increment(&dc, false);
    channel_config_set_dreq(&dc, pio_get_dreq(pio, sm, true));  // Pace by FIFO space.
    channel_config_set_chain_to(&dc, ctrl_ch);
    dma_channel_configure(data_ch, &dc, &pio->txf[sm], pattern_words, e.word_count, false);

    dma_channel_config cc = dma_channel_get_default_config(ctrl_ch);
    channel_config_set_transfer_data_size(&cc, DMA_SIZE_32);
    channel_config_set_read_increment(&cc, false);
    channel_config_set_write_increment(&cc, false);
    // Writing READ_ADDR_TRIG restarts the data channel from the top.
    dma_channel_configure(ctrl_ch, &cc, &dma_hw->ch[data_ch].al3_read_addr_trig, &pattern_start, 1, false);

    // Start streaming now: DMA fills the FIFO and then waits, because the
    // state machine is not consuming yet.
    dma_channel_start(data_ch);

    SignalStatus s = {};
    s.pin = pin;
    s.name = name;
    snprintf(s.peripheral, sizeof(s.peripheral), "PIO%u SM%u+DMA", pio_index, sm);
    s.requested_hz = 0.0;  // Not a single frequency; the period is shown instead.
    s.actual_hz = static_cast<double>(sys_hz) / static_cast<double>(e.total_cycles);
    uint64_t high_cycles = 0;
    for (size_t i = 0; i < e.word_count; ++i) {
        if (pattern_words[i] & 1u) {
            high_cycles += (pattern_words[i] >> 1) + timing::kPatternSegmentOverheadCycles;
        }
    }
    s.duty_percent = 100.0 * static_cast<double>(high_cycles) / static_cast<double>(e.total_cycles);
    snprintf(s.detail, sizeof(s.detail), "%u segments, %.3f us period", static_cast<unsigned>(e.word_count),
             e.period_us);
    status_add(s);
}
