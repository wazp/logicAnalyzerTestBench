#include "status.h"

#include "pico/stdlib.h"

namespace {
constexpr size_t kMaxEntries = 32;
SignalStatus entries[kMaxEntries];
size_t entry_count = 0;
}  // namespace

void status_add(const SignalStatus& s) {
    hard_assert(entry_count < kMaxEntries);
    entries[entry_count++] = s;
}

size_t status_count() { return entry_count; }

const SignalStatus& status_get(size_t index) { return entries[index]; }
