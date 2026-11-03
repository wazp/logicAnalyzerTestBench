import { PinDiagram } from '../components/PinDiagram';
import { channelColor } from '../components/channel';
import { lessons } from '../lessons/lessons';
import { analyzer } from '../model/analyzer';
import { formatHz, formatPercent, formatTime } from '../model/format';
import { physicalPinForGpio } from '../model/pico';
import { channelForGpio, clkSysHz, periodNs, signals } from '../model/signals';

export function HomePage() {
  const first = lessons[0];
  return (
    <article class="home">
      <header>
        <div class="eyebrow">Start here</div>
        <h1>Learn your logic analyzer</h1>
        <p class="lede">
          This Pico 2 W is outputting ten known test signals right now. Follow the lessons to learn how to set up,
          trigger and read captures, or run the checks to verify a hand-built analyzer.
        </p>
      </header>

      <section>
        <h2>What you need</h2>
        <ul>
          <li>This Pico 2 W, powered over USB. The signals start as soon as it boots.</li>
          <li>
            A {analyzer.name} with its {analyzer.appName} desktop app. The steps follow the app's{' '}
            {analyzer.docsVersion} documentation, so menus in newer versions may be named slightly differently.
          </li>
          <li>Jumper wires or probe clips.</li>
        </ul>
      </section>

      <section class="callout">
        <h2>Before you connect anything</h2>
        <ul>
          <li>
            Set the analyzer <strong>VREF switch to 3.3V</strong>. The Pico outputs 3.3V logic.
          </li>
          <li>
            Always connect <strong>ground first</strong>: analyzer GND to a Pico GND pin (3, 8 or 13).
          </li>
          <li>
            Only connect Pico pins to analyzer <strong>inputs</strong>. Never to 5V, another output or ground.
          </li>
          <li>
            Channel numbers in the app start at 1, so <strong>GPn goes to CH(n+1)</strong>: GP0 to CH1, GP9 to CH10.
          </li>
        </ul>
      </section>

      <section>
        <h2>The test signals</h2>
        <div class="wiring-grid">
          <PinDiagram gpios={signals.map((s) => s.gpio)} />
          <div class="table-scroll">
          <table class="signals-table">
            <thead>
              <tr>
                <th>Channel</th>
                <th>Pico</th>
                <th>Signal</th>
                <th>Frequency</th>
                <th>Duty</th>
              </tr>
            </thead>
            <tbody>
              {signals.map((s) => {
                const ch = channelForGpio(s.gpio);
                return (
                  <tr key={s.gpio}>
                    <td class="nowrap">
                      <span class="ch-dot" style={{ background: channelColor(ch) }} />
                      CH{ch}
                    </td>
                    <td class="nowrap">
                      GP{s.gpio} <span class="muted">pin {physicalPinForGpio(s.gpio)}</span>
                    </td>
                    <td>{s.name}</td>
                    <td>{s.kind === 'pattern' ? `${formatTime(periodNs(s))} frame` : formatHz(s.actualHz)}</td>
                    <td>{formatPercent(s.dutyPercent)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
        <p class="muted small">
          All values are exact multiples of the Pico's {formatHz(clkSysHz)} clock. Accuracy is that of its crystal
          (tens of ppm) with no jitter, so the Pico is a good reference for checking the analyzer.
        </p>
      </section>

      <nav class="cta">
        <a class="button" href={`#/lesson/${first.id}`}>
          Start with {first.title} →
        </a>
        <a class="button secondary" href="#/lesson/sanity-check">
          Verify my analyzer
        </a>
      </nav>
    </article>
  );
}
