import { describe, expect, it } from 'vitest';
import { cumulative, latest, mergeSnapshot, recentSeries, type Snapshot } from './stats';

const snap = (over: Partial<Snapshot> = {}): Snapshot => ({
  at: '2026-10-04T03:41:00Z',
  createdAt: '2026-10-01T14:32:04Z',
  stars: 2,
  forks: 0,
  starDates: ['2026-10-03T10:00:00Z', '2026-10-01T20:00:00Z'],
  forkDates: [],
  adopters: ['someone/profile'],
  traffic: null,
  ...over,
});

describe('cumulative', () => {
  it('counts events up to and including each day', () => {
    expect(cumulative(['2026-10-02T05:00:00Z', '2026-10-02T23:00:00Z', '2026-10-04T00:00:00Z'], '2026-10-01', '2026-10-04')).toEqual([
      ['2026-10-01', 0],
      ['2026-10-02', 2],
      ['2026-10-03', 2],
      ['2026-10-04', 3],
    ]);
  });
});

describe('mergeSnapshot', () => {
  it('draws stars and forks back to the day the repo was created', () => {
    const h = mergeSnapshot(null, snap());
    expect(Object.keys(h.days)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    expect(h.days['2026-10-01']).toEqual({ stars: 1, forks: 0 });
    expect(h.days['2026-10-04']).toEqual({ stars: 2, forks: 0, adopters: 1 });
  });

  it('falls back to a single total when the dates are not listed', () => {
    const h = mergeSnapshot(null, snap({ starDates: null, stars: 5000 }));
    expect(h.days['2026-10-03'].stars).toBeUndefined();
    expect(h.days['2026-10-04'].stars).toBe(5000);
  });

  it('keeps when an adopter was first seen and drops ones that left', () => {
    const first = mergeSnapshot(null, snap({ adopters: ['a/one', 'b/two'] }));
    const next = mergeSnapshot(first, snap({ at: '2026-10-06T03:41:00Z', adopters: ['A/one', 'c/three'] }));
    expect(next.adopters).toEqual([
      { repo: 'c/three', since: '2026-10-06' },
      { repo: 'A/one', since: '2026-10-04' },
    ]);
    expect(next.days['2026-10-04'].adopters).toBe(2);
    expect(next.days['2026-10-06'].adopters).toBe(2);
  });

  it('keeps the previous adopters when code search failed', () => {
    const first = mergeSnapshot(null, snap({ adopters: ['a/one'] }));
    const next = mergeSnapshot(first, snap({ at: '2026-10-05T03:41:00Z', adopters: null }));
    expect(next.adopters).toEqual([{ repo: 'a/one', since: '2026-10-04' }]);
    expect(next.days['2026-10-05'].adopters).toBeUndefined();
  });

  it('records traffic per day and overwrites a partial day on the next run', () => {
    const traffic = (count: number) => ({
      views: [
        { timestamp: '2026-09-30T00:00:00Z', count: 0, uniques: 0 },
        { timestamp: '2026-10-03T00:00:00Z', count: 7, uniques: 3 },
        { timestamp: '2026-10-04T00:00:00Z', count, uniques: 1 },
      ],
      clones: [{ timestamp: '2026-10-04T00:00:00Z', count: 4, uniques: 2 }],
      recent: { views: count + 7, visitors: 3, clones: 4, cloners: 2 },
      referrers: [{ name: 'github.com', views: 7, visitors: 1 }],
      paths: [],
    });
    const first = mergeSnapshot(null, snap({ traffic: traffic(2) }));
    const next = mergeSnapshot(first, snap({ at: '2026-10-05T03:41:00Z', traffic: traffic(9) }));
    expect(next.days['2026-09-30']).toBeUndefined();
    expect(next.days['2026-10-03']).toMatchObject({ views: 7, visitors: 3 });
    expect(next.days['2026-10-04']).toMatchObject({ views: 9, clones: 4, adopters: 1 });
    expect(next.traffic).toBe(true);
    expect(next.recent).toEqual({ views: 16, visitors: 3, clones: 4, cloners: 2 });
    expect(mergeSnapshot(next, snap({ at: '2026-10-06T03:41:00Z' }))).toMatchObject({ traffic: false, referrers: [] });
  });
});

describe('reading history', () => {
  const h = mergeSnapshot(
    null,
    snap({
      traffic: {
        views: [
          { timestamp: '2026-10-02T00:00:00Z', count: 1, uniques: 1 },
          { timestamp: '2026-10-03T00:00:00Z', count: 5, uniques: 2 },
          { timestamp: '2026-10-04T00:00:00Z', count: 3, uniques: 1 },
        ],
        clones: [],
        recent: { views: 9, visitors: 2, clones: 0, cloners: 0 },
        referrers: [],
        paths: [],
      },
    }),
  );

  it('lines every metric up on the same dates, with null for no data', () => {
    const { dates, rows } = recentSeries(h, 3);
    expect(dates).toEqual(['2026-10-02', '2026-10-03', '2026-10-04']);
    expect(rows.find((r) => r.key === 'views')!.values).toEqual([1, 5, 3]);
    expect(rows.find((r) => r.key === 'adopters')!.values).toEqual([null, null, 1]);
  });

  it('reads the newest recorded value', () => {
    expect(latest(h, 'stars')).toBe(2);
    expect(latest(h, 'views')).toBe(3);
    expect(latest(h, 'clones')).toBeNull();
  });
});
