import { findComplexes, type Complex } from '../lib/complexes';
import { currentDay, type Day, type Profile } from '../lib/profile';
import { towerStyles, type TowerStyle } from '../lib/towers';
import type { Cell } from '../scenes/skyline';

/**
 * Buckets a day into 0-4 by quartiles of the non-zero days, like GitHub does, so one huge day
 * does not flatten the rest. The single peak day gets level 5, which renders in the accent.
 */
export function leveller(profile: Profile): (day: Day) => number {
  const counts = profile.weeks
    .flat()
    .map((d) => d.count)
    .filter((c) => c > 0)
    .sort((a, b) => a - b);
  const q = (p: number) => counts[Math.min(counts.length - 1, Math.floor(counts.length * p))] ?? 0;
  const [q1, q2, q3] = [q(0.25), q(0.5), q(0.75)];
  const peak = profile.peakDay?.date;

  return (day) => {
    if (day.count === 0) return 0;
    if (day.date === peak) return 5;
    if (day.count <= q1) return 1;
    if (day.count <= q2) return 2;
    if (day.count <= q3) return 3;
    return 4;
  };
}

/** Skyline fill class: sea for empty days, a neon green tower for the peak, the cyan ramp for the rest. */
export function skylineFill(level: number): string {
  if (level === 0) return 'gc-sea';
  if (level === 5) return 'gc-tower-peak';
  return `gc-l${level}`;
}

/** Building height for the skylines, 0-1. Square root keeps quiet days visible next to big ones. */
export function heightOf(count: number, max: number): number {
  return max > 0 ? Math.sqrt(count / max) : 0;
}

/**
 * The building each day gets, by date. An empty day is not in it, since it is sea. Today is a construction site, even
 * with nothing built yet, and whatever it ranks as only shows once the day is over.
 */
export function profileTowers(profile: Profile): Map<string, TowerStyle> {
  const max = profile.peakDay?.count ?? 0;
  const towers = towerStyles(
    profile.weeks.flat().map((day) => ({ id: day.date, height: heightOf(day.count, max) })),
    profile.peakDay?.date,
  );
  const today = currentDay(profile);
  if (today) towers.set(today.date, 'site');
  return towers;
}

/** The big buildings of a year, each with the shade its days average out to. */
export function profileComplexes(profile: Profile): (Complex & { level: number })[] {
  const max = profile.peakDay?.count ?? 0;
  const towers = profileTowers(profile);
  const level = leveller(profile);
  const days = new Map(profile.weeks.flat().map((day) => [day.date, day]));
  const lots = profile.weeks.flatMap((week, w) =>
    week.map((day) => ({
      id: day.date,
      week: w,
      weekday: day.weekday,
      height: heightOf(day.count, max),
      style: towers.get(day.date) ?? 'block',
    })),
  );
  return findComplexes(lots).map((complex) => ({
    ...complex,
    level: Math.round(complex.dates.reduce((sum, date) => sum + level(days.get(date)!), 0) / complex.dates.length),
  }));
}

/** Compact cells for the 3D view, shipped as JSON in the page. Shape: see Cell in scenes/skyline.ts. */
export function skylineCells(profile: Profile): Cell[] {
  const level = leveller(profile);
  const max = profile.peakDay?.count ?? 0;
  const towers = profileTowers(profile);
  return profile.weeks.flatMap((week, w) =>
    week.map((day): Cell => [
      w,
      day.weekday,
      day.count,
      level(day),
      Math.round(heightOf(day.count, max) * 1000) / 1000,
      day.date,
      towers.get(day.date) ?? 'block',
    ]),
  );
}
