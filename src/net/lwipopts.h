// lwIP configuration for the Wi-Fi setup hotspot, the home network station
// and the web server (src/net/).
// Based on pico-examples/pico_w/wifi/lwipopts_examples_common.h, trimmed to
// what this firmware uses (NO_SYS, IPv4, UDP for DHCP/DNS/mDNS, TCP for HTTP).

#ifndef LWIPOPTS_H
#define LWIPOPTS_H

#define NO_SYS 1
#define LWIP_SOCKET 0
#define LWIP_NETCONN 0

// Required by the threadsafe_background cyw43 architecture.
#define MEM_LIBC_MALLOC 0
#define MEM_ALIGNMENT 4
#define MEM_SIZE 16000
#define MEMP_NUM_TCP_SEG 32
#define MEMP_NUM_ARP_QUEUE 10
#define PBUF_POOL_SIZE 24

// Connections: 6 web server slots (http_server.cpp) plus closing ones in
// TIME_WAIT. Pbufs referencing the page in flash: up to 8 segments per slot.
#define MEMP_NUM_TCP_PCB 12
#define MEMP_NUM_PBUF 48
// UDP: DHCP server and catch-all DNS (hotspot), DHCP client and mDNS (home
// network).
#define MEMP_NUM_UDP_PCB 6
// Extra timers for the DHCP client, IGMP and mDNS.
#define MEMP_NUM_SYS_TIMEOUT (LWIP_NUM_SYS_TIMEOUT_INTERNAL + 4)

#define LWIP_ARP 1
#define LWIP_ETHERNET 1
#define LWIP_ICMP 1
#define LWIP_RAW 1
#define LWIP_IPV4 1
#define LWIP_TCP 1
#define LWIP_UDP 1
#define LWIP_DNS 0
// DHCP client for the home network. On the setup hotspot we are the DHCP
// server instead (third_party dhcpserver).
#define LWIP_DHCP 1

// A device asking for an address sends from 0.0.0.0. ip4_input drops such
// packets unless LWIP_DHCP or this hook is defined. LWIP_DHCP is on now, but
// keep the hook so the hotspot's DHCP server never depends on the client
// being compiled in (without it, phones join but never get an address).
// The port arrives in network byte order.
#define LWIP_IP_ACCEPT_UDP_PORT(port) ((port) == PP_NTOHS(67))

#define TCP_MSS 1460
#define TCP_WND (8 * TCP_MSS)
#define TCP_SND_BUF (8 * TCP_MSS)
#define TCP_SND_QUEUELEN ((4 * (TCP_SND_BUF) + (TCP_MSS - 1)) / (TCP_MSS))
#define LWIP_TCP_KEEPALIVE 1

#define LWIP_NETIF_STATUS_CALLBACK 1
#define LWIP_NETIF_LINK_CALLBACK 1
#define LWIP_NETIF_HOSTNAME 1  // Name in the router's client list.
#define LWIP_IGMP 1               // Multicast, for mDNS.
#define LWIP_MDNS_RESPONDER 1     // http://testbench-xxxx.local/ on a home network.
#define LWIP_NUM_NETIF_CLIENT_DATA 1
#define LWIP_NETIF_TX_SINGLE_PBUF 1
#define LWIP_CHKSUM_ALGORITHM 3

#define MEM_STATS 0
#define SYS_STATS 0
#define MEMP_STATS 0
#define LINK_STATS 0

// Debug builds only (cmake -DLTB_NET_DEBUG=ON): print DNS queries, TCP
// connection attempts, raw HTTP requests and the web server's routing to the
// USB serial console (see net_debug_hooks.h and http_server.cpp). Printing
// happens in interrupt context, so keep it off in normal builds.
#ifdef LTB_NET_DEBUG
#define LWIP_HOOK_FILENAME "net_debug_hooks.h"
#endif

#endif  // LWIPOPTS_H
