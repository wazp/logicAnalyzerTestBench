// Saved Wi-Fi settings in the second-to-last 4 KB sector of flash (see
// settings_store.cpp for why not the last one).
//
// The layout and validation live in src/core/settings.h. Writing erases the
// sector, which stalls flash access for tens of milliseconds. The test signals
// keep running: PIO, PWM and the pattern DMA run from registers and RAM.

#pragma once

#include "core/settings.h"

// Checks at boot that the firmware image does not reach the settings sector.
// Panics with a clear message if it does.
void settings_store_check_layout();

// Returns false when nothing valid is stored (fresh board, forgotten network).
bool settings_store_load(settings::WifiSettings& out);

// Both return false if the flash write could not be done safely.
bool settings_store_save(const settings::WifiSettings& s);
bool settings_store_erase();
