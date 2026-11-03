# Logic Analyzer Test Bench firmware for the Raspberry Pi Pico 2 W (RP2350).
#
#   export PICO_SDK_PATH=~/pico/pico-sdk
#   cmake -S . -B build -G Ninja
#   cmake --build build
#
# Host unit tests are a separate project in tests/ (no SDK needed).
#
# The build also builds the web guide in web/ (needs Node.js and npm) and
# embeds it in the firmware. Pass -DLTB_BUILD_WEB=OFF to embed an existing
# web/dist/index.html without running npm.

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

option(LTB_BUILD_WEB "Build the web guide with npm as part of the firmware build" ON)

add_executable(logic_test_bench
    src/main.cpp
    src/net/wifi_ap.cpp
    third_party/pico-examples/dhcpserver/dhcpserver.c
    third_party/pico-examples/dnsserver/dnsserver.c
    src/status.cpp
    src/core/timing.cpp
    src/hw/square_output.cpp
    src/hw/pattern_output.cpp
    src/hw/pwm_output.cpp
    src/console/serial_console.cpp
)

pico_generate_pio_header(logic_test_bench ${CMAKE_CURRENT_LIST_DIR}/src/hw/square_wave.pio)
pico_generate_pio_header(logic_test_bench ${CMAKE_CURRENT_LIST_DIR}/src/hw/pattern.pio)

target_include_directories(logic_test_bench PRIVATE
    ${CMAKE_CURRENT_LIST_DIR}/src
    ${CMAKE_CURRENT_LIST_DIR}/src/net  # lwipopts.h
    ${CMAKE_CURRENT_LIST_DIR}/third_party/pico-examples/dhcpserver
    ${CMAKE_CURRENT_LIST_DIR}/third_party/pico-examples/dnsserver
)

# Warnings only for our own sources, not the SDK.
set_source_files_properties(
    src/main.cpp src/status.cpp src/core/timing.cpp src/hw/square_output.cpp
    src/hw/pattern_output.cpp src/hw/pwm_output.cpp src/console/serial_console.cpp src/net/wifi_ap.cpp
    PROPERTIES COMPILE_OPTIONS "-Wall;-Wextra"
)

target_link_libraries(logic_test_bench
    pico_stdlib
    pico_unique_id
    hardware_pio
    hardware_pwm
    hardware_dma
    hardware_clocks
    pico_cyw43_arch_lwip_threadsafe_background  # Wi-Fi + lwIP, serviced in the background by interrupts
    pico_lwip_http
)

# Access point address. Must match kApAddress in src/net/wifi_config.h.
set(LTB_AP_ADDRESS 192.168.4.1)
pico_configure_ip4_address(logic_test_bench PRIVATE CYW43_DEFAULT_IP_AP_ADDRESS ${LTB_AP_ADDRESS})

# --- Web guide, embedded in flash ---
set(WEB_DIR ${CMAKE_CURRENT_LIST_DIR}/web)
set(WEB_DIST ${WEB_DIR}/dist/index.html)
if (LTB_BUILD_WEB)
    find_program(NPM_EXECUTABLE npm REQUIRED)
    if (NOT EXISTS ${WEB_DIR}/node_modules)
        message(STATUS "Installing web guide dependencies (npm ci)")
        execute_process(COMMAND ${NPM_EXECUTABLE} ci WORKING_DIRECTORY ${WEB_DIR} COMMAND_ERROR_IS_FATAL ANY)
    endif()
    file(GLOB_RECURSE WEB_SOURCES CONFIGURE_DEPENDS ${WEB_DIR}/src/*)
    add_custom_command(
        OUTPUT ${WEB_DIST}
        COMMAND ${NPM_EXECUTABLE} run build
        WORKING_DIRECTORY ${WEB_DIR}
        DEPENDS ${WEB_SOURCES} ${WEB_DIR}/index.html ${WEB_DIR}/package.json ${WEB_DIR}/vite.config.ts
        COMMENT "Building web guide"
        VERBATIM)
elseif (NOT EXISTS ${WEB_DIST})
    message(FATAL_ERROR "LTB_BUILD_WEB is OFF but ${WEB_DIST} does not exist. Run 'npm ci && npm run build' in web/.")
endif()

# Compress the page and turn it into lwIP flash data (pico_fsdata.inc,
# included through HTTPD_FSDATA_FILE in src/net/lwipopts.h).
set(WEB_CONTENT_DIR ${CMAKE_CURRENT_BINARY_DIR}/web_content)
find_package(Python3 REQUIRED COMPONENTS Interpreter)
add_custom_command(
    OUTPUT ${WEB_CONTENT_DIR}/pico_fsdata.inc
    COMMAND ${Python3_EXECUTABLE} ${CMAKE_CURRENT_LIST_DIR}/tools/prepare_web_content.py
        ${WEB_DIST} ${WEB_CONTENT_DIR}/pico_fsdata.inc ${LTB_AP_ADDRESS}
    DEPENDS ${WEB_DIST} ${CMAKE_CURRENT_LIST_DIR}/tools/prepare_web_content.py
    COMMENT "Embedding web guide"
    VERBATIM)
add_custom_target(web_content DEPENDS ${WEB_CONTENT_DIR}/pico_fsdata.inc)
add_dependencies(logic_test_bench web_content)
target_include_directories(logic_test_bench PRIVATE ${WEB_CONTENT_DIR})

# USB CDC for the console. UART stdio is off because GP0/GP1 are signal pins.
pico_enable_stdio_usb(logic_test_bench 1)
pico_enable_stdio_uart(logic_test_bench 0)

pico_set_program_name(logic_test_bench "logic_test_bench")
pico_set_program_description(logic_test_bench "Programmable digital test signal generator for logic analyzers")
pico_set_program_version(logic_test_bench "0.2.0")

pico_add_extra_outputs(logic_test_bench)
