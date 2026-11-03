// Wi-Fi access point settings.
//
// The network name gets the last four hex digits of the board's unique ID
// appended (e.g. "TestBench-1A2B"), so several boards can run side by side.
// The password is deliberately simple and documented in README.md: the
// network only serves read-only lesson pages. WPA2 requires 8 to 63 characters.

#pragma once

namespace wifi_config {

constexpr const char* kSsidPrefix = "TestBench-";
constexpr const char* kPassword = "testbench";

// Must match pico_configure_ip4_address in CMakeLists.txt.
constexpr const char* kApAddress = "192.168.4.1";

}  // namespace wifi_config
