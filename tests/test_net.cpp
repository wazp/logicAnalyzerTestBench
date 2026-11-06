// Unit tests for the web server's request parsing (src/core/http_request.cpp),
// the saved Wi-Fi settings (src/core/settings.cpp) and the scan list
// (src/core/scan_list.cpp).

#include <cstdint>
#include <cstring>
#include <string>

#include "core/http_request.h"
#include "core/scan_list.h"
#include "core/settings.h"
#include "test_harness.h"

namespace {

http::ParseResult parse(const std::string& s, http::Request& r) { return http::parse_request(s.data(), s.size(), r); }

void add(scan::List& list, const char* ssid, int16_t rssi, bool secure = true) {
    scan::add(list, reinterpret_cast<const uint8_t*>(ssid), std::strlen(ssid), rssi, secure);
}

}  // namespace

// --- Request parsing -------------------------------------------------------

TEST(http_parses_get_with_host_and_query) {
    http::Request r;
    CHECK(parse("GET /guide?x=1 HTTP/1.1\r\nHost: 4.3.2.1\r\nUser-Agent: t\r\n\r\n", r) ==
          http::ParseResult::kComplete);
    CHECK(r.method == http::Method::kGet);
    CHECK_EQ(std::string(r.path), "/guide");
    CHECK_EQ(std::string(r.host), "4.3.2.1");
    CHECK_EQ(r.body_length, 0u);
}

TEST(http_header_names_are_case_insensitive) {
    http::Request r;
    CHECK(parse("POST /api/wifi HTTP/1.1\r\nhOsT:testbench.local\r\ncontent-LENGTH: 3\r\n\r\nabc", r) ==
          http::ParseResult::kComplete);
    CHECK(r.method == http::Method::kPost);
    CHECK_EQ(std::string(r.host), "testbench.local");
    CHECK_EQ(std::string(r.body, r.body_length), "abc");
}

TEST(http_waits_for_headers_and_body) {
    http::Request r;
    CHECK(parse("GET / HTTP/1.1\r\nHost: a\r\n", r) == http::ParseResult::kIncomplete);
    CHECK(parse("POST /x HTTP/1.1\r\nContent-Length: 10\r\n\r\nabc", r) == http::ParseResult::kIncomplete);
}

TEST(http_rejects_bad_and_oversized_requests) {
    http::Request r;
    CHECK(parse("GARBAGE\r\n\r\n", r) == http::ParseResult::kBad);
    CHECK(parse("GET nopath HTTP/1.1\r\n\r\n", r) == http::ParseResult::kBad);
    CHECK(parse("GET / HTTP/1.1\r\nNoColonHere\r\n\r\n", r) == http::ParseResult::kBad);
    CHECK(parse("POST / HTTP/1.1\r\nContent-Length: 12x\r\n\r\n", r) == http::ParseResult::kBad);
    CHECK(parse("POST / HTTP/1.1\r\nContent-Length: 999999\r\n\r\n", r) == http::ParseResult::kTooLarge);
    const std::string huge = "GET / HTTP/1.1\r\nX: " + std::string(http::kMaxRequestSize, 'a');
    CHECK(parse(huge, r) == http::ParseResult::kTooLarge);
    const std::string long_path = "GET /" + std::string(200, 'p') + " HTTP/1.1\r\n\r\n";
    CHECK(parse(long_path, r) == http::ParseResult::kTooLarge);
}

TEST(http_other_methods_are_recognized_as_other) {
    http::Request r;
    CHECK(parse("DELETE /api/wifi HTTP/1.1\r\n\r\n", r) == http::ParseResult::kComplete);
    CHECK(r.method == http::Method::kOther);
}

// --- Form decoding ---------------------------------------------------------

TEST(form_decodes_plus_and_percent) {
    const std::string body = "ssid=My+Net%21&password=p%26ss%3Dw0rd";
    char out[64];
    CHECK(http::form_value(body.data(), body.size(), "ssid", out, sizeof(out)));
    CHECK_EQ(std::string(out), "My Net!");
    CHECK(http::form_value(body.data(), body.size(), "password", out, sizeof(out)));
    CHECK_EQ(std::string(out), "p&ss=w0rd");
}

TEST(form_handles_missing_empty_and_prefix_keys) {
    const std::string body = "ssidx=no&ssid=&pw";
    char out[16];
    CHECK(http::form_value(body.data(), body.size(), "ssid", out, sizeof(out)));
    CHECK_EQ(std::string(out), "");
    CHECK(http::form_value(body.data(), body.size(), "pw", out, sizeof(out)));
    CHECK_EQ(std::string(out), "");
    CHECK(!http::form_value(body.data(), body.size(), "password", out, sizeof(out)));
}

TEST(form_rejects_bad_escapes_and_overflow) {
    char out[4];
    const std::string bad = "a=%zz";
    CHECK(!http::form_value(bad.data(), bad.size(), "a", out, sizeof(out)));
    const std::string cut = "a=%4";
    CHECK(!http::form_value(cut.data(), cut.size(), "a", out, sizeof(out)));
    const std::string longer = "a=abcd";
    CHECK(!http::form_value(longer.data(), longer.size(), "a", out, sizeof(out)));
}

// --- JSON escaping ---------------------------------------------------------

TEST(json_escapes_quotes_backslashes_and_controls) {
    char out[64];
    CHECK(http::json_escape("a\"b\\c\n\x01", out, sizeof(out)));
    CHECK_EQ(std::string(out), "a\\\"b\\\\c\\u000a\\u0001");
}

TEST(json_escape_reports_overflow_and_stays_terminated) {
    char out[5];
    CHECK(!http::json_escape("abcdef", out, sizeof(out)));
    CHECK_EQ(std::string(out), "abcd");
}

// --- Settings --------------------------------------------------------------

TEST(settings_validation_matches_wpa2_limits) {
    CHECK(settings::validate("", "") == settings::Error::kSsidRequired);
    CHECK(settings::validate(std::string(33, 's').c_str(), "") == settings::Error::kSsidTooLong);
    CHECK(settings::validate("net", "short") == settings::Error::kPasswordTooShort);
    CHECK(settings::validate("net", std::string(64, 'p').c_str()) == settings::Error::kPasswordTooLong);
    CHECK(settings::validate("net", "") == settings::Error::kNone);  // Open network.
    CHECK(settings::validate(std::string(32, 's').c_str(), std::string(63, 'p').c_str()) == settings::Error::kNone);
    CHECK_EQ(std::string(settings::error_code(settings::Error::kPasswordTooShort)), "password_too_short");
}

settings::Settings with_network(const char* ssid, const char* password,
                                presets::Preset preset = presets::kDefault) {
    settings::Settings s;
    s.wifi = settings::make(ssid, password);
    s.preset = preset;
    return s;
}

TEST(settings_round_trip) {
    uint8_t blob[settings::kBlobSize];
    settings::serialize(with_network("RogueTwo", "correct horse battery", presets::Preset::kVideo), blob);
    settings::Settings s;
    CHECK(settings::parse(blob, sizeof(blob), s));
    CHECK_EQ(std::string(s.wifi.ssid), "RogueTwo");
    CHECK_EQ(std::string(s.wifi.password), "correct horse battery");
    CHECK(s.preset == presets::Preset::kVideo);

    settings::serialize(with_network(std::string(32, 'x').c_str(), std::string(63, 'y').c_str()), blob);
    CHECK(settings::parse(blob, sizeof(blob), s));
    CHECK_EQ(std::string(s.wifi.ssid), std::string(32, 'x'));
    CHECK_EQ(std::string(s.wifi.password), std::string(63, 'y'));
    CHECK(s.preset == presets::Preset::kProtocols);
}

TEST(settings_hold_a_preset_without_a_network) {
    uint8_t blob[settings::kBlobSize];
    settings::Settings saved;
    saved.preset = presets::Preset::kVideo;
    settings::serialize(saved, blob);
    settings::Settings s;
    CHECK(settings::parse(blob, sizeof(blob), s));
    CHECK(!settings::has_network(s));
    CHECK(s.preset == presets::Preset::kVideo);
}

// Firmware 0.4.0 and older wrote layout version 1, without the preset byte.
// Updating must keep the saved network.
TEST(settings_load_version_1_with_the_default_preset) {
    uint8_t blob[settings::kBlobSize] = {};
    const uint8_t header[8] = {'L', 'T', 'B', 'W', 1, 0, 0, 0};
    std::memcpy(blob, header, sizeof(header));
    std::memcpy(blob + 8, "RogueTwo", 8);
    std::memcpy(blob + 41, "password1", 9);
    const uint32_t crc = settings::crc32(blob, settings::kBlobSize - 4);
    for (int i = 0; i < 4; ++i) blob[settings::kBlobSize - 4 + i] = static_cast<uint8_t>(crc >> (8 * i));
    settings::Settings s;
    s.preset = presets::Preset::kVideo;
    CHECK(settings::parse(blob, sizeof(blob), s));
    CHECK_EQ(std::string(s.wifi.ssid), "RogueTwo");
    CHECK_EQ(std::string(s.wifi.password), "password1");
    CHECK(s.preset == presets::Preset::kProtocols);

    // Version 1 always held a network, so an empty one there is corruption.
    std::memset(blob + 8, 0, 33);
    const uint32_t crc2 = settings::crc32(blob, settings::kBlobSize - 4);
    for (int i = 0; i < 4; ++i) blob[settings::kBlobSize - 4 + i] = static_cast<uint8_t>(crc2 >> (8 * i));
    CHECK(!settings::parse(blob, sizeof(blob), s));
}

TEST(settings_unknown_preset_loads_as_the_default) {
    uint8_t blob[settings::kBlobSize];
    settings::serialize(with_network("net", "password1", presets::Preset::kVideo), blob);
    blob[105] = 200;  // A preset from some future firmware.
    const uint32_t crc = settings::crc32(blob, settings::kBlobSize - 4);
    for (int i = 0; i < 4; ++i) blob[settings::kBlobSize - 4 + i] = static_cast<uint8_t>(crc >> (8 * i));
    settings::Settings s;
    CHECK(settings::parse(blob, sizeof(blob), s));
    CHECK(s.preset == presets::kDefault);
    CHECK_EQ(std::string(s.wifi.ssid), "net");
}

TEST(settings_reject_erased_flash_and_corruption) {
    uint8_t blob[settings::kBlobSize];
    settings::Settings s;
    std::memset(blob, 0xFF, sizeof(blob));
    CHECK(!settings::parse(blob, sizeof(blob), s));

    settings::serialize(with_network("net", "password1"), blob);
    blob[10] ^= 1;
    CHECK(!settings::parse(blob, sizeof(blob), s));
    CHECK(!settings::parse(blob, 100, s));
}

TEST(presets_codes_round_trip) {
    for (presets::Preset p : presets::kAll) {
        presets::Preset back = presets::kDefault;
        CHECK(presets::parse(presets::code(p), back));
        CHECK(back == p);
    }
    presets::Preset p;
    CHECK(!presets::parse("vga", p));
    CHECK(!presets::from_number(presets::kCount, p));
}

TEST(settings_crc32_matches_reference) {
    const char* text = "123456789";
    CHECK_EQ(settings::crc32(reinterpret_cast<const uint8_t*>(text), 9), 0xCBF43926u);
}

// --- Scan list -------------------------------------------------------------

TEST(scan_dedupes_by_name_keeping_strongest) {
    scan::List list;
    add(list, "Home", -70);
    add(list, "Home", -40);
    add(list, "Home", -80);
    add(list, "Cafe", -60, false);
    add(list, "", -10);  // Hidden network, skipped.
    scan::sort(list);
    CHECK_EQ(list.count, 2u);
    CHECK_EQ(std::string(list.networks[0].ssid), "Home");
    CHECK_EQ(list.networks[0].rssi, -40);
    CHECK(!list.networks[1].secure);
}

TEST(scan_full_list_keeps_the_strongest) {
    scan::List list;
    for (size_t i = 0; i < scan::kMaxNetworks; ++i) {
        const std::string name = "n" + std::to_string(i);
        add(list, name.c_str(), static_cast<int16_t>(-90 + static_cast<int>(i)));
    }
    add(list, "weak", -95);
    add(list, "strong", -20);
    scan::sort(list);
    CHECK_EQ(list.count, scan::kMaxNetworks);
    CHECK_EQ(std::string(list.networks[0].ssid), "strong");
    for (size_t i = 0; i < list.count; ++i) {
        CHECK(std::string(list.networks[i].ssid) != "weak");
        CHECK(std::string(list.networks[i].ssid) != "n0");  // The weakest original was replaced.
    }
}
