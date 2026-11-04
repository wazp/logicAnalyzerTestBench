import { describe, expect, it } from 'vitest';
import { getStatus, joinErrorText, saveWifi, scanNetworks, signalBars, validateWifi, type DeviceStatus } from './device';

const status: DeviceStatus = {
  mode: 'setup',
  ssid: 'RogueTwo',
  ip: '4.3.2.1',
  hostname: 'testbench-f8cd',
  ap_ssid: 'TestBench-F8CD',
  last_error: 'wrong_password',
  version: '0.3.0',
};

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' }, ...init });
}

describe('getStatus', () => {
  it('returns the device status', async () => {
    const fetcher = (async () => json(status)) as typeof fetch;
    expect(await getStatus(fetcher)).toEqual(status);
  });

  it('returns null when not served by a test bench', async () => {
    const offline = (async () => {
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;
    const notFound = (async () => new Response('nope', { status: 404 })) as typeof fetch;
    const html = (async () => new Response('<!doctype html>')) as typeof fetch;
    expect(await getStatus(offline)).toBeNull();
    expect(await getStatus(notFound)).toBeNull();
    expect(await getStatus(html)).toBeNull();
  });
});

describe('scanNetworks', () => {
  it('polls until the scan finishes', async () => {
    let polls = 0;
    const fetcher = (async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return json({ scanning: true }, { status: 202 });
      polls++;
      return json({ scanning: polls < 3, networks: polls < 3 ? [] : [{ ssid: 'A', rssi: -40, secure: true }] });
    }) as typeof fetch;
    expect(await scanNetworks(fetcher, 0)).toEqual([{ ssid: 'A', rssi: -40, secure: true }]);
    expect(polls).toBe(3);
  });

  it('gives up after too many polls', async () => {
    const fetcher = (async () => json({ scanning: true, networks: [] })) as typeof fetch;
    await expect(scanNetworks(fetcher, 0, 2)).rejects.toThrow();
  });
});

describe('saveWifi', () => {
  it('posts URL-encoded form fields', async () => {
    let body = '';
    const fetcher = (async (_url: string, init?: RequestInit) => {
      body = String(init?.body);
      return json({ ok: true, ssid: 'My Net', hostname: 'testbench-f8cd' });
    }) as typeof fetch;
    const result = await saveWifi('My Net', 'p&ss=w0rd', fetcher);
    expect(result.ok).toBe(true);
    expect(new URLSearchParams(body).get('ssid')).toBe('My Net');
    expect(new URLSearchParams(body).get('password')).toBe('p&ss=w0rd');
  });
});

describe('validateWifi', () => {
  it('matches the firmware limits', () => {
    expect(validateWifi('', '')).toBe('ssid_required');
    expect(validateWifi('x'.repeat(33), '')).toBe('ssid_too_long');
    expect(validateWifi('ö'.repeat(17), '')).toBe('ssid_too_long'); // 34 bytes in UTF-8.
    expect(validateWifi('net', 'short')).toBe('password_too_short');
    expect(validateWifi('net', 'p'.repeat(64))).toBe('password_too_long');
    expect(validateWifi('net', '')).toBeNull();
    expect(validateWifi('x'.repeat(32), 'p'.repeat(63))).toBeNull();
  });
});

describe('wording and signal', () => {
  it('explains join errors in plain words', () => {
    expect(joinErrorText(status)).toBe("Couldn't join RogueTwo: wrong password.");
    expect(joinErrorText({ ...status, last_error: '' })).toBeNull();
    expect(joinErrorText({ ssid: '', last_error: 'timeout' })).toContain('the network');
  });

  it('turns dBm into bars', () => {
    expect(signalBars(-32)).toBe(4);
    expect(signalBars(-60)).toBe(3);
    expect(signalBars(-73)).toBe(2);
    expect(signalBars(-89)).toBe(0);
  });
});
