// Signal presets: what the 13 timeline pins (GP10-GP22) play. GP0-GP9 and the
// GP26 button never change. The preset is saved with the Wi-Fi settings
// (src/core/settings.h) and chosen at boot; switching restarts the board so
// every signal starts in sync again (src/preset_control.h).
//
// SDK-free so tests, the exporters and the firmware share it.

#pragma once

#include <cstdint>
#include <cstring>

namespace presets {

// Stored in flash as this number, so never renumber.
enum class Preset : uint8_t {
    kProtocols = 0,  // UART, I²C, SPI, WS2812, 1-Wire, IR, quadrature (src/core/protocol_frame.h)
    kVideo = 1,      // VGA, NES controller, PS/2 keyboard (src/core/video_frame.h)
};

constexpr unsigned kCount = 2;
constexpr Preset kDefault = Preset::kProtocols;
constexpr Preset kAll[kCount] = {Preset::kProtocols, Preset::kVideo};

// Stable code for the web API, the console and the guide's JSON.
inline const char* code(Preset p) {
    switch (p) {
        case Preset::kProtocols: return "protocols";
        case Preset::kVideo: return "video";
    }
    return "protocols";
}

inline const char* title(Preset p) {
    switch (p) {
        case Preset::kProtocols: return "Protocols";
        case Preset::kVideo: return "Video and input";
    }
    return "Protocols";
}

inline bool from_number(uint8_t n, Preset& out) {
    if (n >= kCount) return false;
    out = static_cast<Preset>(n);
    return true;
}

inline bool parse(const char* text, Preset& out) {
    for (Preset p : kAll) {
        if (std::strcmp(text, code(p)) == 0) {
            out = p;
            return true;
        }
    }
    return false;
}

}  // namespace presets
