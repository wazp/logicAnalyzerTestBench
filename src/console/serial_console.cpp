#include "serial_console.h"

#include <cstdio>

#include "hardware/clocks.h"
#include "net/wifi.h"
#include "pico/stdlib.h"
#include "status.h"

namespace {

bool was_connected = false;
bool confirm_forget = false;  // 'f' was pressed, waiting for 'y'.

void print_help() {
    printf("Commands:\n");
    printf("  s   print signal status table\n");
    printf("  w   print Wi-Fi status (network, IP address, guide address)\n");
    printf("  f   forget the saved Wi-Fi network and restart into the setup hotspot\n");
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

void print_wifi() {
    char line[192];
    wifi_status_line(line, sizeof(line));
    printf("%s\n", line);
}

void print_banner() {
    printf("\n=== Logic Analyzer Test Bench (Pico 2 W) ===\n");
    printf("All outputs are 3.3V and run in hardware (PIO/PWM/DMA).\n");
    print_wifi();
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
    if (confirm_forget && c != PICO_ERROR_TIMEOUT && c != '\r' && c != '\n') {
        confirm_forget = false;
        if (c == 'y' || c == 'Y') {
            wifi_forget_and_reboot();
        }
        printf("Kept the saved network.\n");
        return;
    }
    switch (c) {
        case PICO_ERROR_TIMEOUT:
            break;
        case 's':
        case 'S':
            print_status();
            break;
        case 'w':
        case 'W':
            print_wifi();
            break;
        case 'f':
        case 'F':
            printf("Forget the saved Wi-Fi network and restart? Press y to confirm, any other key to cancel.\n");
            confirm_forget = true;
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
