#include "wifi.h"

#include <cstdio>
#include <cstring>

#include "hardware/watchdog.h"
#include "hw/settings_store.h"
#include "lwip/apps/mdns.h"
#include "net/http_server.h"
#include "pico/cyw43_arch.h"
#include "pico/unique_id.h"
#include "wifi_config.h"

// The vendored servers are C without extern "C" guards in their headers.
extern "C" {
#include "dhcpserver.h"
#include "dnsserver.h"
}

namespace {

// How long a join may take before we give up and start the setup hotspot.
constexpr uint32_t kJoinTimeoutMs = 20000;
// After the link drops, how long before we ask the radio to join again.
constexpr uint32_t kRejoinIntervalMs = 15000;
// Time for the HTTP response to reach the browser before a reboot.
constexpr uint32_t kRebootDelayMs = 1500;

WifiMode mode = WifiMode::kOff;
JoinError last_error = JoinError::kNone;
settings::WifiSettings saved;  // Empty ssid = nothing saved.
char hostname[24];
char ap_ssid[24];

absolute_time_t join_deadline;
bool mdns_running = false;
bool setup_services_running = false;
dhcp_server_t dhcp_server;
dns_server_t dns_server;

// Requests from the web server, carried out in wifi_poll().
volatile bool scan_requested = false;
volatile bool save_requested = false;
volatile bool forget_requested = false;
settings::WifiSettings pending_save;
bool reboot_pending = false;
absolute_time_t reboot_at;

scan::List scan_results;
bool scan_running = false;

uint32_t auth_for(const char* password) {
    // WPA3/WPA2 mixed joins both WPA2 and WPA3 routers.
    return password[0] == '\0' ? CYW43_AUTH_OPEN : CYW43_AUTH_WPA3_WPA2_AES_PSK;
}

void led(bool on) { cyw43_arch_gpio_put(CYW43_WL_GPIO_LED_PIN, on); }

void start_setup() {
    cyw43_arch_enable_ap_mode(ap_ssid, wifi_config::kPassword, CYW43_AUTH_WPA2_AES_PSK);
    if (!setup_services_running) {
        // DHCP and the catch-all DNS only make sense on our own hotspot; on a
        // home network the router provides both.
        cyw43_arch_lwip_begin();
        struct netif* nif = &cyw43_state.netif[CYW43_ITF_AP];
        ip_addr_t gateway;
        ip_addr_t netmask;
        ipaddr_aton(wifi_config::kApAddress, &gateway);
        ipaddr_aton("255.255.255.0", &netmask);
        dhcp_server_init(&dhcp_server, nif, &gateway, &netmask);
        dns_server_init(&dns_server, nif, &gateway);
        cyw43_arch_lwip_end();
        setup_services_running = true;
    }
    mode = WifiMode::kSetup;
    led(true);
    printf("Wi-Fi: setup hotspot \"%s\" is up, guide at http://%s/\n", ap_ssid, wifi_config::kApAddress);
}

void start_join() {
    cyw43_arch_enable_sta_mode();
    cyw43_arch_lwip_begin();
    netif_set_hostname(&cyw43_state.netif[CYW43_ITF_STA], hostname);  // Shown in the router's client list.
    cyw43_arch_lwip_end();
    const int err = cyw43_arch_wifi_connect_async(saved.ssid, saved.password[0] ? saved.password : nullptr,
                                                  auth_for(saved.password));
    if (err != 0) {
        printf("Wi-Fi: could not start joining \"%s\" (%d)\n", saved.ssid, err);
    }
    mode = WifiMode::kJoining;
    led(false);
    join_deadline = make_timeout_time_ms(kJoinTimeoutMs);
    printf("Wi-Fi: joining \"%s\"\n", saved.ssid);
}

void on_joined() {
    mode = WifiMode::kJoined;
    last_error = JoinError::kNone;
    led(true);
    if (!mdns_running) {
        cyw43_arch_lwip_begin();
        mdns_resp_init();
        struct netif* nif = &cyw43_state.netif[CYW43_ITF_STA];
        mdns_resp_add_netif(nif, hostname);
        mdns_resp_add_service(nif, "Logic Analyzer Test Bench", "_http", DNSSD_PROTO_TCP, 80, nullptr, nullptr);
        cyw43_arch_lwip_end();
        mdns_running = true;
    }
    char line[160];
    wifi_status_line(line, sizeof(line));
    printf("%s\n", line);
}

void on_join_failed(JoinError error) {
    last_error = error;
    printf("Wi-Fi: could not join \"%s\" (%s), starting the setup hotspot\n", saved.ssid, wifi_error_code(error));
    cyw43_arch_disable_sta_mode();
    start_setup();
}

int on_scan_result(void*, const cyw43_ev_scan_result_t* r) {
    if (r != nullptr) {
        scan::add(scan_results, r->ssid, r->ssid_len, r->rssi, r->auth_mode != CYW43_AUTH_OPEN);
    }
    return 0;
}

void start_scan() {
    scan_results = scan::List{};
    cyw43_wifi_scan_options_t options = {};
    cyw43_arch_lwip_begin();
    const int err = cyw43_wifi_scan(&cyw43_state, &options, nullptr, on_scan_result);
    cyw43_arch_lwip_end();
    scan_running = (err == 0);
    if (err != 0) {
        printf("Wi-Fi: scan failed to start (%d)\n", err);
    }
}

// Replaces the saved network and keeps everything else in the settings (the
// signal preset). Re-reads flash first, so it never writes back a stale preset.
bool store_network(const settings::WifiSettings& network) {
    settings::Settings all;
    settings_store_load(all);
    all.wifi = network;
    return settings_store_save(all);
}

void schedule_reboot() {
    reboot_pending = true;
    reboot_at = make_timeout_time_ms(kRebootDelayMs);
}

}  // namespace

bool wifi_start() {
    char board_id[2 * PICO_UNIQUE_BOARD_ID_SIZE_BYTES + 1];
    pico_get_unique_board_id_string(board_id, sizeof(board_id));
    const char* suffix = board_id + strlen(board_id) - 4;
    snprintf(ap_ssid, sizeof(ap_ssid), "%s%s", wifi_config::kSsidPrefix, suffix);
    snprintf(hostname, sizeof(hostname), "%s%s", wifi_config::kHostnamePrefix, suffix);
    for (char* c = hostname; *c != '\0'; ++c) {
        if (*c >= 'A' && *c <= 'Z') *c = static_cast<char>(*c - 'A' + 'a');  // DNS names are lowercase by convention.
    }

    settings_store_check_layout();
    settings::Settings all;
    settings_store_load(all);  // Defaults (no network) when nothing is stored.
    saved = all.wifi;

    // The CYW43 driver takes the first PIO with a free state machine. The
    // signals have already claimed every state machine in PIO0 and PIO1 and
    // SM0 of PIO2 (see main.cpp), so the driver lands on PIO2, as AGENTS.md
    // requires.
    const int err = cyw43_arch_init();
    if (err != 0) {
        printf("Wi-Fi: radio init failed (%d), continuing without the web guide\n", err);
        return false;
    }

    http_server_start();
    if (saved.ssid[0] != '\0') {
        start_join();
    } else {
        start_setup();
    }
    return true;
}

void wifi_poll() {
    if (mode == WifiMode::kOff) {
        return;
    }
    if (reboot_pending) {
        if (time_reached(reboot_at)) {
            watchdog_reboot(0, 0, 0);
        }
        return;
    }
    if (forget_requested) {
        forget_requested = false;
        store_network({});
        printf("Wi-Fi: network forgotten, restarting into the setup hotspot\n");
        schedule_reboot();
        return;
    }
    if (save_requested) {
        save_requested = false;
        if (store_network(pending_save)) {
            printf("Wi-Fi: saved \"%s\", restarting to join it\n", pending_save.ssid);
        } else {
            printf("Wi-Fi: could not write the settings to flash\n");
        }
        schedule_reboot();
        return;
    }
    if (scan_requested) {
        scan_requested = false;
        start_scan();
    }
    if (scan_running && !cyw43_wifi_scan_active(&cyw43_state)) {
        cyw43_arch_lwip_begin();
        scan::sort(scan_results);
        cyw43_arch_lwip_end();
        scan_running = false;
    }

    const int link = cyw43_tcpip_link_status(&cyw43_state, CYW43_ITF_STA);
    if (mode == WifiMode::kJoining) {
        if (link == CYW43_LINK_UP) {
            on_joined();
        } else if (link == CYW43_LINK_BADAUTH) {
            on_join_failed(JoinError::kWrongPassword);
        } else if (link == CYW43_LINK_NONET && !mdns_running) {
            on_join_failed(JoinError::kNotFound);
        } else if (link == CYW43_LINK_FAIL && !mdns_running) {
            on_join_failed(JoinError::kFailed);
        } else if (time_reached(join_deadline)) {
            if (mdns_running) {
                // We joined before, so this is a dropped link: keep trying
                // the saved network instead of switching to the hotspot.
                cyw43_arch_wifi_connect_async(saved.ssid, saved.password[0] ? saved.password : nullptr,
                                              auth_for(saved.password));
                join_deadline = make_timeout_time_ms(kJoinTimeoutMs);
            } else {
                on_join_failed(JoinError::kTimeout);
            }
        }
    } else if (mode == WifiMode::kJoined && link != CYW43_LINK_UP) {
        printf("Wi-Fi: lost the connection to \"%s\", rejoining\n", saved.ssid);
        mode = WifiMode::kJoining;
        led(false);
        join_deadline = make_timeout_time_ms(kRejoinIntervalMs);
    }
}

void wifi_info(WifiInfo& out) {
    out = WifiInfo{};
    out.mode = mode;
    out.last_error = last_error;
    snprintf(out.ssid, sizeof(out.ssid), "%s", saved.ssid);
    snprintf(out.hostname, sizeof(out.hostname), "%s", hostname);
    snprintf(out.ap_ssid, sizeof(out.ap_ssid), "%s", ap_ssid);
    if (mode == WifiMode::kSetup) {
        snprintf(out.ip, sizeof(out.ip), "%s", wifi_config::kApAddress);
    } else if (mode == WifiMode::kJoined) {
        ip4addr_ntoa_r(netif_ip4_addr(&cyw43_state.netif[CYW43_ITF_STA]), out.ip, sizeof(out.ip));
    }
}

const char* wifi_mode_code(WifiMode m) {
    switch (m) {
        case WifiMode::kOff: return "off";
        case WifiMode::kSetup: return "setup";
        case WifiMode::kJoining: return "joining";
        case WifiMode::kJoined: return "joined";
    }
    return "off";
}

const char* wifi_error_code(JoinError e) {
    switch (e) {
        case JoinError::kNone: return "";
        case JoinError::kWrongPassword: return "wrong_password";
        case JoinError::kNotFound: return "not_found";
        case JoinError::kTimeout: return "timeout";
        case JoinError::kFailed: return "failed";
    }
    return "failed";
}

void wifi_status_line(char* out, size_t size) {
    WifiInfo info;
    wifi_info(info);
    const char* debug =
#ifdef LTB_NET_DEBUG
        " (network debug logging on)";
#else
        "";
#endif
    switch (info.mode) {
        case WifiMode::kOff:
            snprintf(out, size, "Wi-Fi off (radio did not start)");
            break;
        case WifiMode::kSetup:
            snprintf(out, size, "Wi-Fi setup hotspot \"%s\", password \"%s\", guide at http://%s/%s%s%s%s", info.ap_ssid,
                     wifi_config::kPassword, info.ip, info.last_error != JoinError::kNone ? " (could not join \"" : "",
                     info.last_error != JoinError::kNone ? info.ssid : "",
                     info.last_error != JoinError::kNone ? "\")" : "", debug);
            break;
        case WifiMode::kJoining:
            snprintf(out, size, "Wi-Fi joining \"%s\"...%s", info.ssid, debug);
            break;
        case WifiMode::kJoined:
            snprintf(out, size, "Wi-Fi joined \"%s\", guide at http://%s/ and http://%s.local/%s", info.ssid, info.ip,
                     info.hostname, debug);
            break;
    }
}

bool wifi_request_scan() {
    if (scan_running || scan_requested) {
        return false;
    }
    scan_requested = true;
    return true;
}

bool wifi_scan_running() { return scan_running || scan_requested; }

const scan::List& wifi_scan_results() { return scan_results; }

void wifi_request_save(const settings::WifiSettings& s) {
    pending_save = s;
    save_requested = true;
}

void wifi_request_forget() { forget_requested = true; }

void wifi_set_led(bool on) {
    if (mode != WifiMode::kOff) {
        led(on);
    }
}

void wifi_forget_and_reboot() {
    store_network({});
    printf("Wi-Fi: network forgotten, restarting into the setup hotspot\n");
    sleep_ms(200);  // Let the message reach the terminal.
    watchdog_reboot(0, 0, 0);
}
