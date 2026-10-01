// The git-card rank: F to SSS, an estimate of where a profile sits among active GitHub developers.
//
// GitHub numbers are heavily skewed (most people have a handful of stars, a few have a hundred thousand),
// so each metric is scored on a log scale against what a typical active developer has. That gives a
// z-score per metric: 0 is typical, +1 is one "spread" above, and so on. The weighted average of those
// z-scores, rescaled for how much the metrics move together and nudged up for one exceptional category,
// is read off a normal curve as "top X%".
//
// The medians and spreads are informed estimates, not fitted to a real population sample. The page that
// explains the rank (/rank) is generated from these same constants, so the two cannot drift apart.

import type { Profile } from './profile';

export type Category = 'impact' | 'activity' | 'collaboration';

export interface Metric {
  key: string;
  label: string;
  category: Category;
  /** Share of the final score. All weights sum to 1. */
  weight: number;
  /** What a typical active developer has. Scores 0. */
  median: number;
  /** Log-scale spread. Bigger means the metric varies more between people, so each step counts less. */
  spread: number;
  window: 'all time' | 'last 12 months';
  value: (p: Profile) => number;
}

export const METRICS: Metric[] = [
  {
    key: 'stars',
    label: 'Stars earned',
    category: 'impact',
    weight: 0.24,
    median: 5,
    spread: 2.2,
    window: 'all time',
    value: (p) => p.totals.stars,
  },
  {
    key: 'followers',
    label: 'Followers',
    category: 'impact',
    weight: 0.12,
    median: 10,
    spread: 1.7,
    window: 'all time',
    value: (p) => p.followers,
  },
  {
    key: 'contributions',
    label: 'Contributions',
    category: 'activity',
    weight: 0.16,
    median: 150,
    spread: 1.3,
    window: 'last 12 months',
    value: (p) => p.totals.contributions,
  },
  {
    key: 'activeDays',
    label: 'Active days',
    category: 'activity',
    weight: 0.1,
    median: 60,
    spread: 0.7,
    window: 'last 12 months',
    value: (p) => p.activeDays,
  },
  {
    key: 'pullRequests',
    label: 'Pull requests',
    category: 'collaboration',
    weight: 0.16,
    median: 20,
    spread: 1.6,
    window: 'all time',
    value: (p) => p.totals.pullRequests,
  },
  {
    key: 'reviews',
    label: 'Code reviews',
    category: 'collaboration',
    weight: 0.12,
    median: 3,
    spread: 1.8,
    window: 'last 12 months',
    value: (p) => p.lastYear.reviews,
  },
  {
    key: 'orgs',
    label: 'Orgs contributed to',
    category: 'collaboration',
    weight: 0.1,
    median: 1,
    spread: 1,
    window: 'last 12 months',
    value: (p) => p.owners.filter((o) => o.type === 'org').length,
  },
];

export const CATEGORIES: { key: Category; label: string; blurb: string }[] = [
  { key: 'impact', label: 'Impact', blurb: 'How much other people use and follow your work.' },
  { key: 'activity', label: 'Activity', blurb: 'How much you ship, and how steadily.' },
  { key: 'collaboration', label: 'Collaboration', blurb: 'How much you work with others: PRs, reviews and organizations.' },
];

/**
 * Assumed correlation between any two metrics. Strong developers tend to be strong on several at once,
 * so the average of their z-scores varies less than a single one would. This rescales for that.
 */
export const CORRELATION = 0.5;

/**
 * Exceptional category bonus. A category more than `threshold` spreads above typical adds `factor` per extra
 * spread to the final score, so a legend in one dimension is not dragged down by being quiet in another.
 * Without it, someone with the most followers on GitHub but no pull requests would sit below S.
 */
export const SPIKE = { threshold: 3, factor: 0.15 };

export interface Tier {
  name: string;
  /** Upper bound of this tier as a share of developers: S means top 1%. */
  top: number;
  title: string;
}

// Best first. S and above are the super elite.
export const TIERS: Tier[] = [
  { name: 'SSS', top: 0.0001, title: 'Legendary' },
  { name: 'SS', top: 0.001, title: 'Mythic' },
  { name: 'S', top: 0.01, title: 'Elite' },
  { name: 'A', top: 0.05, title: 'Expert' },
  { name: 'B', top: 0.15, title: 'Advanced' },
  { name: 'C', top: 0.35, title: 'Skilled' },
  { name: 'D', top: 0.6, title: 'Active' },
  { name: 'E', top: 0.85, title: 'Getting started' },
  { name: 'F', top: 1, title: 'Dormant' },
];

export const ELITE = new Set(['S', 'SS', 'SSS']);

export interface Rank {
  tier: Tier;
  elite: boolean;
  /** Estimated share of active developers ranked at or above this profile, 0-1. */
  top: number;
  /** Combined z-score, including the exceptional category bonus. 0 is a typical developer. */
  z: number;
  /** The part of z that came from the exceptional category bonus. */
  bonus: number;
  categories: { key: Category; label: string; top: number; z: number }[];
  metrics: { key: string; label: string; value: number; z: number }[];
  /** The tier above, or null at SSS. */
  next: Tier | null;
}

/** Standard normal upper tail, P(Z > z), via erfc. Abramowitz and Stegun 7.1.26, error below 1.5e-7. */
export function upperTail(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erfc = poly * Math.exp(-x * x);
  return z >= 0 ? erfc / 2 : 1 - erfc / 2;
}

export function metricZ(m: Metric, value: number): number {
  return (Math.log(Math.max(0, value) + 1) - Math.log(m.median + 1)) / m.spread;
}

/** Weighted mean of z-scores, rescaled to unit variance given the assumed correlation. */
function combine(parts: { weight: number; z: number }[]): number {
  const total = parts.reduce((s, p) => s + p.weight, 0);
  const w = parts.map((p) => p.weight / total);
  const sumSq = w.reduce((s, x) => s + x * x, 0);
  const sd = Math.sqrt(sumSq + CORRELATION * (1 - sumSq));
  return parts.reduce((s, p, i) => s + w[i] * p.z, 0) / sd;
}

export function tierFor(top: number): Tier {
  return TIERS.find((t) => top <= t.top) ?? TIERS[TIERS.length - 1];
}

export function rankProfile(p: Profile): Rank {
  const metrics = METRICS.map((m) => {
    const value = m.value(p);
    return { key: m.key, label: m.label, value, z: metricZ(m, value), weight: m.weight, category: m.category };
  });
  const categories = CATEGORIES.map(({ key, label }) => {
    const cz = combine(metrics.filter((m) => m.category === key));
    return { key, label, z: cz, top: upperTail(cz) };
  });
  const best = Math.max(...categories.map((c) => c.z));
  const bonus = Math.max(0, best - SPIKE.threshold) * SPIKE.factor;
  const z = combine(metrics) + bonus;
  const top = upperTail(z);
  const tier = tierFor(top);
  const index = TIERS.indexOf(tier);

  return {
    tier,
    elite: ELITE.has(tier.name),
    top,
    z,
    bonus,
    categories,
    metrics: metrics.map(({ key, label, value, z: mz }) => ({ key, label, value, z: mz })),
    next: index > 0 ? TIERS[index - 1] : null,
  };
}

/** "0.04%", "3.2%", "41%": two significant figures, never "0%". */
export function formatTop(top: number): string {
  const pct = Math.max(top * 100, 0.001);
  if (pct >= 10) return `${Math.round(pct)}%`;
  return `${Number(pct.toPrecision(2))}%`;
}

/** "Top 3.2%" in the upper half, "Bottom 4%" in the lower half, so nobody reads "Top 100%". */
export function formatStanding(top: number): string {
  return top <= 0.5 ? `Top ${formatTop(top)}` : `Bottom ${formatTop(1 - top)}`;
}
