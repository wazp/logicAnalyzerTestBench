// Saved settings (Wi-Fi network and signal preset): validation and the byte
// layout stored in flash.
//
// SDK-free so it can be unit tested on the host. src/hw/settings_store.cpp
// reads and writes the blob in a reserved flash sector near the end.
//
// Blob layout (kBlobSize bytes, little endian):
//   [0..4)    magic "LTBW"   erased flash (0xFF) never matches, so a fresh
//                            board simply has no settings
//   [4..8)    layout version (2; version 1 had no preset byte)
//   [8..41)   SSID, NUL padded (max 32 bytes + NUL), empty = no saved network
//   [41..105) password, NUL padded (max 63 bytes + NUL)
//   [105]     signal preset (presets::Preset), version 2 only
//   [252..256) CRC-32 of bytes [0..252)
//
// A version 1 blob still loads, with the default preset, so updating the
// firmware keeps the saved network.

#pragma once

#include <cstddef>
#include <cstdint>

#include "core/presets.h"

namespace settings {

constexpr size_t kMaxSsid = 32;      // 802.11 limit, in bytes.
constexpr size_t kMinPassword = 8;   // WPA2 passphrase limits.
constexpr size_t kMaxPassword = 63;
constexpr size_t kBlobSize = 256;    // One flash page.

struct WifiSettings {
    char ssid[kMaxSsid + 1] = {};
    char password[kMaxPassword + 1] = {};  // Empty for an open network.
};

// Everything stored in the blob.
struct Settings {
    WifiSettings wifi;  // Empty ssid: no saved network.
    presets::Preset preset = presets::kDefault;
};

inline bool has_network(const Settings& s) { return s.wifi.ssid[0] != '\0'; }

enum class Error { kNone, kSsidRequired, kSsidTooLong, kPasswordTooShort, kPasswordTooLong };

// Checks the lengths the radio accepts. An empty password means an open network.
Error validate(const char* ssid, const char* password);

// Stable codes for the web API, e.g. "password_too_short".
const char* error_code(Error error);

// Fills a valid settings struct (validate() first).
WifiSettings make(const char* ssid, const char* password);

void serialize(const Settings& s, uint8_t (&blob)[kBlobSize]);

// Returns false for erased flash, a wrong magic/version, a bad CRC, or a saved
// network that fails validation. An unknown preset number loads as the
// default, so a newer firmware's preset never makes the settings unreadable.
bool parse(const uint8_t* blob, size_t len, Settings& out);

uint32_t crc32(const uint8_t* data, size_t len);

}  // namespace settings
