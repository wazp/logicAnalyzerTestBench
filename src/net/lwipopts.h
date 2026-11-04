// lwIP configuration for the Wi-Fi access point and web server.
// Based on pico-examples/pico_w/wifi/lwipopts_examples_common.h, trimmed to
// what this firmware uses (NO_SYS, IPv4, UDP for DHCP/DNS, TCP for HTTP).

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

#define LWIP_ARP 1
#define LWIP_ETHERNET 1
#define LWIP_ICMP 1
#define LWIP_RAW 1
#define LWIP_IPV4 1
#define LWIP_TCP 1
#define LWIP_UDP 1
#define LWIP_DNS 0
#define LWIP_DHCP 0  // We are the DHCP server (third_party dhcpserver), not a client.

// A device asking for an address sends from 0.0.0.0. ip4_input drops such
// packets unless LWIP_DHCP or this hook is defined, so without it the DHCP
// server never sees a request and phones join but never get an address.
// Defining the hook enables lwIP's link-layer addressing path, which accepts
// a 0.0.0.0 source on any port; the port test only matters while the netif is
// down. The port arrives in network byte order.
#define LWIP_IP_ACCEPT_UDP_PORT(port) ((port) == PP_NTOHS(67))

#define TCP_MSS 1460
#define TCP_WND (8 * TCP_MSS)
#define TCP_SND_BUF (8 * TCP_MSS)
#define TCP_SND_QUEUELEN ((4 * (TCP_SND_BUF) + (TCP_MSS - 1)) / (TCP_MSS))
#define LWIP_TCP_KEEPALIVE 1

#define LWIP_NETIF_STATUS_CALLBACK 1
#define LWIP_NETIF_LINK_CALLBACK 1
#define LWIP_NETIF_HOSTNAME 1
#define LWIP_NETIF_TX_SINGLE_PBUF 1
#define LWIP_CHKSUM_ALGORITHM 3

#define MEM_STATS 0
#define SYS_STATS 0
#define MEMP_STATS 0
#define LINK_STATS 0

// HTTP server: static files only, generated into pico_fsdata.inc at build time.
#define LWIP_HTTPD_CGI 0
#define LWIP_HTTPD_SSI 0
#define LWIP_HTTPD_SUPPORT_POST 0
#define HTTPD_FSDATA_FILE "pico_fsdata.inc"

// Debug builds only (cmake -DLTB_NET_DEBUG=ON): print DNS queries, TCP
// connection attempts, raw HTTP requests and HTTP server activity to the USB
// serial console (see net_debug_hooks.h). Printing happens in interrupt
// context, so keep it off in normal builds.
#ifdef LTB_NET_DEBUG
#define LWIP_DEBUG 1
#define HTTPD_DEBUG LWIP_DBG_ON
#define LWIP_HOOK_FILENAME "net_debug_hooks.h"
#endif

#endif  // LWIPOPTS_H
