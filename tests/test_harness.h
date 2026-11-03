// Tiny dependency-free test harness for host-side unit tests.
//
//   TEST(name) { CHECK(cond); CHECK_EQ(a, b); CHECK_NEAR(a, b, tol); }
//
// Every TEST registers itself; main() in test_main.cpp runs them all and
// returns non-zero if any check failed, which is what ctest looks at.

#pragma once

#include <cmath>
#include <cstdio>
#include <vector>

namespace th {

struct TestCase {
    const char* name;
    void (*fn)();
};

inline std::vector<TestCase>& registry() {
    static std::vector<TestCase> tests;
    return tests;
}

inline int& failures() {
    static int count = 0;
    return count;
}

struct Registrar {
    Registrar(const char* name, void (*fn)()) { registry().push_back({name, fn}); }
};

inline void fail(const char* file, int line, const char* expr) {
    std::printf("  FAIL %s:%d: %s\n", file, line, expr);
    ++failures();
}

}  // namespace th

#define TEST(name)                                         \
    static void name();                                    \
    static th::Registrar name##_registrar(#name, &name);   \
    static void name()

#define CHECK(cond)                                  \
    do {                                             \
        if (!(cond)) th::fail(__FILE__, __LINE__, #cond); \
    } while (0)

#define CHECK_EQ(a, b) CHECK((a) == (b))

#define CHECK_NEAR(a, b, tol) CHECK(std::fabs(static_cast<double>(a) - static_cast<double>(b)) <= (tol))
