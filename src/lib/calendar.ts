// The contribution calendar, from whichever public source answers. GitHub's own calendar and GraphQL API
// cannot be read from a browser without a token, so it comes from third parties, tried in order:
//
//   github-contributions-api.jogruber.de    JSON mirror, fast and usually fresh
//   gh-calendar.rschristian.dev             independent JSON mirror on another host
//   r.jina.ai                               GitHub's own calendar HTML, through a reader proxy
//   api.cors.lol                            the same HTML through a CORS proxy, cached and strict on rate
//
// Each source gets up to three attempts for failures that can pass (timeouts, 5xx, 429), then the next one
// takes over. A source that gave up recently is tried last for a while, so the next visit does not wait on it.

export interface CalendarDay {
  date: string;
  count: number;
}

export interface Calendar {
  /** Contributions in the last year, when the source states it. Otherwise the days are summed. */
  total: number | null;
  contributions: CalendarDay[];
  /** Host that served it, shown to the visitor. */
  source: string;
}

export interface CalendarAttempt {
  source: string;
  /** 1-based position of the source in the order tried, out of `sources`. */
  index: number;
  sources: number;
  attempt: number;
  attempts: number;
}

export interface CalendarOptions {
  signal?: AbortSignal;
  fetch?: typeof fetch;
  onAttempt?: (a: CalendarAttempt) => void;
  /** Per attempt. */
  timeoutMs?: number;
  /** Pause before the second attempt, doubled before the third. */
  retryDelayMs?: number;
  attempts?: number;
  /** Injected in tests. */
  sources?: CalendarSource[];
}

export interface CalendarSource {
  /** Host name, used as the id and shown to the visitor. */
  host: string;
  url: (login: string) => string;
  headers?: Record<string, string>;
  parse: (body: string) => { total: number | null; contributions: CalendarDay[] };
}

const ATTEMPTS = 3;
const TIMEOUT_MS = 10_000;
const RETRY_DELAY_MS = 1_000;
const DOWN_KEY = 'gc:calendar-down:v1';
const DOWN_FOR_MS = 15 * 60 * 1000;

const githubPage = (login: string) => `https://github.com/users/${login}/contributions`;

export const CALENDAR_SOURCES: CalendarSource[] = [
  {
    host: 'github-contributions-api.jogruber.de',
    url: (login) => `https://github-contributions-api.jogruber.de/v4/${login}?y=last`,
    parse: (body) => {
      const data = JSON.parse(body) as { total?: { lastYear?: number }; contributions?: CalendarDay[] };
      return { total: data.total?.lastYear ?? null, contributions: days(data.contributions) };
    },
  },
  {
    host: 'gh-calendar.rschristian.dev',
    url: (login) => `https://gh-calendar.rschristian.dev/user/${login}`,
    parse: (body) => {
      const data = JSON.parse(body) as { total?: number; contributions?: CalendarDay[][] };
      return { total: data.total ?? null, contributions: days(data.contributions?.flat()) };
    },
  },
  {
    host: 'r.jina.ai',
    url: (login) => `https://r.jina.ai/${githubPage(login)}`,
    headers: { 'x-respond-with': 'html' },
    parse: (body) => ({ total: null, contributions: parseGitHubCalendar(body) }),
  },
  {
    host: 'api.cors.lol',
    url: (login) => `https://api.cors.lol/?url=${encodeURIComponent(githubPage(login))}`,
    parse: (body) => ({ total: null, contributions: parseGitHubCalendar(body) }),
  },
];

/** Keeps well-formed days only. */
function days(list: unknown): CalendarDay[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter((d): d is CalendarDay => !!d && /^\d{4}-\d\d-\d\d$/.test(d.date) && Number.isFinite(d.count))
    .map((d) => ({ date: d.date, count: d.count }));
}

const attr = (tag: string, name: string) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];

/**
 * Reads GitHub's calendar fragment: each day is a <td data-date id>, and its count is in the text of the
 * <tool-tip for=id> next to it, like "14 contributions on October 5th." or "No contributions on ...".
 */
export function parseGitHubCalendar(html: string): CalendarDay[] {
  const counts = new Map<string, number>();
  for (const [, open, text] of html.matchAll(/(<tool-tip\b[^>]*>)([^<]*)<\/tool-tip>/g)) {
    const id = attr(open, 'for');
    const n = text.trim().match(/^(No|[\d,]+) contributions?\b/);
    if (id && n) counts.set(id, n[1] === 'No' ? 0 : Number(n[1].replace(/,/g, '')));
  }
  const out: CalendarDay[] = [];
  for (const [tag] of html.matchAll(/<td\b[^>]*\sdata-date="[^"]*"[^>]*>/g)) {
    const date = attr(tag, 'data-date');
    const count = counts.get(attr(tag, 'id') ?? '');
    if (date && count !== undefined) out.push({ date, count });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** A failure another attempt at the same source might get past. */
class Transient extends Error {}

async function attempt(source: CalendarSource, login: string, opts: CalendarOptions): Promise<Calendar> {
  const timeout = AbortSignal.timeout(opts.timeoutMs ?? TIMEOUT_MS);
  const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
  let res: Response;
  try {
    res = await (opts.fetch ?? fetch)(source.url(login), { signal, headers: source.headers });
  } catch (err) {
    if (opts.signal?.aborted) throw err;
    throw new Transient(timeout.aborted ? 'timed out' : 'unreachable');
  }
  if (res.status === 429 || res.status >= 500) throw new Transient(`answered ${res.status}`);
  if (!res.ok) throw new Error(`answered ${res.status}`);
  let parsed: ReturnType<CalendarSource['parse']>;
  try {
    parsed = source.parse(await res.text());
  } catch {
    throw new Error('sent something unreadable');
  }
  // Every account has a year of days, zero or not. None at all means the source did not find the calendar.
  if (!parsed.contributions.length) throw new Error('had no calendar');
  return { ...parsed, source: source.host };
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => (clearTimeout(t), reject(signal.reason)), { once: true });
  });

/** Tries each source in turn, up to three attempts each, and resolves with the first calendar found. */
export async function fetchCalendar(login: string, opts: CalendarOptions = {}): Promise<Calendar> {
  const attempts = opts.attempts ?? ATTEMPTS;
  const down = recentlyDown();
  // Stable sort: sources that gave up in the last few minutes move to the back, in their usual order.
  const order = [...(opts.sources ?? CALENDAR_SOURCES)].sort((a, b) => Number(down.has(a.host)) - Number(down.has(b.host)));
  const failures: string[] = [];

  for (const [i, source] of order.entries()) {
    for (let n = 1; n <= attempts; n++) {
      opts.onAttempt?.({ source: source.host, index: i + 1, sources: order.length, attempt: n, attempts });
      try {
        const calendar = await attempt(source, login, opts);
        markDown(source.host, false);
        return calendar;
      } catch (err) {
        if (opts.signal?.aborted) throw err;
        const last = n === attempts || !(err instanceof Transient);
        if (last) {
          failures.push(`${source.host} ${(err as Error).message}`);
          markDown(source.host, true);
          break;
        }
        await sleep((opts.retryDelayMs ?? RETRY_DELAY_MS) * 2 ** (n - 1), opts.signal);
      }
    }
  }
  throw new Error(`No calendar source answered: ${failures.join(', ')}.`);
}

function recentlyDown(): Set<string> {
  try {
    const map = JSON.parse(localStorage.getItem(DOWN_KEY) ?? '{}') as Record<string, number>;
    return new Set(Object.keys(map).filter((host) => Date.now() - map[host] < DOWN_FOR_MS));
  } catch {
    return new Set();
  }
}

function markDown(host: string, down: boolean) {
  try {
    const map = JSON.parse(localStorage.getItem(DOWN_KEY) ?? '{}') as Record<string, number>;
    if (down) map[host] = Date.now();
    else delete map[host];
    localStorage.setItem(DOWN_KEY, JSON.stringify(map));
  } catch {
    // Storage blocked or unavailable (tests, Node). Every visit then starts from the first source.
  }
}
