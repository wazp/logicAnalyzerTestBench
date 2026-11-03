#include "serial_console.h"

#include <cstdio>

#include "hardware/clocks.h"
#include "net/wifi_ap.h"
#include "pico/stdlib.h"
#include "status.h"

namespace {

bool was_connected = false;

void print_help() {
    printf("Commands:\n");
    printf("  s   print signal status table\n");
    printf("  h   print this help\n");
}

void print_status() {
    printf("\nclk_sys = %.3f MHz, uptime %llu ms\n", clock_get_hz(clk_sys) / 1e6,
           static_cast<unsigned long long>(to_ms_since_boot(get_absolute_time())));
    printf("%-5s %-24s %-14s %-16s %-16s %-8s %s\n", "GPIO", "Signal", "Peripheral", "Requested", "Actual", "Duty",
           "Detail");
    for (size_t i = 0; i < status_count(); ++i) {
        const SignalStatus& s = status_get(i);
        char requested[20];
        if (s.requested_hz > 0.0) {
            snprintf(requested, sizeof(requested), "%.6g Hz", s.requested_hz);
        } else {
            snprintf(requested, sizeof(requested), "-");
        }
        char actual[20];
        snprintf(actual, sizeof(actual), "%.6g Hz", s.actual_hz);
        printf("GP%-3u %-24s %-14s %-16s %-16s %6.2f%%  %s\n", s.pin, s.name, s.peripheral, requested, actual,
               s.duty_percent, s.detail);
    }
    printf("\n");
}

void print_banner() {
    printf("\n=== Logic Analyzer Test Bench (Pico 2 W) ===\n");
    printf("All outputs are 3.3V and run in hardware (PIO/PWM/DMA).\n");
    char wifi[128];
    wifi_ap_status(wifi, sizeof(wifi));
    printf("%s\n", wifi);
    print_status();
    print_help();
}

}  // namespace

void console_poll() {
    // Print the banner whenever a terminal (re)connects, so it is not lost
    // when the board booted before the host opened the port.
    const bool connected = stdio_usb_connected();
    if (connected && !was_connected) {
        sleep_ms(50);  // Give the host terminal a moment to start reading.
        print_banner();
    }
    was_connected = connected;

    const int c = getchar_timeout_us(100 * 1000);
    switch (c) {
        case PICO_ERROR_TIMEOUT:
            break;
        case 's':
        case 'S':
            print_status();
            break;
        case 'h':
        case 'H':
        case '?':
            print_help();
            break;
        case '\r':
        case '\n':
            break;
        default:
            printf("Unknown command '%c', press h for help\n", c);
            break;
    }
}
