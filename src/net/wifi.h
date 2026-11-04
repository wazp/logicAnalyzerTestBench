// Wi-Fi: joins the saved home network, or runs the TestBench setup hotspot.
//
//   boot, no saved network      -> kSetup: hotspot + captive portal
//   boot, saved network         -> kJoining -> kJoined (station only)
//                                           -> join error: kSetup, error shown
//   joined, link lost           -> keeps retrying the saved network
//
// The web server (http_server.cpp) runs in lwIP's interrupt context, so it
// only *requests* scans, saves and forgets. wifi_poll(), called from the main
// loop, carries them out (flash writes and reboots must not run in an
// interrupt).

#pragma once

#include <cstddef>

#include "core/scan_list.h"
#include "core/settings.h"

enum class WifiMode { kOff, kSetup, kJoining, kJoined };
enum class JoinError { kNone, kWrongPassword, kNotFound, kTimeout, kFailed };

struct WifiInfo {
    WifiMode mode = WifiMode::kOff;
    char ssid[settings::kMaxSsid + 1] = {};  // Saved network, empty if none.
    char ip[16] = {};                        // Our address on the current interface.
    char hostname[24] = {};                  // e.g. "testbench-f8cd" (reachable as <hostname>.local).
    char ap_ssid[24] = {};                   // e.g. "TestBench-F8CD".
    JoinError last_error = JoinError::kNone;
};

// Starts the radio after the signals are running. Never blocks for long and
// never stops the signals; returns false if the radio failed to start.
bool wifi_start();

// Call from the main loop.
void wifi_poll();

void wifi_info(WifiInfo& out);
const char* wifi_mode_code(WifiMode mode);       // "setup", "joining", "joined", "off"
const char* wifi_error_code(JoinError error);    // "", "wrong_password", ...
void wifi_status_line(char* out, size_t size);  // One line for the serial console.

// --- Requests from the web server (safe in lwIP context) -------------------

bool wifi_request_scan();  // false if a scan is already running.
bool wifi_scan_running();
const scan::List& wifi_scan_results();
void wifi_request_save(const settings::WifiSettings& s);  // Saves, then reboots.
void wifi_request_forget();                               // Erases, then reboots.

// --- Direct actions (main loop only) ----------------------------------------

void wifi_forget_and_reboot();

// The onboard LED (wired to the radio chip). On means the guide is reachable.
void wifi_set_led(bool on);
