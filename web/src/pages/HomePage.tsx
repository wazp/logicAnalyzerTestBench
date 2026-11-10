import { PinDiagram } from '../components/PinDiagram';
import { useDeviceStatus } from '../components/useDeviceStatus';
import { useProgress } from '../components/useProgress';
import { Zoomable } from '../components/Zoomable';
import { lessons, nextLesson, trackLabel } from '../lessons';
import { allSignalGpios, signalColor } from '../model/board';
import { minimumAnalyzer } from '../model/capture';
import { faultsGpio } from '../model/faults';
import { formatHz, formatPercent, formatRate, formatTime } from '../model/format';
import { physicalPinForGpio } from '../model/pico';
import { frameMs, protocolData as d, protocolPins, type ProtocolId } from '../model/protocols';
import { bounceTiming, clkSysHz, periodNs, signals } from '../model/signals';
import { frameHz, lineHz, videoData as v, videoPins, type VideoPart } from '../model/video';

const protocolDetail: Record<ProtocolId, string> = {
  uart: `${d.uart.baud} baud, 8N1`,
  i2c: `${formatHz(d.i2c.clockHz)}, sensor at 0x${d.i2c.address.toString(16).toUpperCase()}`,
  spi: `${formatHz(d.spi.clockHz)}, mode 0, flash ID read`,
  ws2812: `${d.ws2812.leds} LEDs, ${formatHz(1e9 / d.ws2812.bitNs)}`,
  onewire: 'DS18B20, standard speed',
  ir: 'NEC remote, as an IR receiver outputs it',
  quadrature: `rotary encoder, ${d.quadrature.stepUs} µs per step`,
};

const videoDetail: Record<VideoPart, string> = {
  vga: `${v.vga.h.visible}x${v.vga.v.visible}, ${formatHz(lineHz)} lines, ${formatHz(frameHz)} frames`,
  nes: 'controller read once per video frame',
  ps2: `keyboard at ${formatHz(v.ps2.clockHz)}, presses and releases a key`,
};

function PinCell({ gpio }: { gpio: number }) {
  return (
    <td class="nowrap">
      <span class="ch-dot" style={{ background: signalColor(gpio) }} />
      GP{gpio} <span class="muted">pin {physicalPinForGpio(gpio)}</span>
    </td>
  );
}

export function HomePage() {
  const first = lessons[0];
  const firstProtocol = lessons.find((l) => l.track === 'protocols');
  const [device] = useDeviceStatus();
  const onHotspot = !device.loading && device.status?.mode === 'setup';
  const [done] = useProgress();
  // Only once the reader has marked something: before that, "Start with" below is the way in.
  const next = done.size > 0 ? nextLesson(done) : undefined;
  return (
    <article class="home">
      {onHotspot && (
        <a class="home-banner" href="#/wifi">
          <strong>Use the guide from your computer:</strong> connect the test bench to your Wi-Fi →
        </a>
      )}
      {next && (
        <a class="home-banner" href={`#/lesson/${next.id}`}>
          <strong>Continue where you left off:</strong> {next.title}{' '}
          <span class="muted">({trackLabel(next.track)})</span> →
        </a>
      )}
      <header>
        <div class="eyebrow">Start here</div>
        <h1>Learn your logic analyzer</h1>
        <p class="lede">
          This Pico 2 W is outputting {allSignalGpios.length} known test signals right now: square waves and pulses to
          learn the basics, a push button that bounces, and the protocols you will meet on real boards (UART, I²C, SPI,
          WS2812, 1-Wire, IR, a rotary encoder). Other presets swap the protocols for a VGA picture, an NES
          controller and a PS/2 keyboard, or for the same buses with realistic mistakes to find. Follow the lessons to learn how to set up, trigger, decode and read
          captures, or run the checks to verify an analyzer.
        </p>
      </header>

      <section>
        <h2>What you need</h2>
        <ul>
          <li>This Pico 2 W, powered over USB. The signals start as soon as it boots.</li>
          <li>
            Any logic analyzer that reads 3.3V logic. {minimumAnalyzer.inputs} inputs and{' '}
            {formatRate(minimumAnalyzer.maxSampleRateHz)} are enough for every lesson, so even the cheapest USB
            analyzers work.
          </li>
          <li>
            Its software: the analyzer's own app, or{' '}
            <a href="https://sigrok.org/wiki/PulseView">PulseView</a>, which is free and supports many analyzers. The
            lessons describe what to set, not where the buttons are.
          </li>
          <li>Jumper wires or probe clips.</li>
        </ul>
      </section>

      <section class="callout">
        <h2>Before you connect anything</h2>
        <ul>
          <li>
            Always connect <strong>ground first</strong>: analyzer GND to any Pico GND pin. They are all the same ground.
          </li>
          <li>
            If your analyzer has an input voltage or threshold setting, choose <strong>3.3V</strong> logic.
          </li>
          <li>
            Only connect Pico pins to analyzer <strong>inputs</strong>. Never to 5V, another output, ground, or a real
            device.
          </li>
          <li>
            This guide names signals by <strong>Pico pin</strong> (GP0, GP10...). Analyzers number their inputs in
            different ways, so connect each pin to any free input and give it the GP name in your software.
          </li>
        </ul>
      </section>

      <section>
        <h2>The test signals</h2>
        <div class="wiring-grid">
          <Zoomable title="The test signals">
            <PinDiagram gpios={allSignalGpios} />
          </Zoomable>
          <div>
            <h3>Basics</h3>
            <div class="table-scroll">
              <table class="signals-table">
                <thead>
                  <tr>
                    <th>Pico</th>
                    <th>Signal</th>
                    <th>Frequency</th>
                    <th>Duty</th>
                  </tr>
                </thead>
                <tbody>
                  {signals.map((s) => (
                    <tr key={s.gpio}>
                      <PinCell gpio={s.gpio} />
                      <td>{s.name}</td>
                      <td>
                        {s.kind === 'pattern'
                          ? `${formatTime(periodNs(s))} frame`
                          : s.kind === 'bounce'
                            ? `pressed every ${formatTime(periodNs(s))}`
                            : formatHz(s.actualHz)}
                      </td>
                      <td>
                        {s.kind === 'bounce'
                          ? `held ${formatTime(bounceTiming(s).heldNs)}`
                          : formatPercent(s.dutyPercent)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3>Protocols (the default preset)</h3>
            <div class="table-scroll">
              <table class="signals-table">
                <thead>
                  <tr>
                    <th>Pico</th>
                    <th>Signal</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {protocolPins.map((p) => (
                    <tr key={p.gpio}>
                      <PinCell gpio={p.gpio} />
                      <td>{p.name}</td>
                      <td class="muted">{protocolDetail[p.protocol]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3>Video and input (another preset)</h3>
            <p class="muted small">
              The same pins, switched under <a href="#/preset">Settings, Signal preset</a>. GP
              {v.unusedGpios[0]}-GP{v.unusedGpios[v.unusedGpios.length - 1]} are held low in this preset.
            </p>
            <div class="table-scroll">
              <table class="signals-table">
                <thead>
                  <tr>
                    <th>Pico</th>
                    <th>Signal</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {videoPins.map((p) => (
                    <tr key={p.gpio}>
                      <PinCell gpio={p.gpio} />
                      <td>{p.name}</td>
                      <td class="muted">{videoDetail[p.part]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3>Faults (another preset)</h3>
            <p class="muted small">
              The same buses on the same pins, each with realistic mistakes next to a good transaction, plus an
              interrupt line with glitches on GP{faultsGpio('irq', 'irq')}. See the <a href="#/preset">preset page</a>{' '}
              for the full list and the Find the bug lessons.
            </p>
          </div>
        </div>
        <p class="muted small">
          All timing comes from the Pico's {formatHz(clkSysHz)} clock: accuracy is that of its crystal (tens of ppm)
          with no jitter, so the Pico is a good reference for checking an analyzer. The protocol traffic repeats every{' '}
          {frameMs} ms, and every protocol simulates both sides, so no other device is needed. GP10-GP22 play one
          preset at a time; switching restarts the board so everything starts in step again.
        </p>
      </section>

      <nav class="cta">
        <a class="button" href={`#/lesson/${first.id}`}>
          Start with {first.title} →
        </a>
        {firstProtocol && (
          <a class="button secondary" href={`#/lesson/${firstProtocol.id}`}>
            Jump to protocols
          </a>
        )}
        <a class="button secondary" href="#/lesson/sanity-check">
          Verify my analyzer
        </a>
      </nav>
    </article>
  );
}
