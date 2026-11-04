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

// Deliberately not a private (192.168.x.x) address. Every hostname resolves
// to this address, and recent Android versions treat a connectivity-check
// hostname that resolves to a private address as "no internet" instead of a
// sign-in portal: they skip the check, never show the guide, and keep
// browsers off the network. 4.3.2.1 is the usual choice for isolated captive
// portals; the network has no internet, so it hides nothing real.
// Must match LTB_AP_ADDRESS in CMakeLists.txt.
constexpr const char* kApAddress = "4.3.2.1";

}  // namespace wifi_config
