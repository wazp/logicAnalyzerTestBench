#include "core/verify_frame.h"

#include <cmath>

namespace verify_frame {

namespace {

// A whole number of cycles for `ns`, or 0 when it is not one.
uint32_t exact_cycles(double ns, double sys_hz) {
    const double cycles = ns * sys_hz / 1e9;
    const double rounded = std::round(cycles);
    return std::fabs(cycles - rounded) < 1e-6 ? static_cast<uint32_t>(rounded) : 0;
}

}  // namespace

const char* build(Frame& f, const config::VerifyConfig& c, uint32_t sys_hz, uint32_t* pool) {
    if (c.counter_bits != kCounterPins) return "the counter must have 12 bits, one per pin from GP10 to GP21";
    const double hz = static_cast<double>(sys_hz);
    const uint32_t step = exact_cycles(c.counter_step_ns, hz);
    if (step == 0) return "the counter step must be a whole number of cycles";
    const uint64_t frame = uint64_t{step} << kCounterPins;  // One full count.
    if (frame >= (uint64_t{1} << 32)) return "the counter frame is too long";
    f.frame_cycles = static_cast<uint32_t>(frame);
    f.window_count = 0;

    size_t used = 0;
    for (unsigned b = 0; b < kCounterPins; ++b) {
        f.pins[b].init(pool + used, counter_capacity(b), false);
        used += counter_capacity(b);
    }
    f.pins[kBurstPin].init(pool + used, kBurstCapacity, false);

    // --- Counter: the count is k during step k; bit n toggles every 2^n steps ---
    for (uint32_t k = 1; k < (1u << kCounterPins); ++k) {
        const double at = static_cast<double>(k) * step;
        for (unsigned b = 0; b < kCounterPins; ++b) {
            f.pins[b].set(at, (k >> b) & 1u);
        }
    }

    // --- Bursts: whole periods, each starting on a counter step ---
    double next = static_cast<double>(exact_cycles(c.burst_first_us * 1000.0, hz));
    if (next == 0 || static_cast<uint32_t>(next) % step != 0) return "the first burst must start on a counter step";
    for (unsigned i = 0; i < kBurstCount; ++i) {
        const uint32_t half = exact_cycles(1e9 / c.burst_hz[i] / 2.0, hz);
        if (half == 0) return "every burst half period must be a whole number of cycles";
        if (half < 3) return "a burst is faster than the timeline's 3-cycle minimum";
        if (step % half != 0) return "every burst half period must divide the counter step";
        const double start = next;
        for (unsigned p = 0; p < c.burst_periods; ++p) {
            f.pins[kBurstPin].set(start + 2.0 * half * p, true);
            f.pins[kBurstPin].set(start + 2.0 * half * p + half, false);
        }
        const double end = start + 2.0 * half * c.burst_periods;
        f.windows[f.window_count++] = {"burst", "burst", static_cast<uint32_t>(start), static_cast<uint32_t>(end)};
        // The next burst starts on the first counter step after the gap.
        const double earliest = end + c.burst_gap_us * hz / 1e6;
        next = std::ceil(earliest / step) * step;
    }

    for (unsigned p = 0; p < kPinCount; ++p) {
        const wave::PinWave& w = f.pins[p];
        if (w.overflow) return "a verify pin needs more edges than its capacity";
        if (w.out_of_order) return "edges out of order on a verify pin";
        // The counter wraps from all ones to zero where the frame loops, so only the burst pin must end idle.
        if (p == kBurstPin && w.level != w.initial) return "the burst pin does not end the frame low";
        if (w.count > 0 && w.last >= f.frame_cycles) return "the bursts run past the end of the frame";
    }
    return nullptr;
}

}  // namespace verify_frame
