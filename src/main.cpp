// Logic Analyzer Test Bench for the Raspberry Pi Pico 2 W (RP2350).
//
// Sets up every test signal, starts them together, starts the Wi-Fi access
// point with the web guide, then services the USB serial console. After
// startup the CPU is not involved in generating any signal: PIO, PWM and DMA
// run on their own.

#include "board_pins.h"
#include "console/serial_console.h"
#include "hardware/pio.h"
#include "hardware/pwm.h"
#include "hw/pattern_output.h"
#include "hw/pwm_output.h"
#include "hw/square_output.h"
#include "net/wifi_ap.h"
#include "pico/binary_info.h"
#include "pico/stdlib.h"
#include "signal_config.h"

// Pin labels for `picotool info -a`.
bi_decl(bi_1pin_with_name(pins::kSquare1Hz, "1 Hz square"));
bi_decl(bi_1pin_with_name(pins::kSquare10Hz, "10 Hz square"));
bi_decl(bi_1pin_with_name(pins::kSquare100Hz, "100 Hz square"));
bi_decl(bi_1pin_with_name(pins::kSquare1kHz, "1 kHz square"));
bi_decl(bi_1pin_with_name(pins::kSquare10kHz, "10 kHz square"));
bi_decl(bi_1pin_with_name(pins::kSquare100kHz, "100 kHz square"));
bi_decl(bi_1pin_with_name(pins::kPwm25, "PWM 25% duty"));
bi_decl(bi_1pin_with_name(pins::kPwm75, "PWM 75% duty"));
bi_decl(bi_1pin_with_name(pins::kPulse, "Short periodic pulse"));
bi_decl(bi_1pin_with_name(pins::kPattern, "Irregular pattern"));

int main() {
    stdio_init_all();

    // --- Configure everything while stopped ---
    uint32_t sm_mask[2] = {0, 0};  // Enabled state machines per PIO block.
    for (const auto& sq : config::kSquareSignals) {
        square_output_init(sq);
        sm_mask[sq.pio_index] |= 1u << sq.sm;
    }

    pattern_output_init(pins::kPattern, config::kPatternName, config::kPatternPioIndex, config::kPatternSm,
                        config::kPatternSegments, config::kPatternSegmentCount);
    sm_mask[config::kPatternPioIndex] |= 1u << config::kPatternSm;

    const unsigned pair_slice = pwm_output_init_pair(config::kPwmPair);
    const unsigned pulse_slice = pwm_output_init_pulse(config::kPulse);

    // --- Start ---
    // Both PWM slices start on the same cycle. The PIO state machines in PIO0
    // and PIO1 then start together on one later cycle, so all square waves and
    // the pattern share rising edges at t = 0. PWM and PIO are not cycle
    // aligned with each other (a few cycles apart).
    pwm_set_mask_enabled((1u << pair_slice) | (1u << pulse_slice));
    pio_enable_sm_multi_mask_in_sync(pio0, 0, sm_mask[0], sm_mask[1]);

    // Wi-Fi comes last, so a radio problem can never delay or disturb the
    // signals. It serves the web guide from flash; see src/net/wifi_ap.h.
    wifi_ap_start();

    while (true) {
        console_poll();
    }
}
