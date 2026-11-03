// USB serial console: prints a banner and the status table, and reads
// single-key commands. Never waits for a USB host, so the board runs the same
// whether or not a computer is attached.

#pragma once

// Call repeatedly from the main loop. Blocks for at most ~100 ms while
// waiting for a key, which is fine because all signals run in hardware.
void console_poll();
