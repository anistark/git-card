// resvg (the PNG renderer) reads class selectors in <style>, but not custom properties, color-mix(),
// @media or @keyframes. This turns the card CSS into plain declarations with every color resolved.

import { CARD_CSS, TOKENS } from '../cards/style';

type RGBA = [number, number, number, number];

function parseColor(value: string): RGBA | null {
  const v = value.trim();
  const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
  }
  const rgb = v.match(/^rgba?\(([^)]+)\)$/i);
  if (rgb) {
    const [r, g, b, a = '1'] = rgb[1].split(/[\s,/]+/).filter(Boolean);
    return [Number(r), Number(g), Number(b), Number(a)];
  }
  return null;
}

function toCss([r, g, b, a]: RGBA): string {
  const hex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  return a >= 1 ? `#${hex(r)}${hex(g)}${hex(b)}` : `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;
}

/** Split on commas that are not inside parentheses. */
function splitArgs(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') depth--;
    else if (s[i] === ',' && depth === 0) {
      out.push(s.slice(start, i).trim());
      start = i + 1;
    }
  }
  out.push(s.slice(start).trim());
  return out;
}

/** Find the innermost fn( ... ) call and return its span, or null. */
function innermost(s: string, fn: string): { start: number; end: number; args: string } | null {
  const at = s.lastIndexOf(`${fn}(`);
  if (at < 0) return null;
  let depth = 0;
  for (let i = at + fn.length; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')' && --depth === 0) return { start: at, end: i + 1, args: s.slice(at + fn.length + 1, i) };
  }
  return null;
}

function mix(args: string): string {
  // color-mix(in srgb, A p%, B q%) with either percentage optional.
  const [, a, b] = splitArgs(args);
  const part = (x: string) => {
    const m = x.match(/^(.*?)\s+([\d.]+)%$/);
    return m ? { color: parseColor(m[1]), pct: Number(m[2]) } : { color: parseColor(x), pct: null };
  };
  const pa = part(a);
  const pb = part(b);
  if (!pa.color || !pb.color) return 'transparent';
  const wa = pa.pct ?? (pb.pct != null ? 100 - pb.pct : 50);
  const t = wa / 100;
  const out = pa.color.map((c, i) => c * t + pb.color![i] * (1 - t)) as RGBA;
  return toCss(out);
}

function declarations(block: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const decl of block.split(';')) {
    const i = decl.indexOf(':');
    if (i > 0) map.set(decl.slice(0, i).trim(), decl.slice(i + 1).trim());
  }
  return map;
}

/** Remove @-rule blocks (with nested braces) from a stylesheet. */
function stripAtRules(css: string): string {
  let out = '';
  let i = 0;
  while (i < css.length) {
    if (css[i] === '@') {
      let j = css.indexOf('{', i);
      let depth = 0;
      for (; j < css.length; j++) {
        if (css[j] === '{') depth++;
        else if (css[j] === '}' && --depth === 0) break;
      }
      i = j + 1;
      continue;
    }
    out += css[i++];
  }
  return out;
}

export function flattenCss(theme: 'dark' | 'light' = 'dark', css = CARD_CSS): string {
  const vars = declarations(TOKENS[theme]);
  // Custom properties declared inside the card CSS itself, like the --l0..--l5 level ramp.
  for (const [, body] of css.matchAll(/\{([^{}]*--[a-z0-9-]+\s*:[^{}]*)\}/gi)) {
    for (const [k, v] of declarations(body)) if (k.startsWith('--')) vars.set(k, v);
  }

  const resolve = (value: string, seen = 0): string => {
    let v = value;
    for (let call = innermost(v, 'var'); call && seen < 50; call = innermost(v, 'var'), seen++) {
      const [name, ...fallback] = splitArgs(call.args);
      const replacement = vars.has(name) ? resolve(vars.get(name)!, seen + 1) : fallback.join(',');
      v = v.slice(0, call.start) + replacement + v.slice(call.end);
    }
    for (let call = innermost(v, 'color-mix'); call; call = innermost(v, 'color-mix')) {
      v = v.slice(0, call.start) + mix(call.args) + v.slice(call.end);
    }
    return v;
  };

  return stripAtRules(css)
    .replace(/\{([^{}]*)\}/g, (_, body: string) => {
      const kept = [...declarations(body)]
        .filter(([k]) => !k.startsWith('--') && !k.startsWith('animation') && !k.startsWith('transform'))
        .map(([k, v]) => `${k}:${resolve(v)}`);
      return `{${kept.join(';')}}`;
    })
    .replace(/[^{}]+\{\}/g, '') // rules left empty
    .replace(/\s+/g, ' ')
    .trim();
}
