import type { ComponentChildren } from 'preact';

/** Renders lesson text with `code` and **bold** markers. */
export function Rich({ text }: { text: string }) {
  const parts: ComponentChildren[] = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const token = m[0];
    parts.push(token.startsWith('`') ? <code>{token.slice(1, -1)}</code> : <strong>{token.slice(2, -2)}</strong>);
    last = m.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
