import { useState } from 'preact/hooks';
import { setPreset, waitForPreset } from '../model/device';
import { presetById, type PresetId } from '../model/presets';

type State = 'idle' | 'restarting' | 'failed';

/** A button that switches the board to `target` and waits for it to come back. */
export function PresetSwitchButton({
  target,
  apSsid,
  onSwitched,
  secondary,
}: {
  target: PresetId;
  apSsid: string;
  onSwitched: () => void;
  secondary?: boolean;
}) {
  const [state, setState] = useState<State>('idle');
  const title = presetById(target).title;

  const run = async () => {
    setState('restarting');
    try {
      const result = await setPreset(target);
      if (!result.ok) throw new Error(result.error);
      if (result.restarting && !(await waitForPreset(target))) throw new Error('no answer');
      setState('idle');
      onSwitched();
    } catch {
      setState('failed');
    }
  };

  if (state === 'restarting') {
    return (
      <p class="preset-progress" role="status">
        Switching to <strong>{title}</strong>: the test bench restarts, which takes a few seconds. On its own hotspot (
        {apSsid}), your phone or computer may need to rejoin it.
      </p>
    );
  }
  return (
    <div>
      <button type="button" class={secondary ? 'button secondary' : 'button'} onClick={run}>
        Switch to {title}
      </button>
      {state === 'failed' && (
        <p class="wifi-error">
          The test bench did not come back. Rejoin its network if needed, then reload this page to see which preset is
          playing.
        </p>
      )}
    </div>
  );
}
