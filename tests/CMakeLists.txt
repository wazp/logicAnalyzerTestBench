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

# Exports the default signals as JSON for the web guide. The check below fails
# when web/src/data/signals.json no longer matches the C++ config; fix it with
#   ./build-tests/export_signals web/src/data/signals.json
add_executable(export_signals
    ${CMAKE_CURRENT_LIST_DIR}/../tools/export_signals.cpp
    ${CMAKE_CURRENT_LIST_DIR}/../src/core/timing.cpp
)
target_include_directories(export_signals PRIVATE ${CMAKE_CURRENT_LIST_DIR}/../src)
target_compile_options(export_signals PRIVATE -Wall -Wextra -Werror)

set(SIGNALS_JSON ${CMAKE_CURRENT_LIST_DIR}/../web/src/data/signals.json)
add_test(NAME signals_json_export COMMAND export_signals ${CMAKE_CURRENT_BINARY_DIR}/signals.json)
add_test(NAME signals_json_up_to_date
    COMMAND ${CMAKE_COMMAND} -E compare_files ${CMAKE_CURRENT_BINARY_DIR}/signals.json ${SIGNALS_JSON})
set_tests_properties(signals_json_up_to_date PROPERTIES DEPENDS signals_json_export)
