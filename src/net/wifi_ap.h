// Wi-Fi access point that serves the web guide.
//
// The Pico creates its own network (no router or internet needed). Anyone who
// joins it gets an address from a small DHCP server, every DNS lookup points
// back at the Pico, and the web server answers with the guide. Phones and
// laptops therefore usually open the guide by themselves after joining.

#pragma once

#include <cstddef>

// Starts the radio, access point, DHCP, DNS and HTTP servers. Call after the
// test signals are running: if Wi-Fi fails the signals are not affected.
// Returns false (and prints why) on failure.
bool wifi_ap_start();

// One line describing the access point, for the serial console.
void wifi_ap_status(char* out, size_t size);
