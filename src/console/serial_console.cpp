#include "serial_console.h"

#include <cstdio>

#include "hardware/clocks.h"
#include "net/wifi.h"
#include "pico/stdlib.h"
#include "preset_control.h"
#include "status.h"

namespace {

bool was_connected = false;
bool confirm_forget = false;  // 'f' was pressed, waiting for 'y'.
bool choose_preset = false;   // 'p' was pressed, waiting for a preset number.

void print_help() {
    printf("Commands:\n");
    printf("  s   print signal status table\n");
    printf("  w   print Wi-Fi status (network, IP address, guide address)\n");
    printf("  p   choose the signal preset for GP10-GP22 (restarts the board)\n");
    printf("  f   forget the saved Wi-Fi network and restart into the setup hotspot\n");
    printf("  h   print this help\n");
}

// "-" for no single frequency, otherwise Hz, kHz or MHz. newlib's %g keeps
// trailing zeros and switches to odd exponent forms above 1e5, so scale first.
void format_hz(char* out, size_t size, double hz) {
    if (hz <= 0.0) {
        snprintf(out, size, "-");
    } else if (hz >= 1e6) {
        snprintf(out, size, "%.6g MHz", hz / 1e6);
    } else if (hz >= 1e3) {
        snprintf(out, size, "%.6g kHz", hz / 1e3);
    } else {
        snprintf(out, size, "%.6g Hz", hz);
    }
}

void print_status() {
    printf("\nclk_sys = %.3f MHz, uptime %llu ms\n", clock_get_hz(clk_sys) / 1e6,
           static_cast<unsigned long long>(to_ms_since_boot(get_absolute_time())));
    printf("%-5s %-24s %-14s %-16s %-16s %-8s %s\n", "GPIO", "Signal", "Peripheral", "Requested", "Actual", "Duty",
           "Detail");
    for (size_t i = 0; i < status_count(); ++i) {
        const SignalStatus& s = status_get(i);
        char requested[20];
        format_hz(requested, sizeof(requested), s.requested_hz);
        char actual[20];
        format_hz(actual, sizeof(actual), s.actual_hz);
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

void print_presets() {
    printf("Signal presets for GP10-GP22 (GP0-GP9 and GP26 never change):\n");
    for (unsigned i = 0; i < presets::kCount; ++i) {
        const presets::Preset p = presets::kAll[i];
        printf("  %u   %-16s %s\n", i + 1, presets::title(p), p == preset_active() ? "(active)" : "");
    }
    printf("Press a number to switch (the board restarts), any other key to cancel.\n");
}

void print_banner() {
    printf("\n=== Logic Analyzer Test Bench (Pico 2 W) ===\n");
    printf("All outputs are 3.3V and run in hardware (PIO/PWM/DMA).\n");
    printf("Signal preset: %s\n", presets::title(preset_active()));
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
    if (choose_preset && c != PICO_ERROR_TIMEOUT && c != '\r' && c != '\n') {
        choose_preset = false;
        const int index = c - '1';
        if (index < 0 || index >= static_cast<int>(presets::kCount)) {
            printf("Kept the %s preset.\n", presets::title(preset_active()));
        } else if (!preset_request(presets::kAll[index])) {
            printf("%s is already active.\n", presets::title(presets::kAll[index]));
        }
        return;  // preset_poll() prints the switch and restarts.
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
        case 'p':
        case 'P':
            print_presets();
            choose_preset = true;
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
