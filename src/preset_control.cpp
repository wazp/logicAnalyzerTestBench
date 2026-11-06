#include "preset_control.h"

#include <cstdio>

#include "hardware/watchdog.h"
#include "hw/settings_store.h"
#include "pico/stdlib.h"

namespace {

// Time for the HTTP response to reach the browser before the restart.
constexpr uint32_t kRestartDelayMs = 1500;

presets::Preset active = presets::kDefault;
volatile bool requested = false;
volatile presets::Preset requested_preset = presets::kDefault;
bool restart_pending = false;
absolute_time_t restart_at;

}  // namespace

presets::Preset preset_load() {
    settings::Settings s;
    settings_store_load(s);  // Defaults when nothing is stored.
    active = s.preset;
    return active;
}

presets::Preset preset_active() { return active; }

bool preset_request(presets::Preset p) {
    if (p == active || restart_pending) {
        return false;
    }
    requested_preset = p;
    requested = true;
    return true;
}

bool preset_switch_pending() { return requested || restart_pending; }

void preset_poll() {
    if (restart_pending) {
        if (time_reached(restart_at)) {
            watchdog_reboot(0, 0, 0);
        }
        return;
    }
    if (!requested) {
        return;
    }
    requested = false;
    settings::Settings s;
    settings_store_load(s);  // Keeps the saved network.
    s.preset = requested_preset;
    if (!settings_store_save(s)) {
        printf("Preset: could not write the settings to flash, staying on %s\n", presets::title(active));
        return;
    }
    printf("Preset: switching to %s, restarting\n", presets::title(s.preset));
    restart_pending = true;
    restart_at = make_timeout_time_ms(kRestartDelayMs);
}
