// Talks to the test bench firmware's JSON API (src/net/http_server.h).
// Only available when the guide is served by the device itself; opened from a
// file or another host, getStatus() returns null and the Wi-Fi page explains.

export type WifiMode = 'setup' | 'joining' | 'joined' | 'off';
export type JoinError = '' | 'wrong_password' | 'not_found' | 'timeout' | 'failed';
export type SaveError = 'ssid_required' | 'ssid_too_long' | 'password_too_short' | 'password_too_long';

export interface DeviceStatus {
  mode: WifiMode;
  ssid: string; // Saved network, empty if none.
  ip: string;
  hostname: string; // e.g. "testbench-f8cd", reachable as <hostname>.local
  ap_ssid: string;
  last_error: JoinError;
  version: string;
}

export interface Network {
  ssid: string;
  rssi: number; // dBm
  secure: boolean;
}

export interface ScanResult {
  scanning: boolean;
  networks: Network[];
}

export type SaveResult = { ok: true; ssid: string; hostname: string } | { ok: false; error: SaveError };

/** Returns null when the guide is not served by a test bench. */
export async function getStatus(fetcher: typeof fetch = fetch): Promise<DeviceStatus | null> {
  try {
    const r = await fetcher('/api/status', { cache: 'no-store' });
    if (!r.ok) return null;
    const s = (await r.json()) as DeviceStatus;
    return typeof s.mode === 'string' && typeof s.hostname === 'string' ? s : null;
  } catch {
    return null;
  }
}

export async function startScan(fetcher: typeof fetch = fetch): Promise<void> {
  await fetcher('/api/scan', { method: 'POST' });
}

export async function getScan(fetcher: typeof fetch = fetch): Promise<ScanResult> {
  const r = await fetcher('/api/scan', { cache: 'no-store' });
  return (await r.json()) as ScanResult;
}

/** Starts a scan and polls until it finishes (the radio takes a few seconds). */
export async function scanNetworks(fetcher: typeof fetch = fetch, pollMs = 1000, maxPolls = 15): Promise<Network[]> {
  await startScan(fetcher);
  for (let i = 0; i < maxPolls; i++) {
    await new Promise((resolve) => setTimeout(resolve, pollMs));
    const result = await getScan(fetcher);
    if (!result.scanning) return result.networks;
  }
  throw new Error('The scan did not finish.');
}

export async function saveWifi(ssid: string, password: string, fetcher: typeof fetch = fetch): Promise<SaveResult> {
  const r = await fetcher('/api/wifi', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ssid, password }).toString(),
  });
  return (await r.json()) as SaveResult;
}

export async function forgetWifi(fetcher: typeof fetch = fetch): Promise<void> {
  await fetcher('/api/wifi/forget', { method: 'POST' });
}

/** Same rules as the firmware (src/core/settings.cpp), checked before sending. */
export function validateWifi(ssid: string, password: string): SaveError | null {
  const ssidBytes = new TextEncoder().encode(ssid).length;
  if (ssidBytes === 0) return 'ssid_required';
  if (ssidBytes > 32) return 'ssid_too_long';
  if (password.length > 0 && password.length < 8) return 'password_too_short';
  if (password.length > 63) return 'password_too_long';
  return null;
}

export function saveErrorText(error: SaveError): string {
  switch (error) {
    case 'ssid_required':
      return 'Enter the network name.';
    case 'ssid_too_long':
      return 'Network names are at most 32 bytes.';
    case 'password_too_short':
      return 'Wi-Fi passwords are at least 8 characters.';
    case 'password_too_long':
      return 'Wi-Fi passwords are at most 63 characters.';
  }
}

/** Plain words for why the last join failed, or null if it did not. */
export function joinErrorText(status: Pick<DeviceStatus, 'ssid' | 'last_error'>): string | null {
  const net = status.ssid || 'the network';
  switch (status.last_error) {
    case '':
      return null;
    case 'wrong_password':
      return `Couldn't join ${net}: wrong password.`;
    case 'not_found':
      return `Couldn't join ${net}: network not found. Check the name and that it is in range.`;
    case 'timeout':
      return `Couldn't join ${net}: it took too long. The network may be out of range.`;
    case 'failed':
      return `Couldn't join ${net}.`;
  }
}

/** 0 to 4 bars from a signal strength in dBm. */
export function signalBars(rssi: number): number {
  if (rssi >= -55) return 4;
  if (rssi >= -65) return 3;
  if (rssi >= -75) return 2;
  if (rssi >= -85) return 1;
  return 0;
}

export function localUrl(hostname: string): string {
  return `http://${hostname}.local/`;
}
