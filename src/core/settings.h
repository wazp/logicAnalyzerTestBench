// Saved Wi-Fi settings: validation and the byte layout stored in flash.
//
// SDK-free so it can be unit tested on the host. src/hw/settings_store.cpp
// reads and writes the blob in a reserved flash sector near the end.
//
// Blob layout (kBlobSize bytes, little endian):
//   [0..4)    magic "LTBW"   erased flash (0xFF) never matches, so a fresh
//                            board simply has no settings
//   [4..8)    layout version
//   [8..41)   SSID, NUL padded (max 32 bytes + NUL)
//   [41..105) password, NUL padded (max 63 bytes + NUL)
//   [252..256) CRC-32 of bytes [0..252)

#pragma once

#include <cstddef>
#include <cstdint>

namespace settings {

constexpr size_t kMaxSsid = 32;      // 802.11 limit, in bytes.
constexpr size_t kMinPassword = 8;   // WPA2 passphrase limits.
constexpr size_t kMaxPassword = 63;
constexpr size_t kBlobSize = 256;    // One flash page.

struct WifiSettings {
    char ssid[kMaxSsid + 1] = {};
    char password[kMaxPassword + 1] = {};  // Empty for an open network.
};

enum class Error { kNone, kSsidRequired, kSsidTooLong, kPasswordTooShort, kPasswordTooLong };

// Checks the lengths the radio accepts. An empty password means an open network.
Error validate(const char* ssid, const char* password);

// Stable codes for the web API, e.g. "password_too_short".
const char* error_code(Error error);

// Fills a valid settings struct (validate() first).
WifiSettings make(const char* ssid, const char* password);

void serialize(const WifiSettings& s, uint8_t (&blob)[kBlobSize]);

// Returns false for erased flash, a wrong magic/version, a bad CRC, or
// strings that fail validation.
bool parse(const uint8_t* blob, size_t len, WifiSettings& out);

uint32_t crc32(const uint8_t* data, size_t len);

}  // namespace settings
