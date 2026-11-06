import { Fragment } from 'preact';
import { useContext } from 'preact/hooks';
import { shortLabel } from '../model/board';
import {
  captureWindow,
  describeTrigger,
  samplesFor,
  samplesNeeded,
  validateSettings,
  type CaptureSettings,
} from '../model/capture';
import { formatCount, formatPercent, formatRate, formatTime } from '../model/format';
import { PresetContext } from './PresetContext';

/** What to set up in the analyzer software, plus what it adds up to. */
export function SettingsCard({ settings }: { settings: CaptureSettings }) {
  const preset = useContext(PresetContext);
  const w = captureWindow(settings);
  const issues = validateSettings(settings);
  // Apps set the length as a time, a sample count or (for the pre-trigger part) a percentage,
  // so the card gives all three. Counts are tied to the rate, hence the note on "or faster".
  const samples = (ns: number) => `${formatCount(samplesFor(settings, ns))} samples`;
  const triggerShare = (100 * w.preNs) / (w.preNs + w.postNs);
  return (
    <div class="settings-card">
      <div class="settings-title">Capture settings</div>
      <dl>
        <dt>Record</dt>
        <dd>
          {/* The separator sits outside the nowrap span so the list can break between pins. */}
          {settings.gpios.map((g, i) => (
            <Fragment key={g}>
              {i > 0 && ', '}
              <span class="nowrap">
                GP{g} <span class="muted">({shortLabel(g, preset)})</span>
              </span>
            </Fragment>
          ))}
        </dd>
        <dt>Sample rate</dt>
        <dd>
          {formatRate(settings.sampleRateHz)}{' '}
          <span class="muted">or faster, then scale the sample counts up to match</span>
        </dd>
        <dt>Length</dt>
        <dd>
          {formatTime(w.postNs)} after the trigger <span class="muted">({samples(w.postNs)})</span>
          {w.preNs > 0 && (
            <span class="muted">
              , {formatTime(w.preNs)} before if your analyzer keeps it ({samples(w.preNs)})
            </span>
          )}
        </dd>
        <dt>Trigger</dt>
        <dd>{describeTrigger(settings.trigger, preset)}</dd>
        {settings.decoder && (
          <>
            <dt>Decoder</dt>
            <dd>{settings.decoder}</dd>
          </>
        )}
      </dl>
      <div class="settings-derived">
        <div>
          <span class="muted">Inputs</span> {settings.gpios.length}
        </div>
        <div>
          <span class="muted">One sample</span> {formatTime(1e9 / settings.sampleRateHz)}
        </div>
        <div>
          <span class="muted">Samples per input</span> about {formatCount(samplesNeeded(settings))}
        </div>
        {w.preNs > 0 && (
          <div>
            <span class="muted">Trigger at</span> {formatPercent(Math.round(triggerShare))} of the capture
          </div>
        )}
      </div>
      {issues.length > 0 && (
        <ul class="settings-issues">
          {issues.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
