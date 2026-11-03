#include <cstdio>

#include "test_harness.h"

int main() {
    for (const auto& t : th::registry()) {
        const int before = th::failures();
        t.fn();
        std::printf("%s %s\n", th::failures() == before ? "PASS" : "FAIL", t.name);
    }
    std::printf("%zu tests, %d failed checks\n", th::registry().size(), th::failures());
    return th::failures() == 0 ? 0 : 1;
}
