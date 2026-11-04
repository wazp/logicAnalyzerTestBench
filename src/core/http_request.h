// Minimal HTTP/1.x request parsing for the firmware's web server
// (src/net/http_server.cpp), plus the two encoders it needs: decoding
// URL-encoded form fields and escaping JSON strings.
//
// SDK-free so it can be unit tested on the host. Works on a caller-owned
// buffer that grows as TCP segments arrive: call parse_request() after every
// segment until it stops returning kIncomplete.

#pragma once

#include <cstddef>

namespace http {

enum class Method { kOther, kGet, kPost };

// Requests larger than this (headers plus body) are rejected. Our own API
// requests are a few hundred bytes; browsers send up to about 1 KB of headers.
constexpr size_t kMaxRequestSize = 2048;

struct Request {
    Method method = Method::kOther;
    char path[96] = {};       // Without the query string, e.g. "/api/status".
    char host[64] = {};       // Host header, empty if absent.
    size_t content_length = 0;
    const char* body = nullptr;  // Points into the parsed buffer.
    size_t body_length = 0;
};

enum class ParseResult {
    kIncomplete,  // Need more bytes.
    kComplete,    // Headers and the full body are in the buffer.
    kBad,         // Malformed request line or headers.
    kTooLarge,    // Exceeds kMaxRequestSize or a field buffer.
};

// Parses buf[0, len). On kComplete, out is filled in and out.body points into
// buf. The buffer does not need to be NUL terminated.
ParseResult parse_request(const char* buf, size_t len, Request& out);

// Finds `key` in an application/x-www-form-urlencoded body and writes its
// decoded value ('+' is a space, %XX a byte) NUL terminated into out.
// Returns false if the key is missing, malformed, or the value does not fit.
bool form_value(const char* body, size_t len, const char* key, char* out, size_t out_size);

// Writes `in` as JSON string content (no surrounding quotes) into out, NUL
// terminated. Returns false if it does not fit; out is then truncated safely.
bool json_escape(const char* in, char* out, size_t out_size);

}  // namespace http
