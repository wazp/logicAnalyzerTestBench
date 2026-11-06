import { PinDiagram } from '../components/PinDiagram';
import { useDeviceStatus } from '../components/useDeviceStatus';
import { Zoomable } from '../components/Zoomable';
import { lessons } from '../lessons';
import { allSignalGpios, signalColor } from '../model/board';
import { minimumAnalyzer } from '../model/capture';
import { formatHz, formatPercent, formatRate, formatTime } from '../model/format';
import { physicalPinForGpio } from '../model/pico';
import { frameMs, protocolData as d, protocolPins, type ProtocolId } from '../model/protocols';
import { bounceTiming, clkSysHz, periodNs, signals } from '../model/signals';

const protocolDetail: Record<ProtocolId, string> = {
  uart: `${d.uart.baud} baud, 8N1`,
  i2c: `${formatHz(d.i2c.clockHz)}, sensor at 0x${d.i2c.address.toString(16).toUpperCase()}`,
  spi: `${formatHz(d.spi.clockHz)}, mode 0, flash ID read`,
  ws2812: `${d.ws2812.leds} LEDs, ${formatHz(1e9 / d.ws2812.bitNs)}`,
  onewire: 'DS18B20, standard speed',
  ir: 'NEC remote, as an IR receiver outputs it',
  quadrature: `rotary encoder, ${d.quadrature.stepUs} µs per step`,
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
  return (
    <article class="home">
      {onHotspot && (
        <a class="wifi-banner" href="#/wifi">
          <strong>Use the guide from your computer:</strong> connect the test bench to your Wi-Fi →
        </a>
      )}
      <header>
        <div class="eyebrow">Start here</div>
        <h1>Learn your logic analyzer</h1>
        <p class="lede">
          This Pico 2 W is outputting {allSignalGpios.length} known test signals right now: square waves and pulses to
          learn the basics, a push button that bounces, and the protocols you will meet on real boards (UART, I²C, SPI,
          WS2812, 1-Wire, IR, a rotary encoder). Follow the lessons to learn how to set up, trigger, decode and read captures, or run the
          checks to verify an analyzer.
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
            <h3>Protocols</h3>
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
          </div>
        </div>
        <p class="muted small">
          All timing comes from the Pico's {formatHz(clkSysHz)} clock: accuracy is that of its crystal (tens of ppm)
          with no jitter, so the Pico is a good reference for checking an analyzer. The protocol traffic repeats every{' '}
          {frameMs} ms, and every protocol simulates both sides, so no other device is needed.
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
