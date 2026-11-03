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

#endif  // LWIPOPTS_H
