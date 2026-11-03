import { analyzer, captureWindow, describeTrigger, modeFor, validateSettings, type CaptureSettings } from '../model/analyzer';
import { formatCount, formatRate, formatTime } from '../model/format';

function channelList(chs: number[]): string {
  const sorted = [...chs].sort((a, b) => a - b);
  const contiguous = sorted.every((c, i) => i === 0 || c === sorted[i - 1] + 1);
  return contiguous && sorted.length > 2 ? `${sorted[0]} to ${sorted[sorted.length - 1]}` : sorted.join(', ');
}

/** The settings to enter in the analyzer app, plus what they add up to. */
export function SettingsCard({ settings }: { settings: CaptureSettings }) {
  const w = captureWindow(settings);
  const mode = modeFor(settings.channels);
  const issues = validateSettings(settings);
  return (
    <div class="settings-card">
      <div class="settings-title">{analyzer.appName} settings</div>
      <dl>
        <dt>Channels</dt>
        <dd>{channelList(settings.channels)}</dd>
        <dt>Sample rate</dt>
        <dd>
          {formatRate(settings.sampleRateHz)} <span class="muted">({formatCount(settings.sampleRateHz)} Hz)</span>
        </dd>
        <dt>Pre-trigger</dt>
        <dd>{formatCount(settings.preSamples)} samples</dd>
        <dt>Post-trigger</dt>
        <dd>{formatCount(settings.postSamples)} samples</dd>
        <dt>Trigger</dt>
        <dd>{describeTrigger(settings.trigger)}</dd>
        {settings.burstCount && (
          <>
            <dt>Burst</dt>
            <dd>{settings.burstCount}</dd>
          </>
        )}
      </dl>
      <div class="settings-derived">
        <div>
          <span class="muted">Window</span> {formatTime(-w.preNs)} to +{formatTime(w.postNs)}
        </div>
        <div>
          <span class="muted">One sample</span> {formatTime(1e9 / settings.sampleRateHz)}
        </div>
        <div>
          <span class="muted">Buffer mode</span> channels up to {mode.maxChannel}, max {formatCount(mode.maxPostSamples)} post
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
