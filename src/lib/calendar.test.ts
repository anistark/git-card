import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchCalendar, parseGitHubCalendar, type CalendarAttempt, type CalendarSource } from './calendar';

const td = (date: string, id: string) =>
  `<td tabindex="0" data-date="${date}" id="${id}" data-level="1" class="ContributionCalendar-day"></td>`;
const tip = (id: string, text: string) => `<tool-tip id="t-${id}" for="${id}" popover="manual" class="sr-only">${text}</tool-tip>`;

describe('parseGitHubCalendar', () => {
  it('pairs each day with the count in its tooltip', () => {
    const html = [
      td('2026-09-28', 'd-1'),
      td('2026-09-27', 'd-0'),
      td('2026-09-29', 'd-2'),
      td('2026-09-30', 'd-3'), // no tooltip: skipped rather than guessed
      tip('d-0', 'No contributions on September 27th.'),
      tip('d-1', '1 contribution on September 28th.'),
      tip('d-2', '1,204 contributions on September 29th.'),
    ].join('\n');
    expect(parseGitHubCalendar(html)).toEqual([
      { date: '2026-09-27', count: 0 },
      { date: '2026-09-28', count: 1 },
      { date: '2026-09-29', count: 1204 },
    ]);
  });

  it('finds nothing in a page without a calendar', () => {
    expect(parseGitHubCalendar('<html><body>Rate limited</body></html>')).toEqual([]);
  });
});

describe('fetchCalendar', () => {
  const DAYS = [{ date: '2026-09-30', count: 4 }];
  const source = (host: string): CalendarSource => ({
    host,
    url: (login) => `https://${host}/${login}`,
    parse: (body) => ({ total: null, contributions: JSON.parse(body).days ?? [] }),
  });
  const sources = [source('one.test'), source('two.test'), source('three.test')];

  /** A fake fetch answering per host from a list of statuses, the last one repeating. Records every call. */
  function fake(plan: Record<string, (number | 'ok' | 'stall')[]>) {
    const calls: string[] = [];
    const fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const host = new URL(String(input)).host;
      calls.push(host);
      const steps = plan[host] ?? [404];
      const step = steps[Math.min(calls.filter((h) => h === host).length, steps.length) - 1];
      if (step === 'stall') {
        return new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal!.reason)));
      }
      return Promise.resolve(step === 'ok' ? new Response(JSON.stringify({ days: DAYS })) : new Response('{}', { status: step }));
    };
    return { fetch: fetch as typeof globalThis.fetch, calls };
  }

  const opts = { sources, retryDelayMs: 0, timeoutMs: 30 };

  it('uses the first source when it answers', async () => {
    const { fetch, calls } = fake({ 'one.test': ['ok'] });
    expect(await fetchCalendar('octo', { ...opts, fetch })).toEqual({ total: null, contributions: DAYS, source: 'one.test' });
    expect(calls).toEqual(['one.test']);
  });

  it('retries a failure that can pass, three attempts, then switches to the next source', async () => {
    const { fetch, calls } = fake({ 'one.test': [503, 'stall', 429], 'two.test': ['ok'] });
    const attempts: CalendarAttempt[] = [];
    const cal = await fetchCalendar('octo', { ...opts, fetch, onAttempt: (a) => attempts.push(a) });
    expect(cal.source).toBe('two.test');
    expect(calls).toEqual(['one.test', 'one.test', 'one.test', 'two.test']);
    expect(attempts.map((a) => `${a.index}/${a.sources}:${a.attempt}/${a.attempts}`)).toEqual(['1/3:1/3', '1/3:2/3', '1/3:3/3', '2/3:1/3']);
  });

  it('recovers on a retry without switching', async () => {
    const { fetch, calls } = fake({ 'one.test': [502, 'ok'] });
    expect((await fetchCalendar('octo', { ...opts, fetch })).source).toBe('one.test');
    expect(calls).toEqual(['one.test', 'one.test']);
  });

  it('switches at once on an answer that will not change, like a 404 or an empty calendar', async () => {
    const { fetch, calls } = fake({ 'one.test': [404], 'two.test': [200], 'three.test': ['ok'] });
    expect((await fetchCalendar('octo', { ...opts, fetch })).source).toBe('three.test');
    expect(calls).toEqual(['one.test', 'two.test', 'three.test']);
  });

  it('fails with every reason when no source answers', async () => {
    const { fetch } = fake({ 'one.test': [500], 'two.test': [404], 'three.test': ['stall'] });
    await expect(fetchCalendar('octo', { ...opts, fetch })).rejects.toThrow(
      'No calendar source answered: one.test answered 500, two.test answered 404, three.test timed out.',
    );
  });

  it('stops when the visitor leaves', async () => {
    const ctrl = new AbortController();
    const { fetch, calls } = fake({ 'one.test': ['stall'] });
    const pending = fetchCalendar('octo', { ...opts, timeoutMs: 10_000, fetch, signal: ctrl.signal });
    ctrl.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(calls).toEqual(['one.test']);
  });

  describe('with storage', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('tries a source that recently gave up last', async () => {
      const store = new Map<string, string>();
      vi.stubGlobal('localStorage', {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, v),
      });
      await fetchCalendar('octo', { ...opts, fetch: fake({ 'one.test': [404], 'two.test': ['ok'] }).fetch });

      const { fetch, calls } = fake({ 'one.test': ['ok'], 'two.test': ['ok'] });
      expect((await fetchCalendar('octo', { ...opts, fetch })).source).toBe('two.test');
      expect(calls).toEqual(['two.test']);
    });
  });
});
