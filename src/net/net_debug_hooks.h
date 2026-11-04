// lwIP hook for LTB_NET_DEBUG builds: prints what clients send to the access
// point, so we can see exactly how a phone's connectivity check behaves:
//   - every DNS query (name and record type)
//   - every new TCP connection attempt, on any port (443 and 853 included)
//   - the raw text of HTTP requests, headers included (lwIP's HTTPD_DEBUG only
//     shows the path)
//
// Included by lwIP through LWIP_HOOK_FILENAME (see lwipopts.h). Runs in
// interrupt context for every received IPv4 packet, so it only reads the
// packet, prints, and never consumes it.

#ifndef NET_DEBUG_HOOKS_H
#define NET_DEBUG_HOOKS_H

#include <stdio.h>

#include "lwip/pbuf.h"

static inline void net_debug_dns_query(const u8_t* ip, const u8_t* dns, int len) {
    // DNS header is 12 bytes, then the first question: length-prefixed labels
    // ending in 0, then a 16-bit type.
    char name[128];
    int out = 0;
    int i = 12;
    while (i < len && dns[i] != 0 && out < (int)sizeof(name) - 1) {
        int label = dns[i++];
        if (out > 0) {
            name[out++] = '.';
        }
        while (label-- > 0 && i < len && out < (int)sizeof(name) - 1) {
            name[out++] = (char)dns[i++];
        }
    }
    name[out] = 0;
    unsigned type = (i + 2 < len) ? (unsigned)((dns[i + 1] << 8) | dns[i + 2]) : 0;
    printf("dns query from %u.%u.%u.%u: %s type %u\n", ip[12], ip[13], ip[14], ip[15], name, type);
}

static inline int net_debug_ip4_input(struct pbuf* p) {
    const u8_t* ip = (const u8_t*)p->payload;
    if (p->len < 20 || (ip[0] >> 4) != 4) {
        return 0;
    }
    u16_t ip_header = (u16_t)((ip[0] & 0x0f) * 4);
    u16_t total = (u16_t)((ip[2] << 8) | ip[3]);
    if (total > p->len || total < ip_header + 8) {
        return 0;  // Fragmented across pbufs or truncated; skip.
    }
    const u8_t* l4 = ip + ip_header;
    u16_t dst_port = (u16_t)((l4[2] << 8) | l4[3]);

    if (ip[9] == 17 && dst_port == 53) {  // UDP DNS query.
        net_debug_dns_query(ip, l4 + 8, total - ip_header - 8);
        return 0;
    }
    if (ip[9] != 6 || total < ip_header + 20) {
        return 0;  // Not TCP.
    }
    u8_t flags = l4[13];
    if ((flags & 0x02) && !(flags & 0x10)) {  // SYN without ACK: a new connection.
        printf("tcp connect from %u.%u.%u.%u to port %u\n", ip[12], ip[13], ip[14], ip[15], dst_port);
        return 0;
    }
    u16_t tcp_header = (u16_t)((l4[12] >> 4) * 4);
    if (dst_port != 80 || total <= ip_header + tcp_header) {
        return 0;
    }
    int len = total - ip_header - tcp_header;
    printf("http request from %u.%u.%u.%u (%d bytes):\n%.*s\n---\n", ip[12], ip[13], ip[14], ip[15], len,
           len > 600 ? 600 : len, (const char*)(l4 + tcp_header));
    return 0;
}

#define LWIP_HOOK_IP4_INPUT(pbuf, input_netif) net_debug_ip4_input(pbuf)

#endif  // NET_DEBUG_HOOKS_H
