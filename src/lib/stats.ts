// Project stats for /stats. scripts/stats.ts takes a daily snapshot of the repo and the Action, merges it into
// history.json on the `stats` branch, and the page reads that file. The merge lives here so it is tested.

export const STAT_METRICS = [
  { key: 'views', label: 'Views', unit: 'views', about: 'Repo page views' },
  { key: 'visitors', label: 'Visitors', unit: 'visitors', about: 'Unique repo visitors' },
  { key: 'clones', label: 'Clones', unit: 'clones', about: 'Git clones of the repo' },
  { key: 'stars', label: 'Stars', unit: 'stars', about: 'Total stars' },
  { key: 'forks', label: 'Forks', unit: 'forks', about: 'Total forks' },
  { key: 'adopters', label: 'Adopters', unit: 'repos', about: 'Public repos running the Action' },
] as const;

export type StatKey = (typeof STAT_METRICS)[number]['key'];
/** A missing key means nothing was recorded that day, which is not the same as zero. */
export type StatDay = Partial<Record<StatKey, number>>;

export interface Count {
  name: string;
  views: number;
  visitors: number;
}

export interface StatsHistory {
  updatedAt: string;
  /** UTC date (YYYY-MM-DD) to that day's numbers. */
  days: Record<string, StatDay>;
  /** Repos whose workflows use the Action, with the day each was first seen. */
  adopters: { repo: string; since: string }[];
  /** GitHub's last-14-days numbers. Unique visitors only exist as a total, since the same person can come back. */
  recent: { views: number; visitors: number; clones: number; cloners: number } | null;
  /** GitHub's last-14-days lists. Empty when the run had no traffic access. */
  referrers: Count[];
  paths: Count[];
  /** Whether the last run could read repo traffic, which needs a token with admin read. */
  traffic: boolean;
}

export interface TrafficDay {
  timestamp: string;
  count: number;
  uniques: number;
}

/** One run of scripts/stats.ts. */
export interface Snapshot {
  at: string;
  createdAt: string;
  stars: number;
  forks: number;
  /** When each current star or fork happened, so the totals can be drawn back to day one. Null if too many to list. */
  starDates: string[] | null;
  forkDates: string[] | null;
  /** Null when code search failed, which keeps the previous list and records no count for the day. */
  adopters: string[] | null;
  traffic: {
    views: TrafficDay[];
    clones: TrafficDay[];
    recent: NonNullable<StatsHistory['recent']>;
    referrers: Count[];
    paths: Count[];
  } | null;
}

const day = (iso: string) => iso.slice(0, 10);

/** Every UTC date from `from` to `to`, inclusive. */
export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(day(from)); t <= Date.parse(day(to)); t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

/** A running total per day from a list of event times. */
export function cumulative(events: string[], from: string, to: string): [string, number][] {
  const sorted = events.map(day).sort();
  let i = 0;
  return dateRange(from, to).map((date) => {
    while (i < sorted.length && sorted[i] <= date) i++;
    return [date, i];
  });
}

export function mergeSnapshot(prev: StatsHistory | null, snap: Snapshot): StatsHistory {
  const today = day(snap.at);
  const days: Record<string, StatDay> = structuredClone(prev?.days ?? {});
  const set = (date: string, key: StatKey, value: number) => ((days[date] ??= {})[key] = value);

  for (const [key, dates, total] of [
    ['stars', snap.starDates, snap.stars],
    ['forks', snap.forkDates, snap.forks],
  ] as const) {
    if (dates) for (const [date, n] of cumulative(dates, snap.createdAt, today)) set(date, key, n);
    else set(today, key, total);
  }
  if (snap.adopters) set(today, 'adopters', snap.adopters.length);

  // GitHub lists every day of its window, zeros included, even from before the repo existed.
  // Later runs overwrite today's partial count.
  const born = (t: TrafficDay) => day(t.timestamp) >= day(snap.createdAt);
  for (const v of snap.traffic?.views.filter(born) ?? []) {
    set(day(v.timestamp), 'views', v.count);
    set(day(v.timestamp), 'visitors', v.uniques);
  }
  for (const c of snap.traffic?.clones.filter(born) ?? []) set(day(c.timestamp), 'clones', c.count);

  const since = new Map(prev?.adopters.map((a) => [a.repo.toLowerCase(), a.since]));
  return {
    updatedAt: snap.at,
    days: Object.fromEntries(Object.entries(days).sort(([a], [b]) => a.localeCompare(b))),
    adopters: snap.adopters
      ? snap.adopters
          .map((repo) => ({ repo, since: since.get(repo.toLowerCase()) ?? today }))
          .sort((a, b) => b.since.localeCompare(a.since) || a.repo.localeCompare(b.repo))
      : (prev?.adopters ?? []),
    recent: snap.traffic?.recent ?? null,
    referrers: snap.traffic?.referrers ?? [],
    paths: snap.traffic?.paths ?? [],
    traffic: !!snap.traffic,
  };
}

/** The last `count` days up to the newest one recorded, gaps included, with each metric as a series. */
export function recentSeries(history: StatsHistory, count: number) {
  const dates = Object.keys(history.days);
  if (!dates.length) return { dates: [], rows: [] };
  const last = dates[dates.length - 1];
  const from = new Date(Date.parse(last) - (count - 1) * 86_400_000).toISOString();
  const range = dateRange(dates[0] > from ? dates[0] : from, last);
  return {
    dates: range,
    rows: STAT_METRICS.map((m) => ({ ...m, values: range.map((d) => history.days[d]?.[m.key] ?? null) })),
  };
}

/** The newest recorded value of a metric. */
export function latest(history: StatsHistory, key: StatKey): number | null {
  const dates = Object.keys(history.days);
  for (let i = dates.length - 1; i >= 0; i--) {
    const v = history.days[dates[i]][key];
    if (v !== undefined) return v;
  }
  return null;
}
