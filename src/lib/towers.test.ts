import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { heightOf, profileComplexes, profileTowers, skylineCells } from '../cards/levels';
import { SkylineCard } from '../cards/Skyline';
import { demoProfile } from '../og/demo';
import type { Profile } from './profile';
import { COMPLEX_NAMES } from './complexes';
import { RIG, TOWER_NAMES, towerFaces, towerOutline, towerStyles, type TowerStyle, type V } from './towers';

/** Rungs in order, tallest first, the way the ladder hands them out. */
const ORDER: TowerStyle[] = [
  'burj',
  'taipei',
  'petronas',
  'empire',
  'kl',
  'tokyo',
  'eiffel',
  'chrysler',
  'pyramid',
  'clock',
  'terrace',
  'setback',
  'penthouse',
  'block',
];

/** A date the way a card's title writes it. */
const shortLabel = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

const year = (height: (i: number) => number, count = 300) =>
  Array.from({ length: count }, (_, i) => ({
    id: `2026-${String(Math.floor(i / 28) + 1).padStart(2, '0')}-${(i % 28) + 1}`,
    height: height(i),
  }));

// The card's own projection: x and y across the plot, z up the screen.
const flat = ([x, y, z]: V): [number, number] => [x * 8.2 + y * -5.3, x * 2 + y * 4.3 - z * 90];

describe('towerStyles', () => {
  it('gives every rung to a year of different days, tallest first', () => {
    const days = year((i) => 1 - i / 400);
    const styles = towerStyles(days);
    const seen = days.map((d) => ORDER.indexOf(styles.get(d.id)!));
    expect([...new Set(seen)]).toEqual(ORDER.map((_, i) => i));
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
  });

  it('keeps landmarks rare, so they stand clear of the city', () => {
    const styles = [...towerStyles(year((i) => 1 - i / 400)).values()];
    const named = styles.filter((s) => TOWER_NAMES[s]);
    expect(named.length / styles.length).toBeLessThan(0.15);
  });

  it('still hands out the whole ladder when every day is the same', () => {
    const styles = towerStyles(year(() => 1));
    expect(new Set(styles.values()).size).toBe(ORDER.length);
  });

  it('spreads equal days through the year instead of giving the tall rungs to the first ones', () => {
    const days = year(() => 1);
    const styles = towerStyles(days);
    const landmarks = days.flatMap((d, i) => (TOWER_NAMES[styles.get(d.id)!] ? [i] : []));
    expect(Math.max(...landmarks)).toBeGreaterThan(days.length / 2);
    expect(Math.min(...landmarks)).toBeLessThan(days.length / 2);
  });

  it('puts the tallest building on the peak day, even in a tie', () => {
    const days = year(() => 1);
    expect(towerStyles(days, days[120].id).get(days[120].id)).toBe('burj');
  });

  it('leaves short towers plain, since a landmark needs room to read', () => {
    const days = year((i) => (i === 0 ? 1 : 0.1));
    const styles = towerStyles(days);
    expect(styles.get(days[0].id)).toBe('burj');
    expect(new Set(days.slice(1).map((d) => styles.get(d.id)))).toEqual(new Set(['block']));
  });

  it('skips empty days, which are sea', () => {
    const days = year((i) => (i % 2 ? 0 : 1));
    const styles = towerStyles(days);
    expect(styles.has(days[1].id)).toBe(false);
    expect(styles.size).toBe(days.length / 2);
  });

  it('is stable, and does not reorder what it is given', () => {
    const days = year((i) => 1 - (i % 7) / 10);
    const before = days.map((d) => d.id);
    expect([...towerStyles(days)].sort()).toEqual([...towerStyles([...days].reverse())].sort());
    expect(days.map((d) => d.id)).toEqual(before);
  });

  it('copes with a year with nothing in it', () => {
    expect(towerStyles([]).size).toBe(0);
  });
});

describe('buildings', () => {
  it.each(ORDER)('%s stands on the ground and reaches the full height of its day', (style) => {
    const zs = towerFaces(style).flatMap((f) => f.points.map((p) => p[2]));
    expect(Math.min(...zs)).toBe(0);
    expect(Math.max(...zs)).toBeCloseTo(1, 5);
  });

  it.each(ORDER)('%s has a proper normal on every face, with caps flat and walls standing', (style) => {
    for (const { points, normal, kind } of towerFaces(style)) {
      expect(points.length).toBeGreaterThanOrEqual(3);
      expect(Math.hypot(...normal)).toBeCloseTo(1, 5);
      if (kind === 'cap') expect(Math.abs(normal[2])).toBeCloseTo(1, 5);
      else expect(Math.abs(normal[2])).toBeLessThan(1);
    }
  });

  it.each(['block', 'pyramid'] as TowerStyle[])('%s turns its faces outwards', (style) => {
    // Pyramid is two solids on one axis, so the middle of the tower is inside both.
    for (const { points, normal } of towerFaces(style)) {
      const [x, y] = [0, 1].map((k) => points.reduce((sum, p) => sum + p[k], 0) / points.length);
      const wall = normal[0] * x + normal[1] * y;
      expect(wall + normal[2]).not.toBe(0);
      if (Math.abs(normal[2]) < 1) expect(wall).toBeGreaterThan(0);
    }
  });

  it.each(ORDER)('%s keeps close to its plot, so neighbours stay readable', (style) => {
    const reach = Math.max(...towerFaces(style).flatMap((f) => f.points.flatMap(([x, y]) => [Math.abs(x), Math.abs(y)])));
    expect(reach).toBeLessThanOrEqual(0.6);
  });

  it('names every landmark and the site, and nothing else', () => {
    const named = [...ORDER.filter((s) => !['block', 'penthouse', 'setback', 'terrace'].includes(s)), 'site'];
    expect(Object.keys(TOWER_NAMES).sort()).toEqual(named.sort());
  });

  it('gives a site a flat roof at the full height of its day, for the rig to stand on', () => {
    const roof = towerFaces('site').filter((f) => f.kind === 'cap');
    expect(roof).toHaveLength(1);
    expect(roof[0].points.map((p) => p[2])).toEqual([1, 1, 1, 1]);
  });
});

describe('towerOutline', () => {
  it('draws a block as the three faces the view can see', () => {
    const faces = towerOutline('block', flat);
    expect(faces.map((f) => f.kind).sort()).toEqual(['cap', 'front', 'right']);
    const cap = faces.find((f) => f.kind === 'cap')!;
    expect(cap.points).toHaveLength(4);
  });

  it('never draws a face looking away from the viewer', () => {
    for (const style of ORDER) {
      const seen = towerOutline(style, flat);
      expect(seen.length).toBeGreaterThan(0);
      expect(seen.length).toBeLessThan(towerFaces(style).length);
    }
  });

  it('draws a roof flat on the ground when a day has no height, which is how the sea gets its tiles', () => {
    expect(towerOutline('block', ([x, y]) => [x * 8.2 + y * -5.3, x * 2 + y * 4.3]).map((f) => f.kind)).toEqual(['cap']);
  });
});

describe('a real calendar', () => {
  const profile = demoProfile();
  const towers = profileTowers(profile);

  it('crowns the peak day', () => {
    expect(towers.get(profile.peakDay!.date)).toBe('burj');
  });

  it('gives a building to every day with work and to today, and none to the rest', () => {
    const days = profile.weeks.flat();
    expect(towers.size).toBe(days.filter((d) => d.count > 0 || d === days.at(-1)).length);
  });

  it('never gives a smaller day a taller rung', () => {
    const rungs = new Map<number, number[]>();
    for (const { count, date } of profile.weeks.flat()) {
      if (count > 0) rungs.set(count, [...(rungs.get(count) ?? []), ORDER.indexOf(towers.get(date)!)]);
    }
    const byCount = [...rungs].sort((a, b) => b[0] - a[0]).map(([, list]) => list);
    byCount.slice(1).forEach((list, i) => expect(Math.min(...list)).toBeGreaterThanOrEqual(Math.max(...byCount[i])));
  });

  it('ships each building with its cell for the 3D view', () => {
    const cells = skylineCells(profile);
    expect(cells.find((c) => c[5] === profile.peakDay!.date)?.[6]).toBe('burj');
    expect(
      cells
        .slice(0, -1)
        .filter((c) => c[2] === 0)
        .every((c) => c[6] === 'block'),
    ).toBe(true);
  });
});

describe('today', () => {
  const last = (profile: Profile) => profile.weeks.at(-1)!.at(-1)!;
  const withToday = (count: number) => {
    const profile = demoProfile();
    last(profile).count = count;
    return profile;
  };
  const card = (profile: Profile) => renderToStaticMarkup(createElement(SkylineCard, { profile }));
  const rigs = (svg: string) => svg.match(/class="gc-slew"/g)?.length ?? 0;

  it('makes the newest day a site, and leaves every other day as it ranked', () => {
    const profile = withToday(9);
    const today = last(profile).date;
    const max = profile.peakDay!.count;
    const ranked = towerStyles(
      profile.weeks.flat().map((d) => ({ id: d.date, height: heightOf(d.count, max) })),
      profile.peakDay!.date,
    );
    const towers = profileTowers(profile);
    expect(towers.get(today)).toBe('site');
    towers.delete(today);
    ranked.delete(today);
    expect(towers).toEqual(ranked);
  });

  it('skips days the calendar holds past the day it was fetched', () => {
    const profile = demoProfile();
    const days = profile.weeks.flat();
    const today = days.at(-3)!;
    const cells = skylineCells({ ...profile, fetchedAt: `${today.date}T12:00:00.000Z` });
    expect(cells.filter((c) => c[6] === 'site').map((c) => c[5])).toEqual([today.date]);
  });

  it('keeps a plot for an empty today instead of sea, since the day is not over', () => {
    const profile = withToday(0);
    const [, , count, level, height, date, style] = skylineCells(profile).at(-1)!;
    expect([count, level, height, date, style]).toEqual([0, 0, 0, last(profile).date, 'site']);
    const svg = card(profile);
    expect(rigs(svg)).toBe(1);
    expect(svg).toContain('Under construction: 0 on');
    expect(svg).toContain('gc-l0');
  });

  it('draws one rig on the card, named like a landmark', () => {
    const svg = card(withToday(9));
    expect(rigs(svg)).toBe(1);
    expect(svg).toContain('Under construction: 9 on');
  });

  it('still paints a peak today as the peak', () => {
    const profile = withToday(90);
    profile.peakDay = last(profile);
    const cell = skylineCells(profile).at(-1)!;
    expect([cell[3], cell[6]]).toEqual([5, 'site']);
    expect(card(profile)).toContain('gc-tower-peak');
  });

  it('draws no rig without a calendar', () => {
    const profile = { ...demoProfile(), weeks: [] };
    expect(profileTowers(profile).size).toBe(0);
    expect(rigs(card(profile))).toBe(0);
  });
});

describe('RIG', () => {
  const all = [...RIG.steel, RIG.mast, ...RIG.jib, ...RIG.weights];

  it('stands on the roof and never reaches below it', () => {
    expect(Math.min(...all.flat().map((p) => p[2]))).toBe(0);
    expect(RIG.mast[0]).toEqual([0, 0, 0]);
  });

  it('keeps the open floors on the plot', () => {
    const reach = Math.max(...RIG.steel.flat().flatMap(([x, y]) => [Math.abs(x), Math.abs(y)]));
    expect(reach).toBe(0.5);
  });

  it('hangs everything that turns on the line of the jib, or it would leave the plane the card skews', () => {
    for (const [a, b] of [...RIG.jib, ...RIG.weights]) expect([a[1], b[1]]).toEqual([0, 0]);
  });

  it('keeps the hook above the roof', () => {
    const hook = RIG.jib.at(-1)!;
    expect(hook[0][0]).toBe(hook[1][0]);
    expect(hook[1][2]).toBeGreaterThan(1.2);
  });
});

describe('complexes in a real calendar', () => {
  const profile = demoProfile('clear');
  const complexes = profileComplexes(profile);
  const days = new Map(profile.weeks.flat().map((day) => [day.date, day]));

  it('finds some in a steady year', () => {
    expect(complexes.length).toBeGreaterThan(0);
  });

  it('never takes the peak or today', () => {
    const taken = new Set(complexes.flatMap((c) => c.dates));
    expect(taken.has(profile.peakDay!.date)).toBe(false);
    expect(taken.has(profile.weeks.at(-1)!.at(-1)!.date)).toBe(false);
  });

  it('only stands on days with work', () => {
    for (const { dates } of complexes) expect(dates.every((date) => days.get(date)!.count > 0)).toBe(true);
  });

  it('shades each one from the ramp, never as the peak or the sea', () => {
    for (const { level } of complexes) expect([1, 2, 3, 4]).toContain(level);
  });

  it('leaves the cells alone, so the STL still prints every day at its own height', () => {
    const cells = skylineCells(profile);
    const max = profile.peakDay!.count;
    for (const cell of cells) expect(cell[4]).toBeCloseTo(heightOf(cell[2], max), 2);
  });

  it('names each one on the card with what its days add up to', () => {
    const svg = renderToStaticMarkup(createElement(SkylineCard, { profile, standalone: true, theme: 'dark' }));
    for (const { style, dates } of complexes) {
      const total = dates.reduce((sum, date) => sum + days.get(date)!.count, 0);
      expect(svg).toContain(`${COMPLEX_NAMES[style]}: ${total} over ${dates.length} days`);
    }
  });

  it('draws no tower for a day inside one', () => {
    const svg = renderToStaticMarkup(createElement(SkylineCard, { profile, standalone: true, theme: 'dark' }));
    const inside = complexes[0].dates[0];
    const { count } = days.get(inside)!;
    expect(svg).not.toMatch(new RegExp(`<title>[^<]*${count} on ${shortLabel(inside)}</title>`));
  });
});
