// The active signal preset (src/core/presets.h) and switching to another one.
//
// The preset is read from flash once at boot, before any signal starts.
// Switching saves the new preset and restarts the board, so every signal,
// old and new, starts in sync again at t = 0. Requests may come from the web
// server (lwIP context) or the console; the flash write and the restart
// happen in preset_poll(), called from the main loop.

#pragma once

#include "core/presets.h"

// Reads the saved preset. Call once at boot, before the signals are set up.
presets::Preset preset_load();

presets::Preset preset_active();

// Asks for a switch. Returns false if `p` is already active (nothing to do;
// it also cancels a different switch that has not been saved yet) or a
// restart is already under way. Safe to call from lwIP callbacks.
bool preset_request(presets::Preset p);

// True from an accepted request until the restart.
bool preset_switch_pending();

// Call from the main loop: saves a requested preset, then restarts after a
// short delay so a web response can still reach the browser.
void preset_poll();
