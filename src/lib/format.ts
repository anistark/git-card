// Plain text helpers shared by the SVG cards and the client-side 3D view. No React in here.

/** Compact number: 1234 → 1.2k */
export function fmt(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}m`;
}

/** Monospace glyphs are ~0.6em wide, so a character budget is exact enough for truncation. */
export function maxChars(width: number, fontSize: number): number {
  return Math.floor(width / (fontSize * 0.6));
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

export function wrap(text: string, max: number, lines: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= max || !line) {
      line = next;
      continue;
    }
    out.push(line);
    line = word;
  }
  if (line) out.push(line);
  if (out.length <= lines) return out.map((l) => truncate(l, max));
  const kept = out.slice(0, lines);
  kept[lines - 1] = truncate(`${kept[lines - 1]}…`, max);
  return kept.map((l) => truncate(l, max));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function monthName(date: string): string {
  return MONTHS[Number(date.slice(5, 7)) - 1];
}

export function shortDate(date: string): string {
  return `${monthName(date)} ${Number(date.slice(8, 10))}`;
}
