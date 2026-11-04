// Small HTTP server for the web guide and its JSON API, on port 80.
//
// Behaves differently per interface, decided by the address a request
// arrived on:
//   setup hotspot (4.3.2.1)  /guide serves the page, every other non-API URL
//                            redirects to http://4.3.2.1/guide. That redirect
//                            is what makes phones show "Sign in to network"
//                            (see tools/prepare_web_content.py history and
//                            AGENTS.md, captive portal rules).
//   home network             / and /guide serve the page, other URLs redirect
//                            to /.
//
// API (both interfaces; the password is never returned):
//   GET  /api/status        {"mode","ssid","ip","hostname","ap_ssid","last_error","version"}
//   POST /api/scan          start a scan, 202
//   GET  /api/scan          {"scanning":bool,"networks":[{"ssid","rssi","secure"}]}
//   POST /api/wifi          form fields ssid, password; saves and reboots
//   POST /api/wifi/forget   erases the saved network and reboots
//
// Runs entirely in lwIP callbacks (interrupt context). Requests that need
// flash writes or reboots are handed to wifi_poll() via net/wifi.h.

#pragma once

void http_server_start();
