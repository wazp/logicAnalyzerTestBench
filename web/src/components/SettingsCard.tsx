import { shortLabel } from '../model/board';
import { captureWindow, describeTrigger, samplesNeeded, validateSettings, type CaptureSettings } from '../model/capture';
import { formatCount, formatRate, formatTime } from '../model/format';

/** What to set up in the analyzer software, plus what it adds up to. */
export function SettingsCard({ settings }: { settings: CaptureSettings }) {
  const w = captureWindow(settings);
  const issues = validateSettings(settings);
  return (
    <div class="settings-card">
      <div class="settings-title">Capture settings</div>
      <dl>
        <dt>Record</dt>
        <dd>
          {settings.gpios.map((g, i) => (
            <span key={g} class="nowrap">
              GP{g} <span class="muted">({shortLabel(g)})</span>
              {i < settings.gpios.length - 1 ? ', ' : ''}
            </span>
          ))}
        </dd>
        <dt>Sample rate</dt>
        <dd>
          {formatRate(settings.sampleRateHz)} <span class="muted">or faster</span>
        </dd>
        <dt>Length</dt>
        <dd>
          {formatTime(w.postNs)} after the trigger
          {w.preNs > 0 && <span class="muted">, {formatTime(w.preNs)} before if your analyzer keeps it</span>}
        </dd>
        <dt>Trigger</dt>
        <dd>{describeTrigger(settings.trigger)}</dd>
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
