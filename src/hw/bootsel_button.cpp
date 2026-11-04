#include "hw/bootsel_button.h"

#include "hardware/gpio.h"
#include "hardware/structs/ioqspi.h"
#include "hardware/structs/sio.h"
#include "hardware/sync.h"

// From pico-examples/picoboard/button. Must not execute from flash.
bool __no_inline_not_in_flash_func(bootsel_pressed)() {
    constexpr unsigned kCsPinIndex = 1;
    const uint32_t flags = save_and_disable_interrupts();

    // Float the chip select (output enable forced low) so the button's
    // pull-down can be read.
    hw_write_masked(&ioqspi_hw->io[kCsPinIndex].ctrl, GPIO_OVERRIDE_LOW << IO_QSPI_GPIO_QSPI_SS_CTRL_OEOVER_LSB,
                    IO_QSPI_GPIO_QSPI_SS_CTRL_OEOVER_BITS);
    for (volatile int i = 0; i < 1000; ++i) {
        // Let the pin settle.
    }
    const bool pressed = !(sio_hw->gpio_hi_in & SIO_GPIO_HI_IN_QSPI_CSN_BITS);
    hw_write_masked(&ioqspi_hw->io[kCsPinIndex].ctrl, GPIO_OVERRIDE_NORMAL << IO_QSPI_GPIO_QSPI_SS_CTRL_OEOVER_LSB,
                    IO_QSPI_GPIO_QSPI_SS_CTRL_OEOVER_BITS);

    restore_interrupts(flags);
    return pressed;
}
