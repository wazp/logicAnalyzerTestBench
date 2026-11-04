// Collects Wi-Fi scan results for the setup page: one entry per network name,
// keeping the strongest signal seen, sorted strongest first.
//
// The radio reports every access point (and often each one several times per
// scan), so a mesh network or a dual-band router would otherwise show up as
// many identical rows. SDK-free so it can be unit tested on the host.

#pragma once

#include <cstddef>
#include <cstdint>

namespace scan {

constexpr size_t kMaxNetworks = 24;

struct Network {
    char ssid[33] = {};
    int16_t rssi = 0;  // dBm, higher (closer to 0) is stronger.
    bool secure = false;
};

struct List {
    Network networks[kMaxNetworks];
    size_t count = 0;
};

// Adds one scan result. Hidden networks (empty name) are skipped. When the
// list is full, a stronger network replaces the weakest one.
void add(List& list, const uint8_t* ssid, size_t ssid_len, int16_t rssi, bool secure);

// Sorts by signal, strongest first.
void sort(List& list);

}  // namespace scan
