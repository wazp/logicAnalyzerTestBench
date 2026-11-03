# Host-side unit tests for the pure timing code in src/core.
# Builds with the normal host compiler, no Pico SDK needed:
#   cmake -S tests -B build-tests && cmake --build build-tests && ctest --test-dir build-tests

cmake_minimum_required(VERSION 3.13)
project(logic_test_bench_tests CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

enable_testing()

add_executable(timing_tests
    test_main.cpp
    test_timing.cpp
    test_config.cpp
    ${CMAKE_CURRENT_LIST_DIR}/../src/core/timing.cpp
)
target_include_directories(timing_tests PRIVATE ${CMAKE_CURRENT_LIST_DIR}/../src)
target_compile_options(timing_tests PRIVATE -Wall -Wextra -Werror)

add_test(NAME timing_tests COMMAND timing_tests)
