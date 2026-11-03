#include "pwm_output.h"

#include <cstdio>

#include "hardware/clocks.h"
#include "hardware/gpio.h"
#include "hardware/pwm.h"
#include "status.h"

namespace {

timing::PwmTiming compute_or_panic(unsigned pin, const char* name, double freq_hz) {
    const timing::PwmTiming t = timing::compute_pwm_timing(clock_get_hz(clk_sys), freq_hz);
    if (!t.valid) {
        panic("GP%u (%s): %s", pin, name, t.error);
    }
    return t;
}

void configure_slice(unsigned slice, const timing::PwmTiming& t) {
    pwm_config c = pwm_get_default_config();
    pwm_config_set_clkdiv_int(&c, t.clkdiv);
    pwm_config_set_wrap(&c, static_cast<uint16_t>(t.top));
    pwm_init(slice, &c, false);  // Configure but leave stopped.
}

// The compare register is 16 bits. A level of TOP + 1 (always high) does not
// fit when TOP is 65535, so saturate; that leaves a single low count per period.
uint16_t to_level16(uint32_t level) { return level > 0xFFFFu ? 0xFFFFu : static_cast<uint16_t>(level); }

void add_status(unsigned pin, const char* name, unsigned slice, double requested_hz, const timing::PwmTiming& t,
                uint32_t level, const char* detail) {
    SignalStatus s = {};
    s.pin = pin;
    s.name = name;
    snprintf(s.peripheral, sizeof(s.peripheral), "PWM%u %c", slice, pwm_gpio_to_channel(pin) == PWM_CHAN_A ? 'A' : 'B');
    s.requested_hz = requested_hz;
    s.actual_hz = t.actual_hz;
    s.duty_percent = 100.0 * static_cast<double>(level) / (static_cast<double>(t.top) + 1.0);
    snprintf(s.detail, sizeof(s.detail), "%s", detail);
    status_add(s);
}

}  // namespace

unsigned pwm_output_init_pair(const config::PwmPairConfig& cfg) {
    const unsigned slice = pwm_gpio_to_slice_num(cfg.pin_a);
    hard_assert(slice == pwm_gpio_to_slice_num(cfg.pin_b));

    const timing::PwmTiming t = compute_or_panic(cfg.pin_a, cfg.name_a, cfg.freq_hz);
    configure_slice(slice, t);

    const uint32_t level_a = timing::pwm_level_for_duty(t, cfg.duty_a_percent);
    const uint32_t level_b = timing::pwm_level_for_duty(t, cfg.duty_b_percent);
    pwm_set_chan_level(slice, PWM_CHAN_A, to_level16(level_a));
    pwm_set_chan_level(slice, PWM_CHAN_B, to_level16(level_b));
    gpio_set_function(cfg.pin_a, GPIO_FUNC_PWM);
    gpio_set_function(cfg.pin_b, GPIO_FUNC_PWM);

    char detail[48];
    snprintf(detail, sizeof(detail), "div %lu, top %lu", static_cast<unsigned long>(t.clkdiv),
             static_cast<unsigned long>(t.top));
    add_status(cfg.pin_a, cfg.name_a, slice, cfg.freq_hz, t, level_a, detail);
    add_status(cfg.pin_b, cfg.name_b, slice, cfg.freq_hz, t, level_b, detail);
    return slice;
}

unsigned pwm_output_init_pulse(const config::PulseConfig& cfg) {
    const unsigned slice = pwm_gpio_to_slice_num(cfg.pin);
    const timing::PwmTiming t = compute_or_panic(cfg.pin, cfg.name, cfg.freq_hz);
    configure_slice(slice, t);

    const uint32_t level = timing::pwm_level_for_high_time_ns(t, cfg.high_ns);
    pwm_set_chan_level(slice, pwm_gpio_to_channel(cfg.pin), to_level16(level));
    gpio_set_function(cfg.pin, GPIO_FUNC_PWM);

    char detail[48];
    snprintf(detail, sizeof(detail), "%.3f us high", timing::pwm_high_time_ns(t, level) / 1000.0);
    add_status(cfg.pin, cfg.name, slice, cfg.freq_hz, t, level, detail);
    return slice;
}
