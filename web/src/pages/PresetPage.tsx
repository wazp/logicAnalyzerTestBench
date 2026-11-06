import { PresetSwitchButton } from '../components/PresetSwitch';
import { useDeviceStatus } from '../components/useDeviceStatus';
import { lessons } from '../lessons';
import { signalColor } from '../model/board';
import { activePreset } from '../model/device';
import { physicalPinForGpio } from '../model/pico';
import { presetPins, presets, type Preset } from '../model/presets';

function PresetCard({ preset, active, apSsid, onSwitched }: {
  preset: Preset;
  active: boolean | undefined;
  apSsid: string;
  onSwitched: () => void;
}) {
  const used = presetPins(preset.id);
  const idle = Array.from({ length: 13 }, (_, i) => 10 + i).filter((g) => !used.some((p) => p.gpio === g));
  const lessonList = lessons.filter((l) => (l.preset ?? 'protocols') === preset.id && l.gpios.some((g) => g >= 10 && g <= 22));
  return (
    <section class={active ? 'settings-card preset-card active' : 'settings-card preset-card'}>
      <h2>
        {preset.title} {active && <span class="preset-tag">playing now</span>}
      </h2>
      <p>{preset.summary}</p>
      <div class="table-scroll">
        <table class="signals-table">
          <thead>
            <tr>
              <th>Pico</th>
              <th>Signal</th>
            </tr>
          </thead>
          <tbody>
            {used.map((p) => (
              <tr key={p.gpio}>
                <td class="nowrap">
                  <span class="ch-dot" style={{ background: signalColor(p.gpio) }} />
                  GP{p.gpio} <span class="muted">pin {physicalPinForGpio(p.gpio)}</span>
                </td>
                <td>{p.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {idle.length > 0 && <p class="muted small">{idle.map((g) => `GP${g}`).join(', ')}: held low in this preset.</p>}
      {lessonList.length > 0 && (
        <p class="muted small">
          Lessons: {lessonList.map((l, i) => (
            <span key={l.id}>
              {i > 0 && ', '}
              <a href={`#/lesson/${l.id}`}>{l.title}</a>
            </span>
          ))}
        </p>
      )}
      {active === false && <PresetSwitchButton target={preset.id} apSsid={apSsid} onSwitched={onSwitched} />}
    </section>
  );
}

export function PresetPage() {
  const [state, refresh] = useDeviceStatus();
  const status = !state.loading ? state.status : null;
  const active = status ? activePreset(status) : undefined;
  return (
    <article>
      <header>
        <div class="eyebrow">Settings</div>
        <h1>Signal preset</h1>
        <p class="lede">
          GP10-GP22 play one preset at a time. GP0-GP9 and the GP26 button never change, so the basic lessons work with
          either.
        </p>
      </header>
      <p>
        Switching saves the choice and restarts the test bench, so every signal starts in step again. It takes a few
        seconds, and the board remembers the preset when it is unplugged. Your saved Wi-Fi network is kept. You can also
        switch from the USB serial console: press <code>p</code>, then the preset's number.
      </p>
      {state.loading && <p class="muted">Asking the test bench…</p>}
      {!state.loading && !status && (
        <p class="muted">
          Switching only works when this guide is opened from the test bench itself. The tables below show what each
          preset plays.
        </p>
      )}
      {presets.map((p) => (
        <PresetCard
          key={p.id}
          preset={p}
          active={active === undefined ? undefined : active === p.id}
          apSsid={status?.ap_ssid ?? ''}
          onSwitched={refresh}
        />
      ))}
    </article>
  );
}
