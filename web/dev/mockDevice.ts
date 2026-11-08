// Dev server only: a stand-in for the firmware's JSON API
// (src/net/http_server.h), so the Wi-Fi page can be worked on without a board.
// Not part of the build. Start in a different state with
//   MOCK_MODE=joined npm run dev      (setup | joined | error | none)
//   MOCK_PRESET=video npm run dev     (protocols | video | faults | verify)
// "none" answers 404, like a static host. Switching the preset "restarts":
// the status API stops answering for two seconds.

import type { Plugin } from 'vite';

// The few Node request fields used here (the project has no @types/node).
interface Req {
  url?: string;
  method?: string;
  on(event: 'data' | 'end', listener: (chunk?: unknown) => void): void;
}
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};

export function mockDevice(): Plugin {
  const mode = env.MOCK_MODE ?? 'setup';
  let preset = env.MOCK_PRESET ?? 'protocols';
  let restartUntil = 0;
  let scanUntil = 0;
  const status = () => ({
    mode: mode === 'joined' ? 'joined' : 'setup',
    ssid: mode === 'setup' ? '' : 'RogueTwo',
    ip: mode === 'joined' ? '192.168.1.57' : '4.3.2.1',
    hostname: 'testbench-f8cd',
    ap_ssid: 'TestBench-F8CD',
    last_error: mode === 'error' ? 'wrong_password' : '',
    version: '0.5.0-dev',
    preset,
  });
  const networks = [
    { ssid: 'RogueTwo', rssi: -32, secure: true },
    { ssid: 'Prince_EXT', rssi: -55, secure: true },
    { ssid: 'Cafe Guest', rssi: -71, secure: false },
    { ssid: 'ORBI18', rssi: -92, secure: true },
  ];

  return {
    name: 'mock-device',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((incoming, res, next) => {
        const req = incoming as unknown as Req;
        if (!req.url?.startsWith('/api/')) return next();
        const send = (code: number, body: unknown) => {
          res.statusCode = code;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(body));
        };
        if (mode === 'none') return send(404, { error: 'not_found' });
        if (Date.now() < restartUntil) {
          res.statusCode = 503;
          return res.end();
        }
        const route = `${req.method} ${req.url}`;
        if (route === 'GET /api/status') return send(200, status());
        if (route === 'POST /api/scan') {
          scanUntil = Date.now() + 2500;
          return send(202, { scanning: true });
        }
        if (route === 'GET /api/scan') {
          const scanning = Date.now() < scanUntil;
          return send(200, { scanning, networks: scanning ? [] : networks });
        }
        if (route === 'POST /api/wifi') {
          let body = '';
          req.on('data', (chunk) => (body += String(chunk)));
          req.on('end', () => {
            const form = new URLSearchParams(body);
            const password = form.get('password') ?? '';
            if (password.length > 0 && password.length < 8) return send(400, { ok: false, error: 'password_too_short' });
            send(200, { ok: true, ssid: form.get('ssid'), hostname: 'testbench-f8cd' });
          });
          return;
        }
        if (route === 'POST /api/wifi/forget') return send(200, { ok: true });
        if (route === 'POST /api/preset') {
          let body = '';
          req.on('data', (chunk) => (body += String(chunk)));
          req.on('end', () => {
            const wanted = new URLSearchParams(body).get('preset') ?? '';
            if (!['protocols', 'video', 'faults', 'verify'].includes(wanted)) return send(400, { ok: false, error: 'unknown_preset' });
            const restarting = wanted !== preset;
            send(200, { ok: true, preset: wanted, restarting });
            if (restarting) {
              preset = wanted;
              restartUntil = Date.now() + 2000;
            }
          });
          return;
        }
        send(404, { error: 'not_found' });
      });
    },
  };
}
