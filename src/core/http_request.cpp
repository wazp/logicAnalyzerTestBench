#include "core/http_request.h"

#include <cstdio>
#include <cstring>

namespace http {

namespace {

char lower(char c) { return (c >= 'A' && c <= 'Z') ? static_cast<char>(c - 'A' + 'a') : c; }

bool equals_ignore_case(const char* a, size_t a_len, const char* b) {
    const size_t b_len = std::strlen(b);
    if (a_len != b_len) {
        return false;
    }
    for (size_t i = 0; i < a_len; ++i) {
        if (lower(a[i]) != lower(b[i])) {
            return false;
        }
    }
    return true;
}

// Finds "\r\n\r\n" in buf[0, len); returns the index just past it, or 0.
size_t header_end(const char* buf, size_t len) {
    for (size_t i = 3; i < len; ++i) {
        if (buf[i - 3] == '\r' && buf[i - 2] == '\n' && buf[i - 1] == '\r' && buf[i] == '\n') {
            return i + 1;
        }
    }
    return 0;
}

bool copy_field(const char* src, size_t len, char* dst, size_t dst_size) {
    if (len >= dst_size) {
        return false;
    }
    std::memcpy(dst, src, len);
    dst[len] = '\0';
    return true;
}

int hex_value(char c) {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    return -1;
}

}  // namespace

ParseResult parse_request(const char* buf, size_t len, Request& out) {
    out = Request{};
    const size_t headers_size = header_end(buf, len);
    if (headers_size == 0) {
        return len >= kMaxRequestSize ? ParseResult::kTooLarge : ParseResult::kIncomplete;
    }

    // Request line: METHOD SP target SP version CRLF
    const char* line_end = static_cast<const char*>(std::memchr(buf, '\r', headers_size));
    const char* sp1 = static_cast<const char*>(std::memchr(buf, ' ', line_end - buf));
    if (sp1 == nullptr) {
        return ParseResult::kBad;
    }
    const char* target = sp1 + 1;
    const char* sp2 = static_cast<const char*>(std::memchr(target, ' ', line_end - target));
    if (sp2 == nullptr || target == sp2 || *target != '/') {
        return ParseResult::kBad;
    }
    if (equals_ignore_case(buf, sp1 - buf, "GET")) {
        out.method = Method::kGet;
    } else if (equals_ignore_case(buf, sp1 - buf, "POST")) {
        out.method = Method::kPost;
    }
    const char* query = static_cast<const char*>(std::memchr(target, '?', sp2 - target));
    const char* path_end = query != nullptr ? query : sp2;
    if (!copy_field(target, path_end - target, out.path, sizeof(out.path))) {
        return ParseResult::kTooLarge;
    }

    // Headers: Name: value CRLF, until the empty line.
    const char* p = line_end + 2;
    const char* end = buf + headers_size - 2;
    while (p < end) {
        const char* eol = static_cast<const char*>(std::memchr(p, '\r', end - p + 1));
        const char* colon = static_cast<const char*>(std::memchr(p, ':', eol - p));
        if (colon == nullptr) {
            return ParseResult::kBad;
        }
        const char* value = colon + 1;
        while (value < eol && (*value == ' ' || *value == '\t')) {
            ++value;
        }
        const size_t value_len = eol - value;
        if (equals_ignore_case(p, colon - p, "host")) {
            if (!copy_field(value, value_len, out.host, sizeof(out.host))) {
                return ParseResult::kTooLarge;
            }
        } else if (equals_ignore_case(p, colon - p, "content-length")) {
            size_t n = 0;
            if (value_len == 0) {
                return ParseResult::kBad;
            }
            for (const char* d = value; d < eol; ++d) {
                if (*d < '0' || *d > '9' || n > kMaxRequestSize) {
                    return *d < '0' || *d > '9' ? ParseResult::kBad : ParseResult::kTooLarge;
                }
                n = n * 10 + static_cast<size_t>(*d - '0');
            }
            out.content_length = n;
        }
        p = eol + 2;
    }

    if (headers_size + out.content_length > kMaxRequestSize) {
        return ParseResult::kTooLarge;
    }
    if (len < headers_size + out.content_length) {
        return ParseResult::kIncomplete;
    }
    out.body = buf + headers_size;
    out.body_length = out.content_length;
    return ParseResult::kComplete;
}

bool form_value(const char* body, size_t len, const char* key, char* out, size_t out_size) {
    if (out_size == 0) {
        return false;
    }
    const size_t key_len = std::strlen(key);
    size_t pos = 0;
    while (pos < len) {
        const char* pair = body + pos;
        const char* amp = static_cast<const char*>(std::memchr(pair, '&', len - pos));
        const size_t pair_len = amp != nullptr ? static_cast<size_t>(amp - pair) : len - pos;
        if (pair_len > key_len && std::memcmp(pair, key, key_len) == 0 && pair[key_len] == '=') {
            size_t o = 0;
            for (size_t i = key_len + 1; i < pair_len; ++i) {
                char c = pair[i];
                if (c == '+') {
                    c = ' ';
                } else if (c == '%') {
                    if (i + 2 >= pair_len) {
                        return false;
                    }
                    const int hi = hex_value(pair[i + 1]);
                    const int lo = hex_value(pair[i + 2]);
                    if (hi < 0 || lo < 0) {
                        return false;
                    }
                    c = static_cast<char>(hi * 16 + lo);
                    i += 2;
                }
                if (o + 1 >= out_size) {
                    return false;
                }
                out[o++] = c;
            }
            out[o] = '\0';
            return true;
        }
        if (pair_len == key_len && std::memcmp(pair, key, key_len) == 0) {
            out[0] = '\0';  // "key" with no '=' counts as empty.
            return true;
        }
        pos += pair_len + 1;
    }
    return false;
}

bool json_escape(const char* in, char* out, size_t out_size) {
    if (out_size == 0) {
        return false;
    }
    size_t o = 0;
    for (const char* p = in; *p != '\0'; ++p) {
        const unsigned char c = static_cast<unsigned char>(*p);
        char esc[7];
        size_t n;
        if (c == '"' || c == '\\') {
            esc[0] = '\\';
            esc[1] = static_cast<char>(c);
            n = 2;
        } else if (c < 0x20) {
            n = static_cast<size_t>(std::snprintf(esc, sizeof(esc), "\\u%04x", c));
        } else {
            esc[0] = static_cast<char>(c);
            n = 1;
        }
        if (o + n >= out_size) {
            out[o] = '\0';
            return false;
        }
        std::memcpy(out + o, esc, n);
        o += n;
    }
    out[o] = '\0';
    return true;
}

}  // namespace http
