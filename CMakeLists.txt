# Logic Analyzer Test Bench firmware for the Raspberry Pi Pico 2 W (RP2350).
#
#   export PICO_SDK_PATH=~/pico/pico-sdk
#   cmake -S . -B build -G Ninja
#   cmake --build build
#
# Host unit tests are a separate project in tests/ (no SDK needed).

cmake_minimum_required(VERSION 3.13)

# Must be set before the SDK is imported.
set(PICO_BOARD pico2_w CACHE STRING "Board type")
set(PICO_PLATFORM rp2350-arm-s CACHE STRING "Platform")

include(pico_sdk_import.cmake)

project(logic_test_bench C CXX ASM)
set(CMAKE_C_STANDARD 11)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

if (PICO_SDK_VERSION_STRING VERSION_LESS "2.0.0")
    message(FATAL_ERROR "Pico SDK 2.0.0 or newer is required for RP2350 support")
endif()

pico_sdk_init()

add_executable(logic_test_bench
    src/main.cpp
    src/status.cpp
    src/core/timing.cpp
    src/hw/square_output.cpp
    src/hw/pattern_output.cpp
    src/hw/pwm_output.cpp
    src/console/serial_console.cpp
)

pico_generate_pio_header(logic_test_bench ${CMAKE_CURRENT_LIST_DIR}/src/hw/square_wave.pio)
pico_generate_pio_header(logic_test_bench ${CMAKE_CURRENT_LIST_DIR}/src/hw/pattern.pio)

target_include_directories(logic_test_bench PRIVATE ${CMAKE_CURRENT_LIST_DIR}/src)

# Warnings only for our own sources, not the SDK.
set_source_files_properties(
    src/main.cpp src/status.cpp src/core/timing.cpp src/hw/square_output.cpp
    src/hw/pattern_output.cpp src/hw/pwm_output.cpp src/console/serial_console.cpp
    PROPERTIES COMPILE_OPTIONS "-Wall;-Wextra"
)

target_link_libraries(logic_test_bench
    pico_stdlib
    hardware_pio
    hardware_pwm
    hardware_dma
    hardware_clocks
)

# USB CDC for the console. UART stdio is off because GP0/GP1 are signal pins.
pico_enable_stdio_usb(logic_test_bench 1)
pico_enable_stdio_uart(logic_test_bench 0)

pico_set_program_name(logic_test_bench "logic_test_bench")
pico_set_program_description(logic_test_bench "Programmable digital test signal generator for logic analyzers")
pico_set_program_version(logic_test_bench "0.1.0")

pico_add_extra_outputs(logic_test_bench)
