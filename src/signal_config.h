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
// frequency. PIO2 is left free for the CYW43 driver or future modes.
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

// The timeline state machine: the free one next to the pattern.
constexpr unsigned kTimelinePioIndex = 1;
constexpr unsigned kTimelineSm = 3;

}  // namespace config
