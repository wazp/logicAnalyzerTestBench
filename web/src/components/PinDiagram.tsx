import { useContext } from 'preact/hooks';
import { shortLabel, signalColor } from '../model/board';
import { headerPins, groundPins, type HeaderPin } from '../model/pico';
import { PresetContext } from './PresetContext';

// Top view of the Pico 2 W: pins 1-20 down the left edge, 21-40 up the right.
const ROW = 17;
const TOP = 46;
const BOARD_X = 130;
const BOARD_W = 120;
const W = BOARD_X * 2 + BOARD_W;
const H = TOP + 20 * ROW + 14;

function position(pin: number): { x: number; y: number; left: boolean } {
  if (pin <= 20) return { x: BOARD_X + 10, y: TOP + (pin - 1) * ROW, left: true };
  return { x: BOARD_X + BOARD_W - 10, y: TOP + (40 - pin) * ROW, left: false };
}

/** The Pico header with the pins used by a lesson highlighted and labeled with their signal. */
export function PinDiagram({ gpios }: { gpios: number[] }) {
  const preset = useContext(PresetContext);
  const used = new Set(gpios);
  const pinClass = (p: HeaderPin) => {
    if (p.gpio !== undefined && used.has(p.gpio)) return 'pin used';
    if (groundPins.includes(p.pin)) return 'pin gnd';
    return 'pin';
  };

  return (
    <svg class="pin-diagram" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Pico 2 W wiring diagram">
      <rect class="board" x={BOARD_X} y={TOP - 30} width={BOARD_W} height={H - TOP + 22} rx="8" />
      <rect class="usb" x={BOARD_X + BOARD_W / 2 - 18} y={TOP - 40} width="36" height="16" rx="3" />
      <text class="board-label" x={BOARD_X + BOARD_W / 2} y={TOP + 9.5 * ROW} text-anchor="middle">
        Pico 2 W
      </text>
      <text class="board-sub" x={BOARD_X + BOARD_W / 2} y={TOP + 9.5 * ROW + 14} text-anchor="middle">
        top view
      </text>
      {headerPins.map((p) => {
        const { x, y, left } = position(p.pin);
        const isUsed = p.gpio !== undefined && used.has(p.gpio);
        const isGnd = groundPins.includes(p.pin);
        const color = isUsed ? signalColor(p.gpio!) : undefined;
        const labelX = left ? x - 12 : x + 12;
        const anchor = left ? 'end' : 'start';
        return (
          <g key={p.pin} class={pinClass(p)}>
            <circle cx={x} cy={y} r="5" style={color ? { fill: color } : undefined} />
            <text class="pin-num" x={left ? x + 10 : x - 10} y={y + 3.5} text-anchor={left ? 'start' : 'end'}>
              {p.pin}
            </text>
            <text class="pin-label" x={labelX} y={y + 4} text-anchor={anchor}>
              {p.label}
            </text>
            {isUsed && (
              <g>
                <rect
                  class="ch-badge"
                  x={left ? labelX - 100 : labelX + 48}
                  y={y - 8}
                  width="52"
                  height="16"
                  rx="8"
                  style={{ fill: color }}
                />
                <text class="ch-badge-text" x={left ? labelX - 74 : labelX + 74} y={y + 4} text-anchor="middle">
                  {shortLabel(p.gpio!, preset)}
                </text>
              </g>
            )}
            {isGnd && (
              <text class="gnd-hint" x={left ? labelX - 72 : labelX + 72} y={y + 4} text-anchor="middle">
                GND
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
