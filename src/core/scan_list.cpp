#include "core/scan_list.h"

#include <algorithm>
#include <cstring>

namespace scan {

void add(List& list, const uint8_t* ssid, size_t ssid_len, int16_t rssi, bool secure) {
    if (ssid_len == 0 || ssid_len > 32 || ssid[0] == 0) {
        return;
    }
    for (size_t i = 0; i < list.count; ++i) {
        Network& n = list.networks[i];
        if (std::strlen(n.ssid) == ssid_len && std::memcmp(n.ssid, ssid, ssid_len) == 0) {
            if (rssi > n.rssi) {
                n.rssi = rssi;
                n.secure = secure;
            }
            return;
        }
    }
    Network* slot = nullptr;
    if (list.count < kMaxNetworks) {
        slot = &list.networks[list.count++];
    } else {
        Network* weakest = std::min_element(list.networks, list.networks + list.count,
                                            [](const Network& a, const Network& b) { return a.rssi < b.rssi; });
        if (rssi <= weakest->rssi) {
            return;
        }
        slot = weakest;
    }
    *slot = Network{};
    std::memcpy(slot->ssid, ssid, ssid_len);
    slot->rssi = rssi;
    slot->secure = secure;
}

void sort(List& list) {
    std::stable_sort(list.networks, list.networks + list.count,
                     [](const Network& a, const Network& b) { return a.rssi > b.rssi; });
}

}  // namespace scan
