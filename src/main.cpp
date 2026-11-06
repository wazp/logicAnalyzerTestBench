// Logic Analyzer Test Bench for the Raspberry Pi Pico 2 W (RP2350).
//
// Sets up every test signal, starts them together, then starts Wi-Fi (the
// saved home network, or the setup hotspot) with the web guide. The main loop
// services Wi-Fi, the USB serial console and the BOOTSEL button. The CPU is
// not involved in generating any signal: PIO, PWM and DMA run on their own.

#include <cstdio>

#include "board_pins.h"
#include "console/serial_console.h"
#include "hardware/pio.h"
#include "hardware/pwm.h"
#include "hardware/sync.h"
#include "hw/bootsel_button.h"
#include "hw/pattern_output.h"
#include "hw/pwm_output.h"
#include "hw/square_output.h"
#include "hw/timeline_output.h"
#include "net/wifi.h"
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
bi_decl(bi_1pin_with_name(pins::kUartTx, "UART TX"));
bi_decl(bi_1pin_with_name(pins::kUartRx, "UART RX (simulated device)"));
bi_decl(bi_1pin_with_name(pins::kI2cScl, "I2C SCL"));
bi_decl(bi_1pin_with_name(pins::kI2cSda, "I2C SDA"));
bi_decl(bi_1pin_with_name(pins::kSpiSck, "SPI SCK"));
bi_decl(bi_1pin_with_name(pins::kSpiMosi, "SPI MOSI"));
bi_decl(bi_1pin_with_name(pins::kSpiMiso, "SPI MISO (simulated device)"));
bi_decl(bi_1pin_with_name(pins::kSpiCs, "SPI CS"));
bi_decl(bi_1pin_with_name(pins::kWs2812, "WS2812 data"));
bi_decl(bi_1pin_with_name(pins::kOneWire, "1-Wire"));
bi_decl(bi_1pin_with_name(pins::kIrRemote, "IR remote (NEC)"));
bi_decl(bi_1pin_with_name(pins::kQuadratureA, "Quadrature A"));
bi_decl(bi_1pin_with_name(pins::kQuadratureB, "Quadrature B"));
bi_decl(bi_1pin_with_name(pins::kBounce, "Bouncing button"));

// Starts every signal state machine in all three PIO blocks (PIO1 enables its
// neighbors PIO0 and PIO2 in the same write), then both PWM slices. Runs from
// RAM with interrupts off so the two writes are a few cycles apart: run from
// flash, an XIP cache miss between them put the two groups about 3 us apart
// (measured on a board: GP3 rose 3.0 us after GP8). PIO goes first because
// its CTRL value takes a dozen instructions to assemble; the PWM write is a
// single store after it.
static void __no_inline_not_in_flash_func(start_signals)(uint32_t pwm_slice_mask, const uint32_t (&sm_mask)[3]) {
    const uint32_t irq = save_and_disable_interrupts();
    pio_enable_sm_multi_mask_in_sync(pio1, sm_mask[0], sm_mask[1], sm_mask[2]);
    pwm_set_mask_enabled(pwm_slice_mask);
    restore_interrupts(irq);
}

int main() {
    stdio_init_all();

    // --- Configure everything while stopped ---
    uint32_t sm_mask[3] = {0, 0, 0};  // Enabled state machines per PIO block.
    for (const auto& sq : config::kSquareSignals) {
        square_output_init(sq);
        sm_mask[sq.pio_index] |= 1u << sq.sm;
    }

    pattern_output_init(pins::kPattern, config::kPatternName, config::kPatternPioIndex, config::kPatternSm,
                        config::kPatternSegments, config::kPatternSegmentCount);
    sm_mask[config::kPatternPioIndex] |= 1u << config::kPatternSm;
    pattern_output_init(pins::kBounce, config::kBounceName, config::kBouncePioIndex, config::kBounceSm,
                        config::kBounceSegments, config::kBounceSegmentCount);
    sm_mask[config::kBouncePioIndex] |= 1u << config::kBounceSm;

    // Protocol signals on GP10-GP22, one state machine for all of them.
    timeline_output_init(config::kTimelinePioIndex, config::kTimelineSm);
    sm_mask[config::kTimelinePioIndex] |= 1u << config::kTimelineSm;

    const unsigned pair_slice = pwm_output_init_pair(config::kPwmPair);
    const unsigned pulse_slice = pwm_output_init_pulse(config::kPulse);

    // --- Start ---
    // All square waves, both patterns and the protocol frame share t = 0; the
    // PWM outputs start a few cycles later (see start_signals).
    start_signals((1u << pair_slice) | (1u << pulse_slice), sm_mask);

    // Wi-Fi comes last, so a radio problem can never delay or disturb the
    // signals. It serves the web guide from flash; see src/net/wifi.h.
    wifi_start();

    // Holding BOOTSEL this long forgets the saved network and restarts into
    // the setup hotspot. The restart waits for the button to be released: the
    // boot ROM enters USB boot mode (the RP2350 drive) if BOOTSEL is still held
    // at reset. The LED going off tells the user it is time to let go.
    constexpr uint32_t kForgetHoldMs = 3000;
    absolute_time_t pressed_since = nil_time;
    bool warned = false;
    bool armed = false;

    while (true) {
        wifi_poll();
        console_poll();  // Waits up to 100 ms for a key, which paces this loop.

        if (bootsel_pressed()) {
            if (is_nil_time(pressed_since)) {
                pressed_since = get_absolute_time();
            }
            const int64_t held_ms = absolute_time_diff_us(pressed_since, get_absolute_time()) / 1000;
            if (held_ms >= 500 && !warned) {
                printf("BOOTSEL held: keep holding to forget the Wi-Fi network\n");
                warned = true;
            }
            if (held_ms >= kForgetHoldMs && !armed) {
                printf("Release BOOTSEL to forget the Wi-Fi network and restart\n");
                wifi_set_led(false);
                armed = true;
            }
        } else {
            if (armed) {
                wifi_forget_and_reboot();
            }
            pressed_since = nil_time;
            warned = false;
        }
    }
}
