#include "hw/dma_loop.h"

#include "hardware/dma.h"

void dma_loop_start(PIO pio, unsigned sm, const uint32_t* words, size_t word_count,
                    const uint32_t* const* start_pointer) {
    const uint data_ch = static_cast<uint>(dma_claim_unused_channel(true));
    const uint ctrl_ch = static_cast<uint>(dma_claim_unused_channel(true));

    dma_channel_config dc = dma_channel_get_default_config(data_ch);
    channel_config_set_transfer_data_size(&dc, DMA_SIZE_32);
    channel_config_set_read_increment(&dc, true);
    channel_config_set_write_increment(&dc, false);
    channel_config_set_dreq(&dc, pio_get_dreq(pio, sm, true));  // Pace by FIFO space.
    channel_config_set_chain_to(&dc, ctrl_ch);
    dma_channel_configure(data_ch, &dc, &pio->txf[sm], words, static_cast<uint>(word_count), false);

    dma_channel_config cc = dma_channel_get_default_config(ctrl_ch);
    channel_config_set_transfer_data_size(&cc, DMA_SIZE_32);
    channel_config_set_read_increment(&cc, false);
    channel_config_set_write_increment(&cc, false);
    // Writing READ_ADDR_TRIG restarts the data channel from the top.
    dma_channel_configure(ctrl_ch, &cc, &dma_hw->ch[data_ch].al3_read_addr_trig, start_pointer, 1, false);

    dma_channel_start(data_ch);
}
