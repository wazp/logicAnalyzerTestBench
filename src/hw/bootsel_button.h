// Reads the BOOTSEL button while the firmware runs. Holding it for 3 seconds
// and releasing forgets the saved Wi-Fi network (see main.cpp), a way back to
// the setup hotspot that needs no computer.
//
// BOOTSEL is not a GPIO: it pulls the flash chip select low. Reading it means
// briefly releasing that pin, so for a few microseconds nothing may run from
// flash. The check runs from RAM with interrupts off. PIO, PWM and the pattern
// DMA do not touch flash, so the signals are not affected.

#pragma once

bool bootsel_pressed();
