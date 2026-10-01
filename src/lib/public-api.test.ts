import { describe, expect, it } from 'vitest';
import { normalize } from './profile';
import { calendarWeeks, fetchSources, genuineCommits, PublicApiError, toRawUser, type PublicSources } from './public-api';

const NOW = new Date('2026-10-01T12:00:00Z');

const issue = (owner: string, repo: string, created = '2026-06-01T00:00:00Z') => ({
  repository_url: `https://api.github.com/repos/${owner}/${repo}`,
  created_at: created,
});
const commit = (owner: string, repo: string, type: 'User' | 'Organization' = 'Organization') => ({
  repository: { name: repo, private: false, owner: { login: owner, avatar_url: 'a', type } },
});

function sources(overrides: Partial<PublicSources> = {}): PublicSources {
  return {
    user: {
      login: 'octo',
      name: 'Octo',
      avatar_url: 'a',
      bio: null,
      location: null,
      company: null,
      blog: '',
      created_at: '2015-01-01T00:00:00Z',
      followers: 10,
      following: 1,
      public_repos: 3,
      type: 'User',
    },
    orgs: [{ login: 'acme', avatar_url: 'a' }],
    repos: {
      total_count: 2,
      items: [
        {
          name: 'big',
          description: null,
          html_url: 'u',
          stargazers_count: 90,
          forks_count: 2,
          pushed_at: '2026-01-01',
          language: 'Go',
          size: 100,
        },
        {
          name: 'small',
          description: null,
          html_url: 'u',
          stargazers_count: 5,
          forks_count: 0,
          pushed_at: '2026-01-01',
          language: null,
          size: 1,
        },
      ],
    },
    calendar: {
      total: { lastYear: 6 },
      contributions: [
        { date: '2026-09-26', count: 1 }, // Saturday
        { date: '2026-09-27', count: 2 }, // Sunday starts a new week
        { date: '2026-09-28', count: 3 },
        { date: '2026-10-05', count: 9 }, // in the future, dropped
      ],
    },
    commits: {
      total_count: 40,
      items: [
        commit('acme', 'api'),
        commit('acme', 'api'),
        commit('mirror-co', 'copy'),
        commit('octo', 'dotfiles', 'User'),
        commit('rando', 'fork', 'User'),
        commit('bigco', 'lib'),
      ],
    },
    pullRequests: {
      total_count: 120,
      items: [issue('bigco', 'lib'), issue('someone', 'tool'), issue('bigco', 'lib', '2024-01-01T00:00:00Z')],
    },
    reviews: { total_count: 7, items: [issue('acme', 'api')] },
    issues: { total_count: 2, items: [issue('unknown-co', 'thing')] },
    ownerTypes: { octo: 'User', acme: 'Organization', bigco: 'Organization', someone: 'User' },
    ...overrides,
  };
}

describe('calendarWeeks', () => {
  it('starts a new week on Sunday and records weekdays', () => {
    const weeks = calendarWeeks([
      { date: '2026-09-28', count: 3 },
      { date: '2026-09-26', count: 1 },
      { date: '2026-09-27', count: 2 },
    ]);
    expect(weeks.map((w) => w.contributionDays.map((d) => [d.date, d.weekday]))).toEqual([
      [['2026-09-26', 6]],
      [
        ['2026-09-27', 0],
        ['2026-09-28', 1],
      ],
    ]);
  });
});

describe('genuineCommits', () => {
  it('keeps own repos, member orgs and repos with other activity, and drops mirrors', () => {
    const kept = genuineCommits(sources()).map((c) => `${c.owner}/${c.name}`);
    expect(kept).toEqual(['acme/api', 'acme/api', 'octo/dotfiles', 'bigco/lib']);
  });
});

describe('toRawUser', () => {
  const p = normalize(toRawUser(sources(), NOW), NOW);
  const owners = Object.fromEntries(p.owners.map((o) => [o.login, o]));

  it('maps profile basics and repos', () => {
    expect(p.totals).toMatchObject({ stars: 95, repos: 3, pullRequests: 120, contributions: 6, commits: 40 });
    expect(p.languages.map((l) => l.name)).toEqual(['Go']);
  });

  it('builds the calendar without future days', () => {
    expect(p.weeks.flat().map((d) => d.date)).toEqual(['2026-09-26', '2026-09-27', '2026-09-28']);
    expect(p.activeDays).toBe(3);
  });

  it('counts only last-year PRs per repo', () => {
    expect(owners.bigco.pullRequests).toBe(1);
    expect(owners.bigco.commits).toBe(1);
  });

  it('never counts an unclassified owner as an organization', () => {
    expect(owners['unknown-co'].type).toBe('user');
    expect(owners.acme.type).toBe('org');
    expect(owners.octo.type).toBe('self');
  });

  it('drops mirrors from the org breakdown', () => {
    expect(owners['mirror-co']).toBeUndefined();
    expect(owners.rando).toBeUndefined();
  });

  it('records public memberships', () => {
    expect(p.memberOf.map((m) => m.login)).toEqual(['acme']);
  });
});

describe('fetchSources', () => {
  const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

  const user = sources().user;

  it('reports a missing account as not found', async () => {
    const fake = async () => json({ message: 'Not Found' }, 404);
    await expect(fetchSources('ghost', { fetch: fake as typeof fetch })).rejects.toMatchObject({ kind: 'not-found' });
  });

  it('turns a core rate limit into an error with the reset time', async () => {
    const fake = async () => json({ message: 'rate limit' }, 403, { 'x-ratelimit-reset': '1790000000' });
    const err = (await fetchSources('octo', { fetch: fake as typeof fetch }).catch((e) => e)) as PublicApiError;
    expect(err.kind).toBe('rate-limit');
    expect(err.resetAt?.getTime()).toBe(1790000000 * 1000);
  });

  it('keeps going with warnings when optional parts fail, and treats 422 as empty', async () => {
    const fake = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/users/octo')) return json(user);
      if (url.includes('/search/repositories')) return json({ total_count: 0, items: [] });
      if (url.includes('contributions-api')) return json({}, 500);
      if (url.includes('/search/commits')) return json({ message: 'rate limit' }, 403);
      if (url.includes('/search/issues')) return json({ message: 'cannot search' }, 422);
      if (url.endsWith('/orgs')) return json([]);
      return json({}, 404);
    };
    const { sources: s, warnings } = await fetchSources('octo', { fetch: fake as typeof fetch, now: NOW });
    expect(s.calendar).toBeNull();
    expect(s.commits).toBeNull();
    expect(s.pullRequests).toEqual({ total_count: 0, items: [] });
    expect(warnings).toEqual(['Contribution calendar: unavailable.', 'Commits: search rate limit, try again in a minute.']);
  });
});

describe('timeouts', () => {
  it('gives up on a stalled calendar and keeps the rest of the profile', async () => {
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    const fake = (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('contributions-api')) {
        // Never answers on its own: only the abort signal ends it.
        return new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal!.reason)));
      }
      if (url.endsWith('/users/octo')) return Promise.resolve(json(sources().user));
      if (url.endsWith('/orgs')) return Promise.resolve(json([]));
      return Promise.resolve(json({ total_count: 0, items: [] }));
    };
    const { sources: s, warnings } = await fetchSources('octo', { fetch: fake as typeof fetch, now: NOW, timeoutMs: 50 });
    expect(s.calendar).toBeNull();
    expect(warnings).toContain('Contribution calendar: unavailable.');
  });
});
