import { describe, expect, it } from 'vitest';
import type { Profile } from './profile';
import { formatStanding, formatTop, METRICS, rankProfile, tierFor, TIERS, upperTail } from './rank';

/** A profile with every ranked metric set directly. */
function profile(v: Partial<Record<(typeof METRICS)[number]['key'], number>>): Profile {
  const orgs = Array.from({ length: v.orgs ?? 0 }, (_, i) => ({ type: 'org', login: `o${i}` }));
  return {
    totals: { stars: v.stars ?? 0, contributions: v.contributions ?? 0, pullRequests: v.pullRequests ?? 0 },
    followers: v.followers ?? 0,
    activeDays: v.activeDays ?? 0,
    lastYear: { reviews: v.reviews ?? 0 },
    owners: orgs,
    // Any calendar at all, so the rank counts as complete.
    weeks: [[{ date: '2026-01-01', count: 1, weekday: 4 }]],
  } as unknown as Profile;
}

const typical = Object.fromEntries(METRICS.map((m) => [m.key, m.median]));

describe('upperTail', () => {
  it.each([
    [0, 0.5],
    [1.96, 0.025],
    [-1.96, 0.975],
    [2.326, 0.01],
    [3.719, 0.0001],
  ])('P(Z > %f) is about %f', (z, p) => {
    expect(upperTail(z)).toBeCloseTo(p, 4);
  });
});

describe('rankProfile', () => {
  it('weights sum to 1', () => {
    expect(METRICS.reduce((s, m) => s + m.weight, 0)).toBeCloseTo(1, 10);
  });

  it('puts a typical developer in the middle, at D', () => {
    const r = rankProfile(profile(typical));
    expect(r.top).toBeCloseTo(0.5, 6);
    expect(r.tier.name).toBe('D');
  });

  it('gives an empty profile F', () => {
    expect(rankProfile(profile({})).tier.name).toBe('F');
  });

  it('never ranks lower for having more of anything', () => {
    const base = rankProfile(profile(typical)).top;
    for (const m of METRICS) {
      const more = rankProfile(profile({ ...typical, [m.key]: m.median * 10 })).top;
      expect(more, m.key).toBeLessThan(base);
    }
  });

  it('needs more than one standout metric to reach the super elite', () => {
    // A single viral repo, everything else typical.
    const viral = rankProfile(profile({ ...typical, stars: 50_000 }));
    expect(viral.elite).toBe(false);
  });

  it('puts a prolific, widely used maintainer at the top', () => {
    const legend = rankProfile(
      profile({ stars: 250_000, followers: 80_000, contributions: 4000, activeDays: 360, pullRequests: 3000, reviews: 600, orgs: 15 }),
    );
    expect(legend.tier.name).toBe('SSS');
    expect(legend.next).toBeNull();
  });

  it('reports the next tier up', () => {
    expect(rankProfile(profile(typical)).next?.name).toBe('C');
  });
});

describe('tiers', () => {
  it('are ordered best first with increasing bounds', () => {
    for (let i = 1; i < TIERS.length; i++) expect(TIERS[i].top).toBeGreaterThan(TIERS[i - 1].top);
    expect(TIERS.at(-1)!.top).toBe(1);
  });

  it.each([
    [0.00005, 'SSS'],
    [0.0001, 'SSS'],
    [0.0005, 'SS'],
    [0.009, 'S'],
    [0.04, 'A'],
    [0.2, 'C'],
    [0.99, 'F'],
  ])('top %f is %s', (top, name) => {
    expect(tierFor(top).name).toBe(name);
  });
});

describe('formatTop', () => {
  it.each([
    [0.00042, '0.042%'],
    [0.032, '3.2%'],
    [0.41, '41%'],
    [0, '0.001%'],
  ])('%f reads as %s', (top, text) => {
    expect(formatTop(top)).toBe(text);
  });
});

describe('formatStanding', () => {
  it.each([
    [0.0042, 'Top 0.42%'],
    [0.5, 'Top 50%'],
    [0.79, 'Bottom 21%'],
    [0.99999, 'Bottom 0.001%'],
  ])('%f reads as %s', (top, text) => {
    expect(formatStanding(top)).toBe(text);
  });
});
