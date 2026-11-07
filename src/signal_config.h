// Default signal settings. Edit this file to change frequencies, duty cycles
// or the irregular pattern. Every value is validated at startup and the
// actual (rounded) result is printed on the USB serial console.
//
// Kept free of Pico SDK includes so host tests can check the defaults.

#pragma once

#include <cstddef>
#include <cstdint>

#include "board_pins.h"
#include "core/timing.h"

namespace config {

// One PIO state machine per square wave, so every pin gets an independent
// frequency. PIO0 and PIO1 hold the signals; PIO2 holds only the bounce
// signal, and the CYW43 Wi-Fi driver takes its next free state machine.
struct SquareSignalConfig {
    unsigned pin;
    const char* name;
    unsigned pio_index;  // 0 = pio0, 1 = pio1
    unsigned sm;         // State machine 0-3 inside that PIO block
    double freq_hz;
    double duty_percent;
};

inline constexpr SquareSignalConfig kSquareSignals[] = {
    {pins::kSquare1Hz, "1 Hz square", 0, 0, 1.0, 50.0},
    {pins::kSquare10Hz, "10 Hz square", 0, 1, 10.0, 50.0},
    {pins::kSquare100Hz, "100 Hz square", 0, 2, 100.0, 50.0},
    {pins::kSquare1kHz, "1 kHz square", 0, 3, 1000.0, 50.0},
    {pins::kSquare10kHz, "10 kHz square", 1, 0, 10000.0, 50.0},
    {pins::kSquare100kHz, "100 kHz square", 1, 1, 100000.0, 50.0},
};

// GP6/GP7 share PWM slice 3, so they share a frequency but have their own duty.
struct PwmPairConfig {
    unsigned pin_a;
    unsigned pin_b;
    const char* name_a;
    const char* name_b;
    double freq_hz;
    double duty_a_percent;
    double duty_b_percent;
};

inline constexpr PwmPairConfig kPwmPair = {
    pins::kPwm25, pins::kPwm75, "PWM 25% duty", "PWM 75% duty", 1000.0, 25.0, 75.0,
};

// GP8: short high pulse once per period, handy for practicing edge triggers.
struct PulseConfig {
    unsigned pin;
    const char* name;
    double freq_hz;
    uint32_t high_ns;
};

inline constexpr PulseConfig kPulse = {pins::kPulse, "1 us pulse every 1 ms", 1000.0, 1000};

// GP9: an irregular, repeating sequence of high/low segments played by PIO
// and fed by DMA. Total period is exactly 1 ms. Good for practicing
// "find this exact pulse" triggers and measuring individual widths.
inline constexpr timing::PatternSegment kPatternSegments[] = {
    {true, 10000},  // 10 us high (frame start marker)
    {false, 5000},  //  5 us low
    {true, 20000},  // 20 us high
    {false, 2000},  //  2 us low
    {true, 1000},   //  1 us high
    {false, 1000},  //  1 us low
    {true, 1000},   //  1 us high
    {false, 50000}, // 50 us low
    {true, 3000},   //  3 us high, then a 3-3-3 burst
    {false, 3000},
    {true, 3000},
    {false, 3000},
    {true, 3000},
    {false, 895000},  // idle low for the rest of the 1 ms frame
};

constexpr size_t kPatternSegmentCount = sizeof(kPatternSegments) / sizeof(kPatternSegments[0]);
constexpr const char* kPatternName = "irregular pattern, 1 ms";

// The pattern state machine lives next to the 10 kHz and 100 kHz square waves.
constexpr unsigned kPatternPioIndex = 1;
constexpr unsigned kPatternSm = 2;

// GP26: a push button pressed every 500 ms, the way a real one looks: active
// low (pulled up, the button connects to ground), with contact bounce on
// press and release. Played by the same PIO pattern player as GP9. The burst
// is irregular on purpose: a 220 us stretch of "released" in the middle of the
// press, and 2-3 us spikes that only fast sample rates catch.
inline constexpr timing::PatternSegment kBounceSegments[] = {
    // Press: 6 falling edges before the contacts settle, 583 us after the first.
    {false, 40000},
    {true, 15000},
    {false, 120000},
    {true, 60000},
    {false, 8000},
    {true, 220000},
    {false, 90000},
    {true, 3000},
    {false, 25000},
    {true, 2000},
    {false, 199417000},  // Held down: 200 ms from the first edge.
    // Release: 3 rising edges, settled 100 us after the first.
    {true, 20000},
    {false, 6000},
    {true, 70000},
    {false, 4000},
    {true, 299900000},  // Released for the rest of the 500 ms cycle.
};

constexpr size_t kBounceSegmentCount = sizeof(kBounceSegments) / sizeof(kBounceSegments[0]);
constexpr const char* kBounceName = "bouncing button, 500 ms";

// PIO2, so PIO0 and PIO1 stay as they were. The CYW43 driver needs one state
// machine and a few instructions, which PIO2 still has.
constexpr unsigned kBouncePioIndex = 2;
constexpr unsigned kBounceSm = 0;

// ---------------------------------------------------------------------------
// Protocol signals on GP10-GP22 (see src/core/protocol_frame.h)
// ---------------------------------------------------------------------------
// One 120 ms frame repeats forever. Times are in microseconds from the start
// of the frame. Every protocol simulates both sides of its bus, so no
// external device or wiring is needed. Several protocols overlap in time,
// each on its own pins.
struct ProtocolConfig {
    uint32_t frame_us = 120000;

    // UART, 8N1. Message n (1..count) is uart_text followed by n and "\r\n",
    // e.g. "Test bench #1\r\n"; the simulated device answers uart_reply.
    uint32_t uart_baud = 115200;
    const char* uart_text = "Test bench #";
    const char* uart_reply = "OK\r\n";
    unsigned uart_count = 4;
    uint32_t uart_first_us = 1000;
    uint32_t uart_period_us = 30000;
    uint32_t uart_reply_delay_us = 1000;  // From the end of the message.

    // I²C: a TMP102-style temperature sensor. Each read writes the register
    // pointer, then reads two bytes after a repeated START. The last slot of
    // the frame addresses a device that is not there, to show a NAK.
    uint32_t i2c_hz = 100000;
    uint8_t i2c_address = 0x48;
    uint8_t i2c_missing_address = 0x49;
    uint8_t i2c_register = 0x00;     // TMP102 temperature register.
    uint16_t i2c_value = 0x1900;     // 25.0 C: 12-bit, 0.0625 C per bit, left aligned.
    unsigned i2c_count = 12;         // Transactions per frame; the last one is the NAK.
    uint32_t i2c_first_us = 2000;
    uint32_t i2c_period_us = 10000;

    // SPI mode 0: reading the JEDEC ID of a W25Q128 flash chip.
    uint32_t spi_hz = 1000000;
    uint8_t spi_command = 0x9F;
    uint8_t spi_reply[3] = {0xEF, 0x40, 0x18};  // Winbond, SPI NOR, 128 Mbit.
    unsigned spi_count = 12;
    uint32_t spi_first_us = 4000;
    uint32_t spi_period_us = 10000;

    // WS2812: a strip of LEDs showing a rainbow that moves one LED per update.
    unsigned ws2812_leds = 8;
    uint8_t ws2812_brightness = 32;  // Out of 255, per color.
    unsigned ws2812_count = 12;
    uint32_t ws2812_first_us = 6000;
    uint32_t ws2812_period_us = 10000;

    // 1-Wire: a DS18B20 temperature sensor. Start a conversion, then later
    // read the 9-byte scratchpad (temperature, limits, config, CRC).
    uint32_t onewire_convert_us = 5000;
    uint32_t onewire_read_us = 65000;
    uint16_t onewire_raw_temp = 0x0191;  // 25.0625 C: 0.0625 C per bit.

    // IR remote (NEC), as an IR receiver module outputs it: one key press,
    // then one repeat code because the key is still held.
    uint8_t ir_address = 0x00;
    uint8_t ir_command = 0x45;
    // The repeat code follows 108 ms after the key press and lasts 11.8 ms,
    // so the key press must start in the first 0.18 ms of the frame.
    uint32_t ir_first_us = 100;

    // Quadrature encoder: forward, then back the same number of steps, so the
    // frame ends where it started.
    unsigned quadrature_steps = 60;
    uint32_t quadrature_step_us = 1000;
    uint32_t quadrature_first_us = 500;
};

inline constexpr ProtocolConfig kProtocols{};

// ---------------------------------------------------------------------------
// "Video and input" preset on GP10-GP19 (see src/core/video_frame.h)
// ---------------------------------------------------------------------------
// A VGA picture with the inputs a retro computer or console reads: an NES
// controller and a PS/2 keyboard. The timeline holds `frames` video frames
// and repeats forever.
struct VideoConfig {
    // VGA 640x480 with negative sync pulses. One pixel is pixel_cycles clk_sys
    // cycles: 150 MHz / 6 = 25 MHz, 0.7% below the standard 25.175 MHz, so
    // lines come at 31.25 kHz and frames at 59.52 Hz, which monitors accept.
    unsigned pixel_cycles = 6;
    unsigned h_visible = 640;
    unsigned h_front = 16;  // Front porch, sync pulse and back porch, in pixels.
    unsigned h_sync = 96;
    unsigned h_back = 48;
    unsigned v_visible = 480;
    unsigned v_front = 10;  // In lines.
    unsigned v_sync = 2;
    unsigned v_back = 33;
    unsigned frames = 2;  // Exactly two: the keyboard presses the key in one and releases it in the other.

    // NES controller (a 4021 shift register), read the way games do: once per
    // video frame, at the start of vertical blanking. One byte per frame,
    // bit 0 = A, then B, Select, Start, Up, Down, Left, Right; 1 = pressed.
    uint8_t nes_buttons[2] = {0x81, 0x08};  // A + Right, then Start.
    uint32_t nes_latch_us = 12;
    uint32_t nes_clock_period_us = 12;  // 8 clock pulses, low for half of each.
    uint32_t nes_first_clock_us = 6;    // From the end of the latch pulse.

    // PS/2 keyboard: the key goes down in the first video frame and up in the
    // second, in scan code set 2 (make code, then F0 + make code).
    uint32_t ps2_clock_hz = 12500;  // Keyboards clock at 10 to 16.7 kHz.
    uint8_t ps2_key = 0x1C;         // The A key.
    uint32_t ps2_first_us = 3000;   // From the start of each video frame.
    uint32_t ps2_byte_gap_us = 1000;  // Between the F0 and the make code.
};

inline constexpr VideoConfig kVideo{};

// ---------------------------------------------------------------------------
// "Faults" preset on GP10-GP20 (see src/core/faults_frame.h)
// ---------------------------------------------------------------------------
// The same kinds of buses as the Protocols preset, each with realistic
// mistakes to find: one good transaction next to each faulty one, so a
// learner can compare. One 120 ms frame repeats forever; times are in
// microseconds from its start.
struct FaultsConfig {
    uint32_t frame_us = 120000;

    // UART on GP10, 8N1: a good message, the same message from a sender whose
    // clock runs uart_slow_percent slow, and one with a framing error (the
    // stop bit of the message number is low).
    uint32_t uart_baud = 115200;
    const char* uart_text = "Fault bench #";  // Followed by the message number and "\r\n".
    double uart_slow_percent = 3.0;
    uint32_t uart_good_us = 1000;
    uint32_t uart_slow_us = 31000;
    uint32_t uart_framing_us = 61000;

    // UART on GP11, 8E1 (even parity): the same reading twice, the second with
    // the parity bit of character parity_bad_index inverted.
    const char* parity_text = "T=25.0C\r\n";
    uint32_t parity_good_us = 10000;
    uint32_t parity_bad_us = 70000;
    long parity_bad_index = 5;  // The '0'.

    // I²C on GP12/GP13, the TMP102-style sensor of the Protocols preset: a
    // read during which the sensor stretches the clock, and a write to its
    // configuration register whose data byte it does not acknowledge.
    uint32_t i2c_hz = 100000;
    uint8_t i2c_address = 0x48;
    uint16_t i2c_value = 0x1900;  // 25.0 C.
    uint32_t i2c_stretch_us = 150;  // After the read address, before the data.
    uint32_t i2c_read_us = 2000;
    uint8_t i2c_config_register = 0x01;
    uint8_t i2c_config_value = 0x60;
    uint32_t i2c_write_us = 52000;

    // SPI mode 0 on GP14-GP17, the JEDEC ID read of the Protocols preset: one
    // aborted after spi_abort_bits bits (CS rises mid-byte) and retried, and
    // one answered by a device set up for mode 1.
    uint32_t spi_hz = 1000000;
    uint8_t spi_command = 0x9F;
    uint8_t spi_reply[3] = {0xEF, 0x40, 0x18};
    unsigned spi_abort_bits = 12;
    uint32_t spi_abort_us = 4000;
    uint32_t spi_retry_us = 4200;
    uint32_t spi_mode1_us = 54000;
    uint32_t spi_mode1_delay_ns = 100;  // The wrong-mode device's MISO change after each rising edge.

    // WS2812 on GP18: 8 LEDs all set to the same dim white; one bit that
    // should be a 1 has a high time between the 0 and 1 timings, so that LED
    // shows the wrong color.
    unsigned ws2812_leds = 8;
    uint8_t ws2812_level = 32;  // Every color of every LED. 32 = 0b00100000.
    long ws2812_bad_led = 4;    // The fifth LED.
    int ws2812_bad_bit = 13;    // Red, bit 5: the one 1 in the red byte (bit 23 is green MSB).
    uint32_t ws2812_bad_high_ns = 550;
    uint32_t ws2812_first_us = 6000;
    uint32_t ws2812_period_us = 50000;
    unsigned ws2812_count = 2;

    // 1-Wire on GP19: a reset nobody answers (no presence pulse), then a
    // scratchpad read from a DS18B20 whose CRC does not match (byte
    // onewire_bad_byte arrives corrupted).
    uint32_t onewire_absent_us = 5000;
    uint32_t onewire_read_us = 20000;
    uint16_t onewire_raw_temp = 0x0191;  // 25.0625 C.
    unsigned onewire_bad_byte = 0;
    uint8_t onewire_bad_xor = 0x08;  // One bit flipped in transit.

    // GP20, an active-low interrupt line, idle high: two real 10 us pulses
    // and three glitches of different widths, at irregular times.
    uint32_t irq_pulse_ns = 10000;
    uint32_t irq_pulse_us[2] = {15000, 75000};
    uint32_t glitch_ns[3] = {20, 40, 100};
    uint32_t glitch_at_us[3] = {33333, 47100, 88700};
};

inline constexpr FaultsConfig kFaults{};

// The timeline state machine: the free one next to the pattern.
constexpr unsigned kTimelinePioIndex = 1;
constexpr unsigned kTimelineSm = 3;

}  // namespace config
