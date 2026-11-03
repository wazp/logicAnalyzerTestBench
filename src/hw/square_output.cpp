#include "square_output.h"

#include <cstdio>

#include "hardware/clocks.h"
#include "square_wave.pio.h"
#include "status.h"

namespace {

// The program is loaded once per PIO block and shared by all its state
// machines, since only the register values differ between outputs.
bool program_loaded[NUM_PIOS] = {};
uint program_offset[NUM_PIOS] = {};

uint get_program_offset(PIO pio) {
    const uint index = PIO_NUM(pio);
    if (!program_loaded[index]) {
        program_offset[index] = pio_add_program(pio, &square_wave_program);
        program_loaded[index] = true;
    }
    return program_offset[index];
}

// Moves a value from the CPU into a state machine register while it is
// stopped: push it to the TX FIFO, execute `pull`, then `mov dest, osr`.
void load_register(PIO pio, uint sm, enum pio_src_dest dest, uint32_t value) {
    pio_sm_put_blocking(pio, sm, value);
    pio_sm_exec(pio, sm, pio_encode_pull(false, true));
    pio_sm_exec(pio, sm, pio_encode_mov(dest, pio_osr));
}

}  // namespace

void square_output_init(const config::SquareSignalConfig& cfg) {
    const uint32_t sys_hz = clock_get_hz(clk_sys);
    const timing::SquareTiming t = timing::compute_square_timing(sys_hz, cfg.freq_hz, cfg.duty_percent);
    if (!t.valid) {
        panic("GP%u (%s): %s", cfg.pin, cfg.name, t.error);
    }

    PIO pio = PIO_INSTANCE(cfg.pio_index);
    pio_sm_claim(pio, cfg.sm);  // Panics if something else already owns it.
    const uint offset = get_program_offset(pio);

    pio_gpio_init(pio, cfg.pin);
    pio_sm_set_consecutive_pindirs(pio, cfg.sm, cfg.pin, 1, true);

    pio_sm_config c = square_wave_program_get_default_config(offset);
    sm_config_set_sideset_pins(&c, cfg.pin);
    sm_config_set_clkdiv_int_frac8(&c, 1, 0);  // Run at full clk_sys for exact timing.

    // pio_sm_init resets the state machine (clearing ISR), so load the
    // counts afterwards.
    pio_sm_init(pio, cfg.sm, offset, &c);
    pio_sm_set_pins_with_mask(pio, cfg.sm, 0, 1u << cfg.pin);  // Idle low until started.
    load_register(pio, cfg.sm, pio_y, t.high_count);
    load_register(pio, cfg.sm, pio_isr, t.low_count);

    SignalStatus s = {};
    s.pin = cfg.pin;
    s.name = cfg.name;
    snprintf(s.peripheral, sizeof(s.peripheral), "PIO%u SM%u", cfg.pio_index, cfg.sm);
    s.requested_hz = cfg.freq_hz;
    s.actual_hz = t.actual_hz;
    s.duty_percent = t.actual_duty_percent;
    snprintf(s.detail, sizeof(s.detail), "%llu/%llu cycles hi/lo", static_cast<unsigned long long>(t.high_cycles),
             static_cast<unsigned long long>(t.low_cycles));
    status_add(s);
}
