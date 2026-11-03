#include "wifi_ap.h"

#include <cstdio>
#include <cstring>

#include "hardware/pio.h"
#include "lwip/apps/httpd.h"
#include "pico/cyw43_arch.h"
#include "pico/unique_id.h"
#include "wifi_config.h"

// The vendored servers are C without extern "C" guards in their headers.
extern "C" {
#include "dhcpserver.h"
#include "dnsserver.h"
}

namespace {

dhcp_server_t dhcp_server;
dns_server_t dns_server;
char ssid[32];
bool running = false;
int init_error = 0;

}  // namespace

bool wifi_ap_start() {
    char board_id[2 * PICO_UNIQUE_BOARD_ID_SIZE_BYTES + 1];
    pico_get_unique_board_id_string(board_id, sizeof(board_id));
    snprintf(ssid, sizeof(ssid), "%s%s", wifi_config::kSsidPrefix, board_id + strlen(board_id) - 4);

    // The CYW43 driver takes the first PIO state machine it finds free. PIO0
    // is full, but PIO1 SM3 is free and we want to keep it for future signal
    // modes, so hold it while the driver starts. The driver then lands on PIO2.
    pio_sm_claim(pio1, 3);
    init_error = cyw43_arch_init();
    pio_sm_unclaim(pio1, 3);
    if (init_error != 0) {
        printf("Wi-Fi: radio init failed (%d), continuing without the web guide\n", init_error);
        return false;
    }

    cyw43_arch_enable_ap_mode(ssid, wifi_config::kPassword, CYW43_AUTH_WPA2_AES_PSK);

    // lwIP is not thread safe; with the background architecture, calls from
    // main code must be wrapped in begin/end.
    cyw43_arch_lwip_begin();
    struct netif* nif = &cyw43_state.netif[CYW43_ITF_AP];
    ip_addr_t gateway;
    ip_addr_t netmask;
    ipaddr_aton(wifi_config::kApAddress, &gateway);
    ipaddr_aton("255.255.255.0", &netmask);
    dhcp_server_init(&dhcp_server, nif, &gateway, &netmask);
    dns_server_init(&dns_server, nif, &gateway);
    httpd_init();
    cyw43_arch_lwip_end();

    // The Pico 2 W LED is wired to the wireless chip. Lit = guide available.
    cyw43_arch_gpio_put(CYW43_WL_GPIO_LED_PIN, 1);
    running = true;
    return true;
}

void wifi_ap_status(char* out, size_t size) {
    if (running) {
        snprintf(out, size, "Wi-Fi \"%s\", password \"%s\", guide at http://%s/", ssid, wifi_config::kPassword,
                 wifi_config::kApAddress);
    } else if (init_error != 0) {
        snprintf(out, size, "Wi-Fi off (radio init failed, error %d)", init_error);
    } else {
        snprintf(out, size, "Wi-Fi not started");
    }
}
