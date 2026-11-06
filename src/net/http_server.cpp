#include "net/http_server.h"

#include <algorithm>
#include <cstdio>
#include <cstring>

#include "core/http_request.h"
#include "lwip/tcp.h"
#include "net/wifi.h"
#include "pico/cyw43_arch.h"
#include "preset_control.h"
#include "wifi_config.h"

// The gzip compressed guide, generated at build time (kWebPageGzip).
#include "web_page.inc"

#ifndef PICO_PROGRAM_VERSION_STRING
#define PICO_PROGRAM_VERSION_STRING "unknown"
#endif

namespace {

constexpr int kMaxConnections = 6;
constexpr u8_t kPollInterval = 2;  // lwIP poll ticks of 500 ms, so 1 s.
constexpr int kIdleLimit = 10;     // Close a connection after ~10 s without progress.

struct Connection {
    bool in_use = false;
    tcp_pcb* pcb = nullptr;
    int idle = 0;
    bool responded = false;

    char rx[http::kMaxRequestSize];
    size_t rx_len = 0;

    // Headers and small bodies (JSON) are copied into tcp_write. The page is
    // sent straight from flash without copying.
    char head[4096];
    size_t head_len = 0;
    size_t head_sent = 0;
    const unsigned char* body = nullptr;
    size_t body_len = 0;
    size_t body_sent = 0;
};

Connection connections[kMaxConnections];

void release(Connection& c) {
    if (c.pcb != nullptr) {
        tcp_arg(c.pcb, nullptr);
        tcp_recv(c.pcb, nullptr);
        tcp_sent(c.pcb, nullptr);
        tcp_err(c.pcb, nullptr);
        tcp_poll(c.pcb, nullptr, 0);
    }
    c.in_use = false;
    c.pcb = nullptr;
}

void close_connection(Connection& c) {
    tcp_pcb* pcb = c.pcb;
    release(c);
    if (pcb != nullptr && tcp_close(pcb) != ERR_OK) {
        tcp_abort(pcb);  // Out of memory for the FIN; drop it rather than leak it.
    }
}

// Queues as much of the response as the send buffer takes. Called again from
// the sent and poll callbacks until everything is queued, then closes; lwIP
// still delivers the queued data before the FIN.
void pump(Connection& c) {
    while (c.head_sent < c.head_len) {
        const u16_t room = tcp_sndbuf(c.pcb);
        if (room == 0) break;
        const size_t n = std::min<size_t>(room, c.head_len - c.head_sent);
        const u8_t more = (c.head_sent + n < c.head_len || c.body_len > 0) ? TCP_WRITE_FLAG_MORE : 0;
        if (tcp_write(c.pcb, c.head + c.head_sent, static_cast<u16_t>(n), TCP_WRITE_FLAG_COPY | more) != ERR_OK) break;
        c.head_sent += n;
    }
    while (c.head_sent == c.head_len && c.body_sent < c.body_len) {
        const u16_t room = tcp_sndbuf(c.pcb);
        if (room == 0 || tcp_sndqueuelen(c.pcb) >= TCP_SND_QUEUELEN - 1) break;
        const size_t n = std::min<size_t>(std::min<size_t>(room, TCP_MSS), c.body_len - c.body_sent);
        const u8_t more = (c.body_sent + n < c.body_len) ? TCP_WRITE_FLAG_MORE : 0;
        if (tcp_write(c.pcb, c.body + c.body_sent, static_cast<u16_t>(n), more) != ERR_OK) break;
        c.body_sent += n;
    }
    tcp_output(c.pcb);
    if (c.head_sent == c.head_len && c.body_sent == c.body_len) {
        close_connection(c);
    }
}

void respond(Connection& c, const char* status, const char* content_type, const char* body,
             const char* extra_headers = "") {
    const size_t body_len = std::strlen(body);
    const int n = std::snprintf(c.head, sizeof(c.head),
                                "HTTP/1.1 %s\r\nContent-Type: %s\r\nContent-Length: %u\r\n"
                                "Cache-Control: no-store\r\nConnection: close\r\n%s\r\n",
                                status, content_type, static_cast<unsigned>(body_len), extra_headers);
    c.head_len = std::min<size_t>(static_cast<size_t>(n), sizeof(c.head) - 1);
    // Small bodies go in the same copied buffer as the headers.
    const size_t fits = std::min(body_len, sizeof(c.head) - 1 - c.head_len);
    std::memcpy(c.head + c.head_len, body, fits);
    c.head_len += fits;
    c.responded = true;
    pump(c);
}

void respond_json(Connection& c, const char* status, const char* json) {
    respond(c, status, "application/json", json);
}

void respond_page(Connection& c) {
    const int n = std::snprintf(c.head, sizeof(c.head),
                                "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n"
                                "Content-Encoding: gzip\r\nContent-Length: %u\r\n"
                                "Cache-Control: no-cache\r\nConnection: close\r\n\r\n",
                                static_cast<unsigned>(sizeof(kWebPageGzip)));
    c.head_len = static_cast<size_t>(n);
    c.body = kWebPageGzip;
    c.body_len = sizeof(kWebPageGzip);
    c.responded = true;
    pump(c);
}

void respond_redirect(Connection& c, const char* location) {
    char header[96];
    std::snprintf(header, sizeof(header), "Location: %s\r\n", location);
    respond(c, "302 Found", "text/plain", "", header);
}

// Appends `"key":"<escaped value>"` to out.
void json_field(char* out, size_t size, const char* key, const char* value, bool comma = true) {
    char escaped[200];
    http::json_escape(value, escaped, sizeof(escaped));
    const size_t used = std::strlen(out);
    std::snprintf(out + used, size - used, "%s\"%s\":\"%s\"", comma ? "," : "", key, escaped);
}

void handle_status(Connection& c) {
    WifiInfo info;
    wifi_info(info);
    char json[512] = "{";
    json_field(json, sizeof(json), "mode", wifi_mode_code(info.mode), false);
    json_field(json, sizeof(json), "ssid", info.ssid);
    json_field(json, sizeof(json), "ip", info.ip);
    json_field(json, sizeof(json), "hostname", info.hostname);
    json_field(json, sizeof(json), "ap_ssid", info.ap_ssid);
    json_field(json, sizeof(json), "last_error", wifi_error_code(info.last_error));
    json_field(json, sizeof(json), "version", PICO_PROGRAM_VERSION_STRING);
    json_field(json, sizeof(json), "preset", presets::code(preset_active()));
    std::strncat(json, "}", sizeof(json) - std::strlen(json) - 1);
    respond_json(c, "200 OK", json);
}

void handle_preset(Connection& c, const http::Request& r) {
    char code[24] = {};
    presets::Preset preset;
    if (!http::form_value(r.body, r.body_length, "preset", code, sizeof(code)) || !presets::parse(code, preset)) {
        respond_json(c, "400 Bad Request", "{\"ok\":false,\"error\":\"unknown_preset\"}");
        return;
    }
    // Restarts only when the preset changes; the restart waits for this
    // response to go out (preset_control.cpp).
    const bool restarting = preset_request(preset) || preset_switch_pending();
    char json[96];
    std::snprintf(json, sizeof(json), "{\"ok\":true,\"preset\":\"%s\",\"restarting\":%s}", presets::code(preset),
                  restarting ? "true" : "false");
    respond_json(c, "200 OK", json);
}

void handle_scan_results(Connection& c) {
    static char json[3500];
    const scan::List& list = wifi_scan_results();
    int used = std::snprintf(json, sizeof(json), "{\"scanning\":%s,\"networks\":[",
                             wifi_scan_running() ? "true" : "false");
    if (!wifi_scan_running()) {
        for (size_t i = 0; i < list.count; ++i) {
            char ssid[200];
            http::json_escape(list.networks[i].ssid, ssid, sizeof(ssid));
            char entry[260];
            const int n = std::snprintf(entry, sizeof(entry), "%s{\"ssid\":\"%s\",\"rssi\":%d,\"secure\":%s}",
                                        i > 0 ? "," : "", ssid, list.networks[i].rssi,
                                        list.networks[i].secure ? "true" : "false");
            if (used + n + 3 >= static_cast<int>(sizeof(json))) break;  // Keep the JSON valid if full.
            std::memcpy(json + used, entry, static_cast<size_t>(n));
            used += n;
        }
    }
    std::snprintf(json + used, sizeof(json) - static_cast<size_t>(used), "]}");
    respond_json(c, "200 OK", json);
}

bool body_contains(const http::Request& r, const char* text) {
    const size_t n = std::strlen(text);
    for (size_t i = 0; i + n <= r.body_length; ++i) {
        if (std::memcmp(r.body + i, text, n) == 0) return true;
    }
    return false;
}

void handle_save(Connection& c, const http::Request& r) {
    // Buffers larger than the limits, so validate() can report "too long".
    char ssid[128] = {};
    char password[128] = {};
    const bool has_ssid = http::form_value(r.body, r.body_length, "ssid", ssid, sizeof(ssid));
    const bool has_password = http::form_value(r.body, r.body_length, "password", password, sizeof(password));
    settings::Error error;
    if (!has_ssid) {
        error = body_contains(r, "ssid=") ? settings::Error::kSsidTooLong : settings::Error::kSsidRequired;
    } else if (!has_password && body_contains(r, "password=")) {
        error = settings::Error::kPasswordTooLong;  // Present but did not fit (or malformed).
    } else {
        error = settings::validate(ssid, password);  // A missing password means an open network.
    }
    char json[512];
    if (error != settings::Error::kNone) {
        std::snprintf(json, sizeof(json), "{\"ok\":false,\"error\":\"%s\"}", settings::error_code(error));
        respond_json(c, "400 Bad Request", json);
        return;
    }
    WifiInfo info;
    wifi_info(info);
    std::strcpy(json, "{\"ok\":true");
    json_field(json, sizeof(json), "ssid", ssid);
    json_field(json, sizeof(json), "hostname", info.hostname);
    std::strncat(json, "}", sizeof(json) - std::strlen(json) - 1);
    respond_json(c, "200 OK", json);
    wifi_request_save(settings::make(ssid, password));
}

bool on_hotspot(const tcp_pcb* pcb) {
    ip_addr_t ap;
    ipaddr_aton(wifi_config::kApAddress, &ap);
    return ip_addr_cmp(&pcb->local_ip, &ap);
}

void handle(Connection& c, const http::Request& r) {
    const bool get = r.method == http::Method::kGet;
    const bool post = r.method == http::Method::kPost;
    const char* path = r.path;
#ifdef LTB_NET_DEBUG
    printf("http %s %s (host %s)\n", get ? "GET" : post ? "POST" : "other", path, r.host);
#endif

    if (std::strncmp(path, "/api/", 5) == 0) {
        if (std::strcmp(path, "/api/status") == 0 && get) {
            handle_status(c);
        } else if (std::strcmp(path, "/api/scan") == 0 && get) {
            handle_scan_results(c);
        } else if (std::strcmp(path, "/api/scan") == 0 && post) {
            wifi_request_scan();
            respond_json(c, "202 Accepted", "{\"scanning\":true}");
        } else if (std::strcmp(path, "/api/wifi") == 0 && post) {
            handle_save(c, r);
        } else if (std::strcmp(path, "/api/preset") == 0 && post) {
            handle_preset(c, r);
        } else if (std::strcmp(path, "/api/wifi/forget") == 0 && post) {
            respond_json(c, "200 OK", "{\"ok\":true}");
            wifi_request_forget();
        } else {
            respond_json(c, "404 Not Found", "{\"error\":\"not_found\"}");
        }
        return;
    }

    const bool hotspot = on_hotspot(c.pcb);
    if (get && (std::strcmp(path, "/guide") == 0 || (!hotspot && std::strcmp(path, "/") == 0))) {
        respond_page(c);
    } else if (hotspot) {
        char location[48];
        std::snprintf(location, sizeof(location), "http://%s/guide", wifi_config::kApAddress);
        respond_redirect(c, location);
    } else {
        respond_redirect(c, "/");
    }
}

// --- lwIP callbacks ----------------------------------------------------------

void on_error(void* arg, err_t) {
    // lwIP has already freed the pcb.
    auto* c = static_cast<Connection*>(arg);
    if (c != nullptr) {
        c->pcb = nullptr;
        c->in_use = false;
    }
}

err_t on_sent(void* arg, tcp_pcb*, u16_t) {
    auto* c = static_cast<Connection*>(arg);
    c->idle = 0;
    pump(*c);
    return ERR_OK;
}

err_t on_poll(void* arg, tcp_pcb* pcb) {
    auto* c = static_cast<Connection*>(arg);
    if (c == nullptr) {
        tcp_abort(pcb);
        return ERR_ABRT;
    }
    if (++c->idle > kIdleLimit) {
        release(*c);
        tcp_abort(pcb);
        return ERR_ABRT;
    }
    if (c->responded) {
        pump(*c);
    }
    return ERR_OK;
}

err_t on_recv(void* arg, tcp_pcb* pcb, pbuf* p, err_t err) {
    auto* c = static_cast<Connection*>(arg);
    if (p == nullptr || err != ERR_OK) {
        if (p != nullptr) pbuf_free(p);
        if (c != nullptr && !c->responded) close_connection(*c);
        return ERR_OK;
    }
    tcp_recved(pcb, p->tot_len);
    if (c == nullptr || c->responded) {
        pbuf_free(p);  // Ignore anything after the request.
        return ERR_OK;
    }
    c->idle = 0;
    const size_t room = sizeof(c->rx) - c->rx_len;
    const size_t n = std::min<size_t>(room, p->tot_len);
    pbuf_copy_partial(p, c->rx + c->rx_len, static_cast<u16_t>(n), 0);
    c->rx_len += n;
    pbuf_free(p);

    http::Request request;
    switch (http::parse_request(c->rx, c->rx_len, request)) {
        case http::ParseResult::kIncomplete:
            if (c->rx_len == sizeof(c->rx)) {
                respond(*c, "413 Content Too Large", "text/plain", "Request too large\n");
            }
            break;
        case http::ParseResult::kComplete:
            handle(*c, request);
            break;
        case http::ParseResult::kBad:
            respond(*c, "400 Bad Request", "text/plain", "Bad request\n");
            break;
        case http::ParseResult::kTooLarge:
            respond(*c, "413 Content Too Large", "text/plain", "Request too large\n");
            break;
    }
    return ERR_OK;
}

err_t on_accept(void*, tcp_pcb* pcb, err_t err) {
    if (err != ERR_OK || pcb == nullptr) {
        return ERR_VAL;
    }
    Connection* c = nullptr;
    for (auto& slot : connections) {
        if (!slot.in_use) {
            c = &slot;
            break;
        }
    }
    if (c == nullptr) {
        tcp_abort(pcb);  // All slots busy; the browser retries.
        return ERR_ABRT;
    }
    c->in_use = true;
    c->pcb = pcb;
    c->idle = 0;
    c->responded = false;
    c->rx_len = 0;
    c->head_len = c->head_sent = 0;
    c->body = nullptr;
    c->body_len = c->body_sent = 0;
    tcp_arg(pcb, c);
    tcp_recv(pcb, on_recv);
    tcp_sent(pcb, on_sent);
    tcp_err(pcb, on_error);
    tcp_poll(pcb, on_poll, kPollInterval);
    return ERR_OK;
}

}  // namespace

void http_server_start() {
    cyw43_arch_lwip_begin();
    tcp_pcb* pcb = tcp_new_ip_type(IPADDR_TYPE_ANY);
    if (pcb == nullptr || tcp_bind(pcb, IP_ANY_TYPE, 80) != ERR_OK) {
        printf("HTTP: could not bind port 80\n");
        cyw43_arch_lwip_end();
        return;
    }
    tcp_pcb* listener = tcp_listen_with_backlog(pcb, 4);
    if (listener == nullptr) {
        tcp_close(pcb);
        printf("HTTP: could not listen on port 80\n");
    } else {
        tcp_accept(listener, on_accept);
    }
    cyw43_arch_lwip_end();
}
