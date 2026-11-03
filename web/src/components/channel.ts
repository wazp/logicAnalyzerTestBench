/** CSS color for an analyzer channel, shared by the pin diagram and waveforms. */
export function channelColor(channel: number): string {
  return `var(--ch${((channel - 1) % 10) + 1})`;
}
