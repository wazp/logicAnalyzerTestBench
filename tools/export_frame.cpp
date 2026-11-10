// Writes one preset's whole timeline frame (GP10-GP22) as JSON, exactly as the
// board plays it: the frame is built and encoded into PIO words like the
// firmware does (src/hw/timeline_output.cpp), then the words are read back
// into per-pin toggle times. Edges the encoder delayed (at most 2 cycles) are
// at their delayed time.
//
// tools/bench_check.py compares captures from a real analyzer against this.
// The output is not committed; the checker runs it on demand.
//
//   usage: export_frame <protocols|video|faults|verify> <output.json>

#include <cstdio>
#include <vector>

#include "core/faults_frame.h"
#include "core/presets.h"
#include "core/protocol_frame.h"
#include "core/timeline.h"
#include "core/verify_frame.h"
#include "core/video_frame.h"
#include "signal_config.h"

namespace {

constexpr uint32_t kSysHz = 150000000;
constexpr size_t kMaxWords = 14336;  // Same as src/hw/timeline_output.cpp.

template <typename Frame>
int write(const char* path, const char* preset, const Frame& frame, size_t pin_count) {
    static std::vector<uint32_t> words(kMaxWords);
    const timeline::Result r = timeline::encode(frame.pins, pin_count, frame.frame_cycles, words.data(), kMaxWords);
    if (!r.valid) {
        std::fprintf(stderr, "timeline: %s\n", r.error);
        return 1;
    }
    FILE* f = std::fopen(path, "w");
    if (f == nullptr) {
        std::perror(path);
        return 1;
    }
    std::fprintf(f, "{\n  \"preset\": \"%s\",\n  \"sysHz\": %u,\n  \"frameCycles\": %u,\n", preset, kSysHz,
                 frame.frame_cycles);
    std::fprintf(f, "  \"words\": %zu,\n  \"shiftedEdges\": %zu,\n", r.word_count, r.shifted_edges);
    std::fprintf(f, "  \"pins\": [");
    for (size_t p = 0; p < pin_count; ++p) {
        const bool initial = (timeline::word_levels(words[0]) >> p) & 1u;
        std::fprintf(f, "%s\n    {\"gpio\": %u, \"initial\": %d, \"toggles\": [", p == 0 ? "" : ",",
                     pins::kTimelineBase + static_cast<unsigned>(p), initial ? 1 : 0);
        bool level = initial;
        uint64_t t = 0;
        bool first = true;
        for (size_t i = 0; i < r.word_count; ++i) {
            const bool next = (timeline::word_levels(words[i]) >> p) & 1u;
            if (next != level) {
                std::fprintf(f, "%s%llu", first ? "" : ",", static_cast<unsigned long long>(t));
                first = false;
                level = next;
            }
            t += timeline::word_cycles(words[i]);
        }
        std::fprintf(f, "]}");
    }
    std::fprintf(f, "\n  ],\n  \"windows\": [");
    for (size_t i = 0; i < frame.window_count; ++i) {
        const auto& w = frame.windows[i];
        std::fprintf(f, "%s\n    {\"protocol\": \"%s\", \"label\": \"%s\", \"start\": %u, \"end\": %u}",
                     i == 0 ? "" : ",", w.protocol, w.label, w.start, w.end);
    }
    std::fprintf(f, "\n  ]\n}\n");
    std::fclose(f);
    return 0;
}

}  // namespace

int main(int argc, char** argv) {
    presets::Preset preset;
    if (argc != 3 || !presets::parse(argv[1], preset)) {
        std::fprintf(stderr, "usage: %s <protocols|video|faults|verify> <output.json>\n", argv[0]);
        return 2;
    }
    const char* error = nullptr;
    switch (preset) {
        case presets::Preset::kProtocols: {
            static std::vector<uint32_t> pool(protocol_frame::kPoolSize);
            static protocol_frame::Frame frame;
            if (!(error = protocol_frame::build(frame, config::kProtocols, kSysHz, pool.data()))) {
                return write(argv[2], argv[1], frame, protocol_frame::kPinCount);
            }
            break;
        }
        case presets::Preset::kVideo: {
            static std::vector<uint32_t> pool(video_frame::kPoolSize);
            static video_frame::Frame frame;
            if (!(error = video_frame::build(frame, config::kVideo, kSysHz, pool.data()))) {
                return write(argv[2], argv[1], frame, video_frame::kPinCount);
            }
            break;
        }
        case presets::Preset::kFaults: {
            static std::vector<uint32_t> pool(faults_frame::kPoolSize);
            static faults_frame::Frame frame;
            if (!(error = faults_frame::build(frame, config::kFaults, kSysHz, pool.data()))) {
                return write(argv[2], argv[1], frame, faults_frame::kPinCount);
            }
            break;
        }
        case presets::Preset::kVerify: {
            static std::vector<uint32_t> pool(verify_frame::kPoolSize);
            static verify_frame::Frame frame;
            if (!(error = verify_frame::build(frame, config::kVerify, kSysHz, pool.data()))) {
                return write(argv[2], argv[1], frame, verify_frame::kPinCount);
            }
            break;
        }
    }
    std::fprintf(stderr, "%s frame: %s\n", argv[1], error);
    return 1;
}
