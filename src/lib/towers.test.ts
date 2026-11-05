import { describe, expect, it } from 'vitest';
import { profileTowers, skylineCells } from '../cards/levels';
import { demoProfile } from '../og/demo';
import { TOWER_NAMES, towerFaces, towerOutline, towerStyles, type TowerStyle, type V } from './towers';

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

  it('names every landmark, and nothing else', () => {
    expect(Object.keys(TOWER_NAMES).sort()).toEqual(ORDER.filter((s) => !['block', 'penthouse', 'setback', 'terrace'].includes(s)).sort());
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

  it('gives a building to every day with work and none to the rest', () => {
    const days = profile.weeks.flat();
    expect(towers.size).toBe(days.filter((d) => d.count > 0).length);
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
    expect(cells.filter((c) => c[2] === 0).every((c) => c[6] === 'block')).toBe(true);
  });
});
