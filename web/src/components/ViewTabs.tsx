import { useState } from 'preact/hooks';
import type { View } from '../lessons/types';
import { formatRate } from '../model/format';
import { signalByGpio, waveOf } from '../model/signals';
import { Waveform, type Row } from './Waveform';

/** Switches between the views of one capture, and between sample rates when a view offers them. */
export function ViewTabs({ gpios, views }: { gpios: number[]; views: View[] }) {
  const [index, setIndex] = useState(0);
  const view = views[index];
  const [rate, setRate] = useState<number | undefined>(view.sampleRateHz);

  const selectView = (i: number) => {
    setIndex(i);
    setRate(views[i].sampleRateHz);
  };

  // Views of the basic signals draw every wired pin; protocol views bring their own rows.
  const rows: Row[] = view.rows ?? gpios.map((g) => ({ gpio: g, wave: waveOf(signalByGpio(g)) }));

  return (
    <figure class="views">
      <div class="view-controls">
        {views.length > 1 && (
          <div class="segmented" role="tablist">
            {views.map((v, i) => (
              <button key={v.title} role="tab" aria-selected={i === index} class={i === index ? 'active' : ''} onClick={() => selectView(i)}>
                {v.title}
              </button>
            ))}
          </div>
        )}
        {view.sampleRateOptions && (
          <div class="segmented" aria-label="Sample rate">
            {view.sampleRateOptions.map((r) => (
              <button key={r} class={r === rate ? 'active' : ''} onClick={() => setRate(r)}>
                {formatRate(r)}
              </button>
            ))}
          </div>
        )}
      </div>
      <Waveform rows={rows} startNs={view.startNs} endNs={view.endNs} sampleRateHz={rate} />
      <figcaption>{view.caption}</figcaption>
    </figure>
  );
}
