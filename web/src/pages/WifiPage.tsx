import { useState } from 'preact/hooks';
import { useDeviceStatus } from '../components/useDeviceStatus';
import {
  forgetWifi,
  joinErrorText,
  localUrl,
  saveErrorText,
  saveWifi,
  scanNetworks,
  signalBars,
  validateWifi,
  type DeviceStatus,
  type Network,
} from '../model/device';

function Bars({ rssi }: { rssi: number }) {
  const bars = signalBars(rssi);
  return (
    <svg class="signal-bars" viewBox="0 0 16 12" role="img" aria-label={`Signal ${bars} of 4`}>
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={i * 4} y={9 - i * 3} width="3" height={3 + i * 3} class={i < bars ? 'on' : ''} />
      ))}
    </svg>
  );
}

function Lock() {
  return (
    <svg class="lock" viewBox="0 0 12 14" role="img" aria-label="Secured">
      <rect x="1" y="6" width="10" height="7.5" rx="1.5" />
      <path d="M3.5 6V4a2.5 2.5 0 0 1 5 0v2" fill="none" />
    </svg>
  );
}

function StatusCard({ status }: { status: DeviceStatus }) {
  const error = joinErrorText(status);
  return (
    <div class="settings-card wifi-status">
      <dl>
        <dt>Now</dt>
        <dd>
          {status.mode === 'joined' && (
            <>
              Connected to <strong>{status.ssid}</strong>
            </>
          )}
          {status.mode === 'setup' && (
            <>
              Running its own hotspot <strong>{status.ap_ssid}</strong>
            </>
          )}
          {status.mode === 'joining' && <>Joining {status.ssid}…</>}
        </dd>
        {status.mode === 'joined' && (
          <>
            <dt>Guide address</dt>
            <dd>
              <a href={localUrl(status.hostname)}>{localUrl(status.hostname)}</a>{' '}
              <span class="muted">or</span> <a href={`http://${status.ip}/`}>http://{status.ip}/</a>
            </dd>
          </>
        )}
        {status.mode === 'setup' && status.ssid && !error && (
          <>
            <dt>Saved network</dt>
            <dd>{status.ssid}</dd>
          </>
        )}
        <dt>Firmware</dt>
        <dd>{status.version}</dd>
      </dl>
      {error && <p class="wifi-error">{error} The hotspot is back so you can try again.</p>}
    </div>
  );
}

function JoinForm({
  ssid: initialSsid,
  secure,
  manual,
  onSaved,
}: {
  ssid: string;
  secure: boolean;
  manual: boolean;
  onSaved: (ssid: string, hostname: string) => void;
}) {
  const [ssid, setSsid] = useState(initialSsid);
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const passwordProps = {
    value: password,
    onInput: (e: Event) => setPassword((e.currentTarget as HTMLInputElement).value),
    autocomplete: 'off',
    autocapitalize: 'off' as const,
    spellcheck: false,
  };

  const submit = async (e: Event) => {
    e.preventDefault();
    const invalid = validateWifi(ssid, password);
    if (invalid) {
      setError(saveErrorText(invalid));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await saveWifi(ssid, password);
      if (result.ok) {
        onSaved(result.ssid, result.hostname);
      } else {
        setError(saveErrorText(result.error));
      }
    } catch {
      setError('The test bench did not answer. Check that you are still connected to it.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form class="join-form" onSubmit={submit}>
      {manual && (
        <label>
          Network name
          <input
            type="text"
            value={ssid}
            onInput={(e) => setSsid(e.currentTarget.value)}
            autocomplete="off"
            autocapitalize="off"
            spellcheck={false}
          />
        </label>
      )}
      {(secure || manual) && (
        <label>
          Password{manual && <span class="muted"> (empty for an open network)</span>}
          <span class="password-row">
            {show ? (
              <input type="text" {...passwordProps} />
            ) : (
              <input type="password" {...passwordProps} />
            )}
            <button type="button" class="link-button" onClick={() => setShow(!show)}>
              {show ? 'Hide' : 'Show'}
            </button>
          </span>
        </label>
      )}
      {error && <p class="wifi-error">{error}</p>}
      <button type="submit" class="button" disabled={busy}>
        {busy ? 'Saving…' : `Join ${manual ? 'network' : initialSsid}`}
      </button>
    </form>
  );
}

function NetworkPicker({ status, onSaved }: { status: DeviceStatus; onSaved: (ssid: string, hostname: string) => void }) {
  const [networks, setNetworks] = useState<Network[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  // The selected row: a scanned network's name, or '' for manual entry.
  const [selected, setSelected] = useState<string | null>(status.last_error && status.ssid ? status.ssid : null);

  const scan = async () => {
    setScanning(true);
    setScanError(null);
    try {
      setNetworks(await scanNetworks());
    } catch {
      setScanError('Scanning failed. Try again, or enter the network name yourself.');
    } finally {
      setScanning(false);
    }
  };

  const selectedNetwork = networks?.find((n) => n.ssid === selected);
  // A saved network that failed may not be in the list (e.g. not found): offer it pre-filled.
  const prefilled = selected !== null && selected !== '' && !selectedNetwork;

  return (
    <section>
      <h2>{status.mode === 'joined' ? 'Change network' : 'Choose your network'}</h2>
      <p>
        The test bench joins it after a restart. You then reach the guide from any device on that network, so your
        computer keeps its internet connection while you read along.
      </p>
      <div class="cta">
        <button class="button" onClick={scan} disabled={scanning}>
          {scanning ? 'Scanning…' : networks ? 'Scan again' : 'Scan for networks'}
        </button>
        <button class="button secondary" onClick={() => setSelected('')}>
          Enter a name
        </button>
      </div>
      {scanError && <p class="wifi-error">{scanError}</p>}

      {networks && networks.length === 0 && <p class="muted">No networks found.</p>}
      {networks && networks.length > 0 && (
        <ul class="network-list">
          {networks.map((n) => (
            <li key={n.ssid} class={n.ssid === selected ? 'selected' : ''}>
              <button class="network-row" onClick={() => setSelected(n.ssid)}>
                <Bars rssi={n.rssi} />
                <span class="network-name">{n.ssid}</span>
                {n.secure && <Lock />}
              </button>
              {n.ssid === selected && <JoinForm key={n.ssid} ssid={n.ssid} secure={n.secure} manual={false} onSaved={onSaved} />}
            </li>
          ))}
        </ul>
      )}
      {(selected === '' || prefilled) && (
        <div class="settings-card">
          <JoinForm key={selected ?? ''} ssid={selected ?? ''} secure manual onSaved={onSaved} />
        </div>
      )}
    </section>
  );
}

export function WifiPage() {
  const [state, refresh] = useDeviceStatus();
  const [saved, setSaved] = useState<{ ssid: string; hostname: string } | null>(null);
  const [confirmForget, setConfirmForget] = useState(false);
  const [forgetting, setForgetting] = useState(false);

  const header = (
    <header>
      <div class="eyebrow">Settings</div>
      <h1>Wi-Fi</h1>
    </header>
  );

  if (state.loading) {
    return (
      <article>
        {header}
        <p class="muted">Asking the test bench…</p>
      </article>
    );
  }
  const status = state.status;
  if (!status) {
    return (
      <article>
        {header}
        <p class="lede">Wi-Fi setup only works when this guide is opened from the test bench itself.</p>
        <p>
          Join the <strong>TestBench-XXXX</strong> network (password <code>testbench</code>) and open{' '}
          <code>http://4.3.2.1/</code>, or open the address the test bench prints on its serial console.
        </p>
      </article>
    );
  }

  if (saved) {
    return (
      <article>
        {header}
        <section class="settings-card wifi-done">
          <h2>Saved</h2>
          <p>
            The test bench restarts and joins <strong>{saved.ssid}</strong>. This page loses its connection now; that
            is expected.
          </p>
          <p>
            Connect this device back to <strong>{saved.ssid}</strong>, then open:
          </p>
          <p class="big-link">
            <a href={localUrl(saved.hostname)}>{localUrl(saved.hostname)}</a>
          </p>
          <p class="muted small">
            If that name does not open, the address is printed on the serial console (command <code>w</code>) and is
            listed as <strong>{saved.hostname}</strong> in your router. If the test bench can't join, its own{' '}
            <strong>{status.ap_ssid}</strong> hotspot comes back within half a minute and shows what went wrong.
          </p>
        </section>
      </article>
    );
  }

  // Two clicks instead of confirm(): Android's sign-in window may not show
  // JavaScript dialogs.
  const forget = async () => {
    setForgetting(true);
    try {
      await forgetWifi();
    } catch {
      // The reboot may cut the response; either way, refresh shortly.
    }
    setTimeout(refresh, 15000);
  };

  return (
    <article class="wifi-page">
      {header}
      <StatusCard status={status} />
      {forgetting ? (
        <p class="muted">
          Forgetting {status.ssid}. The test bench restarts into its own <strong>{status.ap_ssid}</strong> hotspot.
        </p>
      ) : (
        <>
          <NetworkPicker status={status} onSaved={(ssid, hostname) => setSaved({ ssid, hostname })} />
          {status.ssid && (
            <section>
              <h2>Forget the network</h2>
              <p>
                The test bench restarts into its own hotspot. Without this page: hold the BOOTSEL button until the
                LED goes off, then release it, or press <code>f</code> on the serial console.
              </p>
              <div class="cta">
                {confirmForget ? (
                  <>
                    <button class="button danger" onClick={forget}>
                      Yes, forget {status.ssid}
                    </button>
                    <button class="button secondary" onClick={() => setConfirmForget(false)}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button class="button secondary" onClick={() => setConfirmForget(true)}>
                    Forget {status.ssid}
                  </button>
                )}
              </div>
            </section>
          )}
        </>
      )}
    </article>
  );
}
