#include "hw/settings_store.h"

#include <cstdint>

#include "hardware/flash.h"
#include "pico/flash.h"
#include "pico/platform.h"

extern "C" char __flash_binary_end;  // Defined by the SDK linker script.

namespace {

// Second-to-last sector of the board's flash (4 MB on the Pico 2 W). Not the
// last one: every RP2350 .uf2 the SDK builds carries an extra block for the
// RP2350-E10 boot ROM erratum, addressed to 0x10ffff00. On a 4 MB chip that
// address wraps to the last page, so each drag-and-drop flash would erase the
// last sector and the saved network with it.
constexpr uint32_t kOffset = PICO_FLASH_SIZE_BYTES - 2 * FLASH_SECTOR_SIZE;
static_assert(settings::kBlobSize % FLASH_PAGE_SIZE == 0, "settings blob must be whole flash pages");

// Runs with interrupts off and nothing executing from flash. The SDK flash
// functions are already in RAM, so this function only needs to call them.
void write_sector(void* param) {
    flash_range_erase(kOffset, FLASH_SECTOR_SIZE);
    flash_range_program(kOffset, static_cast<const uint8_t*>(param), settings::kBlobSize);
}

}  // namespace

void settings_store_check_layout() {
    const uintptr_t binary_end = reinterpret_cast<uintptr_t>(&__flash_binary_end) - XIP_BASE;
    if (binary_end > kOffset) {
        panic("Firmware (%u bytes) overlaps the settings sector at 0x%x", static_cast<unsigned>(binary_end),
              static_cast<unsigned>(kOffset));
    }
}

bool settings_store_load(settings::Settings& out) {
    const auto* blob = reinterpret_cast<const uint8_t*>(XIP_BASE + kOffset);
    out = settings::Settings{};
    return settings::parse(blob, settings::kBlobSize, out);
}

bool settings_store_save(const settings::Settings& s) {
    static uint8_t blob[settings::kBlobSize];  // Must be in RAM while flash is busy.
    settings::serialize(s, blob);
    return flash_safe_execute(write_sector, blob, 100) == PICO_OK;
}
