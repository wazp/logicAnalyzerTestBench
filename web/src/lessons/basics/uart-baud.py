#!/usr/bin/env python3
"""Estimate a UART bit time and baud rate from one signal in a VCD export.

Usage: python3 uart-baud.py capture.vcd SIGNAL_NAME
"""
import sys
from collections import Counter

UNIT_NS = {'s': 1e9, 'ms': 1e6, 'us': 1e3, 'ns': 1.0, 'ps': 1e-3, 'fs': 1e-6}


def edge_times(path, name):
    """Times (ns) at which the named 1-bit signal changes level."""
    tokens = open(path).read().split()
    scale, ident, now, level, edges = 1.0, None, 0.0, None, []
    for i, tok in enumerate(tokens):
        if tok == '$timescale':
            spec = ''.join(tokens[i + 1:tokens.index('$end', i)])
            number = spec.rstrip('fpnums')
            scale = float(number) * UNIT_NS[spec[len(number):]]
        elif tok == '$var' and tokens[i + 4] == name:
            ident = tokens[i + 3]
        elif tok.startswith('#'):
            now = int(tok[1:]) * scale
        elif ident and tok[0] in '01' and tok[1:] == ident:
            if level is not None and tok[0] != level:
                edges.append(now)
            level = tok[0]
    if ident is None:
        sys.exit(f'No signal named {name!r} in {path}')
    return edges


edges = edge_times(sys.argv[1], sys.argv[2])
widths = [b - a for a, b in zip(edges, edges[1:])]
if not widths:
    sys.exit('Fewer than two edges: nothing to measure')

print('Most common pulse widths:')
for w, n in Counter(round(w / 1000, 1) for w in widths).most_common(6):
    print(f'  {w:8.1f} us  x{n}')

# Every pulse is a whole number of bits. Guess the bit from the one-bit pulses (the shortest ones), then use
# all of them: total time / total bits is far more precise than any single pulse.
short = [w for w in widths if w < 1.5 * min(widths)]
guess = sum(short) / len(short)
bits = [round(w / guess) for w in widths]
keep = [(w, b) for w, b in zip(widths, bits) if 1 <= b <= 9]  # Longer stretches are idle time.
bit_ns = sum(w for w, _ in keep) / sum(b for _, b in keep)
print(f'Bit time {bit_ns / 1000:.3f} us from {len(keep)} pulses: about {1e9 / bit_ns:.0f} baud')
