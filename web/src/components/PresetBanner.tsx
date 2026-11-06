import { activePreset } from '../model/device';
import { presetById, type PresetId } from '../model/presets';
import { PresetSwitchButton } from './PresetSwitch';
import { useDeviceStatus } from './useDeviceStatus';

/**
 * Shown on lessons that wire GP10-GP22 when the board plays another preset
 * than the lesson needs, with a button to switch. Away from the board (a file
 * or another host) it only says which preset the lesson needs, if that is not
 * the default.
 */
export function PresetBanner({ preset }: { preset: PresetId }) {
  const [device, refresh] = useDeviceStatus();
  if (device.loading) return null;
  const needed = presetById(preset);
  const status = device.status;
  if (!status) {
    if (preset === 'protocols') return null;
    return (
      <aside class="preset-banner">
        This lesson needs the <strong>{needed.title}</strong> signal preset. Choose it on the test bench under{' '}
        <a href="#/preset">Settings, Signal preset</a>, or press <code>p</code> on its serial console.
      </aside>
    );
  }
  const active = activePreset(status);
  if (active === preset) return null;
  return (
    <aside class="preset-banner">
      <p>
        This lesson needs the <strong>{needed.title}</strong> preset, but the test bench is playing{' '}
        <strong>{presetById(active).title}</strong> on GP10-GP22 right now.
      </p>
      <PresetSwitchButton target={preset} apSsid={status.ap_ssid} onSwitched={refresh} />
    </aside>
  );
}
