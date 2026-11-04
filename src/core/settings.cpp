#include "core/settings.h"

#include <cstring>

namespace settings {

namespace {

constexpr uint32_t kMagic = 0x5742544C;  // "LTBW" read as little endian bytes.
constexpr uint32_t kVersion = 1;
constexpr size_t kSsidOffset = 8;
constexpr size_t kPasswordOffset = kSsidOffset + kMaxSsid + 1;
constexpr size_t kCrcOffset = kBlobSize - 4;
static_assert(kPasswordOffset + kMaxPassword + 1 <= kCrcOffset, "settings blob layout overlaps the CRC");

void put_u32(uint8_t* p, uint32_t v) {
    for (int i = 0; i < 4; ++i) {
        p[i] = static_cast<uint8_t>(v >> (8 * i));
    }
}

uint32_t get_u32(const uint8_t* p) {
    return static_cast<uint32_t>(p[0]) | static_cast<uint32_t>(p[1]) << 8 | static_cast<uint32_t>(p[2]) << 16 |
           static_cast<uint32_t>(p[3]) << 24;
}

// Copies a NUL padded field, requiring a terminator inside it.
bool read_string(const uint8_t* field, size_t size, char* out) {
    const void* nul = std::memchr(field, 0, size);
    if (nul == nullptr) {
        return false;
    }
    std::memcpy(out, field, static_cast<const uint8_t*>(nul) - field + 1);
    return true;
}

}  // namespace

Error validate(const char* ssid, const char* password) {
    const size_t ssid_len = std::strlen(ssid);
    const size_t password_len = std::strlen(password);
    if (ssid_len == 0) return Error::kSsidRequired;
    if (ssid_len > kMaxSsid) return Error::kSsidTooLong;
    if (password_len > 0 && password_len < kMinPassword) return Error::kPasswordTooShort;
    if (password_len > kMaxPassword) return Error::kPasswordTooLong;
    return Error::kNone;
}

const char* error_code(Error error) {
    switch (error) {
        case Error::kNone: return "";
        case Error::kSsidRequired: return "ssid_required";
        case Error::kSsidTooLong: return "ssid_too_long";
        case Error::kPasswordTooShort: return "password_too_short";
        case Error::kPasswordTooLong: return "password_too_long";
    }
    return "invalid";
}

WifiSettings make(const char* ssid, const char* password) {
    WifiSettings s;
    std::strncpy(s.ssid, ssid, kMaxSsid);
    std::strncpy(s.password, password, kMaxPassword);
    return s;
}

void serialize(const WifiSettings& s, uint8_t (&blob)[kBlobSize]) {
    std::memset(blob, 0, sizeof(blob));
    put_u32(blob, kMagic);
    put_u32(blob + 4, kVersion);
    std::memcpy(blob + kSsidOffset, s.ssid, std::strlen(s.ssid));
    std::memcpy(blob + kPasswordOffset, s.password, std::strlen(s.password));
    put_u32(blob + kCrcOffset, crc32(blob, kCrcOffset));
}

bool parse(const uint8_t* blob, size_t len, WifiSettings& out) {
    if (len < kBlobSize || get_u32(blob) != kMagic || get_u32(blob + 4) != kVersion) {
        return false;
    }
    if (get_u32(blob + kCrcOffset) != crc32(blob, kCrcOffset)) {
        return false;
    }
    WifiSettings s;
    if (!read_string(blob + kSsidOffset, kMaxSsid + 1, s.ssid) ||
        !read_string(blob + kPasswordOffset, kMaxPassword + 1, s.password)) {
        return false;
    }
    if (validate(s.ssid, s.password) != Error::kNone) {
        return false;
    }
    out = s;
    return true;
}

uint32_t crc32(const uint8_t* data, size_t len) {
    // Standard CRC-32 (IEEE 802.3, reflected), bitwise: small and fast enough
    // for 252 bytes once per boot.
    uint32_t crc = 0xFFFFFFFFu;
    for (size_t i = 0; i < len; ++i) {
        crc ^= data[i];
        for (int b = 0; b < 8; ++b) {
            crc = (crc >> 1) ^ (0xEDB88320u & (0u - (crc & 1u)));
        }
    }
    return ~crc;
}

}  // namespace settings
