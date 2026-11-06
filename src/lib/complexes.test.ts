import { describe, expect, it } from 'vitest';
import { COMPLEX_NAMES, complexFaces, findComplexes, paintOrder, type Complex, type ComplexStyle, type Lot } from './complexes';
import type { TowerStyle } from './towers';

const WEEKS = 30;

/** A year of sea, with whatever `at` puts on each plot. */
function year(at: (week: number, weekday: number) => number | [number, TowerStyle]): Lot[] {
  return Array.from({ length: WEEKS * 7 }, (_, i) => {
    const [week, weekday] = [Math.floor(i / 7), i % 7];
    const day = at(week, weekday);
    const [height, style] = typeof day === 'number' ? [day, 'block' as TowerStyle] : day;
    return { id: `d${String(i).padStart(3, '0')}`, week, weekday, height, style };
  });
}

/** One block on an empty year, with days that vary enough to rule out a game. */
const block = (week: number, weekday: number, weeks: number, days: number, height = 0.4) =>
  year((w, d) => {
    const inside = w >= week && w < week + weeks && d >= weekday && d < weekday + days;
    return inside ? height * (1 + ((w + d) % 2) * 0.5) : 0;
  });

const touching = (a: Complex, b: Complex) =>
  a.week <= b.week + b.weeks && b.week <= a.week + a.weeks && a.weekday <= b.weekday + b.days && b.weekday <= a.weekday + a.days;

describe('findComplexes', () => {
  it('joins a solid run of days into one building with one roof', () => {
    const [complex, ...rest] = findComplexes(block(4, 1, 4, 3));
    expect(rest).toEqual([]);
    expect(complex).toMatchObject({ week: 4, weekday: 1, weeks: 4, days: 3 });
    expect(complex.dates).toHaveLength(12);
    expect(complex.height).toBeCloseTo(0.5);
  });

  it('lists the days a building stands on, oldest first', () => {
    const { dates } = findComplexes(block(4, 1, 4, 3))[0];
    expect(dates).toEqual([...dates].sort());
    expect(dates[0]).toBe(`d${String(4 * 7 + 1).padStart(3, '0')}`);
  });

  it('leaves a small cluster or a single row alone', () => {
    expect(findComplexes(block(4, 1, 2, 2))).toEqual([]);
    expect(findComplexes(block(4, 1, 1, 7))).toEqual([]);
    expect(findComplexes(block(4, 3, 6, 1))).toEqual([]);
  });

  it('keeps landmarks and today out of a block', () => {
    for (const style of ['tokyo', 'site', 'burj'] as TowerStyle[]) {
      const lots = year((w, d) => (w === 5 && d === 2 ? [0.4, style] : w >= 4 && w < 7 && d >= 1 && d < 4 ? 0.4 : 0));
      expect(findComplexes(lots)).toEqual([]);
    }
  });

  it('breaks a block at an empty day', () => {
    const lots = year((w, d) => (w === 5 && d === 2 ? 0 : w >= 4 && w < 7 && d >= 1 && d < 4 ? 0.4 : 0));
    expect(findComplexes(lots)).toEqual([]);
  });

  it('needs its days close enough for one roof to be fair', () => {
    expect(findComplexes(year((w, d) => (w >= 4 && w < 7 && d < 3 ? ((w + d) % 2 ? 0.1 : 0.6) : 0)))).toEqual([]);
  });

  it('never wraps from the end of one week into the next', () => {
    const lots = year((w, d) => ((w >= 4 && w < 8 && d >= 5) || (w >= 5 && w < 9 && d < 2) ? 0.4 : 0));
    for (const { weekday, days } of findComplexes(lots)) expect(weekday + days).toBeLessThanOrEqual(7);
  });

  it('keeps a busy year a skyline', () => {
    const found = findComplexes(year((w, d) => 0.4 * (1 + ((w + d) % 2) * 0.5)));
    expect(found.length).toBeLessThanOrEqual(5);
    for (const { weeks, days } of found) expect([weeks <= 6, days <= 5]).toEqual([true, true]);
  });

  it('keeps a street open between any two', () => {
    const found = findComplexes(year((w, d) => 0.4 * (1 + ((w + d) % 2) * 0.5)));
    expect(found.length).toBeGreaterThan(1);
    found.forEach((a, i) => found.slice(i + 1).forEach((b) => expect(touching(a, b)).toBe(false)));
  });

  it('never shares a day between two', () => {
    const dates = findComplexes(year((w, d) => 0.4 * (1 + ((w + d) % 2) * 0.5))).flatMap((c) => c.dates);
    expect(new Set(dates).size).toBe(dates.length);
  });

  it('gives a city one City Hall, on the biggest block with room for a dome', () => {
    const lots = year((w, d) => ((w < 6 && d < 5) || (w >= 10 && w < 13 && d >= 1 && d < 4) ? 0.4 * (1 + ((w + d) % 2) * 0.5) : 0));
    const found = findComplexes(lots);
    expect(found.filter((c) => c.style === 'hall')).toHaveLength(1);
    expect(found.find((c) => c.style === 'hall')).toMatchObject({ weeks: 6, days: 5 });
  });

  it('keeps the dome off a block too low to carry it', () => {
    expect(findComplexes(block(4, 1, 4, 3, 0.08))[0].style).toBe('school');
  });

  it('builds a long narrow block up as apartments and a low one as a school', () => {
    expect(findComplexes(block(4, 1, 6, 2))[0].style).toBe('apartments');
    expect(findComplexes(block(4, 1, 6, 2, 0.15))[0].style).toBe('school');
  });
});

describe('games', () => {
  const level = (week: number, weekday: number, weeks: number, days: number, height = 0.3, wobble = 1.1) =>
    year((w, d) => (w >= week && w < week + weeks && d >= weekday && d < weekday + days ? height * ((w + d) % 2 ? wobble : 1) : 0));

  it.each([
    [5, 3],
    [3, 5],
    [6, 4],
  ])('lays a football ground on %i by %i level days', (weeks, days) => {
    expect(findComplexes(level(4, 1, weeks, days))[0]).toMatchObject({ style: 'football', weeks, days });
  });

  it.each([
    [3, 2],
    [4, 2],
    [2, 4],
  ])('lays a basketball court on %i by %i level days', (weeks, days) => {
    expect(findComplexes(level(4, 1, weeks, days))[0]).toMatchObject({ style: 'basketball', weeks, days });
  });

  it('needs the days level, not just close', () => {
    expect(findComplexes(level(4, 1, 5, 3, 0.3, 1.35)).map((c) => c.style)).not.toContain('football');
    expect(findComplexes(level(4, 1, 3, 2, 0.3, 1.35))).toEqual([]);
  });

  it('needs the right shape, since a square is no pitch', () => {
    expect(findComplexes(level(4, 1, 3, 3)).map((c) => c.style)).not.toContain('football');
  });

  it('holds a city to one football ground and two courts', () => {
    const found = findComplexes(year(() => 0.3));
    expect(found.filter((c) => c.style === 'football')).toHaveLength(1);
    expect(found.filter((c) => c.style === 'basketball')).toHaveLength(2);
    expect(found.length).toBeLessThanOrEqual(5);
  });
});

describe('complexFaces', () => {
  const styles = Object.keys(COMPLEX_NAMES) as ComplexStyle[];
  const sizes = [
    [6, 5, 0.4],
    [5, 3, 0.1],
    [3, 5, 0.6],
    [2, 4, 0.05],
    [4, 2, 0.9],
    [3, 3, 0.3],
  ];

  describe.each(styles)('%s', (style) => {
    it.each(sizes)('stays in its box on %i by %i at %d', (weeks, days, height) => {
      for (const { points } of complexFaces({ style, weeks, days, height })) {
        for (const [x, y, z] of points) {
          expect(Math.abs(x)).toBeLessThanOrEqual(0.5001);
          expect(Math.abs(y)).toBeLessThanOrEqual(0.5001);
          expect(z).toBeGreaterThanOrEqual(0);
          expect(z).toBeLessThanOrEqual(1.0001);
        }
      }
    });

    it.each(sizes)('reaches the roof its days earned on %i by %i at %d', (weeks, days, height) => {
      const top = Math.max(...complexFaces({ style, weeks, days, height }).flatMap((f) => f.points.map((p) => p[2])));
      expect(top).toBeCloseTo(1);
    });
  });

  it('runs a court along the long side of its block, either way round', () => {
    const lines = (weeks: number, days: number) => {
      const spans = complexFaces({ style: 'basketball', weeks, days, height: 0.3 })
        .filter((f) => f.kind === 'front' && f.points.every((p) => p[2] === f.points[0][2]))
        .map(({ points }) => [0, 1].map((axis) => Math.max(...points.map((p) => p[axis])) - Math.min(...points.map((p) => p[axis]))));
      // The floor of the court, not the walls of no height around it.
      const [x, y] = spans.reduce((big, next) => (next[0] * next[1] > big[0] * big[1] ? next : big));
      return [x * (weeks - 0.18), y * (days - 0.18)];
    };
    expect(lines(4, 2)[0]).toBeGreaterThan(lines(4, 2)[1]);
    expect(lines(2, 4)[1]).toBeGreaterThan(lines(2, 4)[0]);
  });

  it('gives every storey the same height, whatever the building', () => {
    const plates = (height: number) =>
      new Set(complexFaces({ style: 'apartments', weeks: 5, days: 2, height }).map((f) => f.points[0][2])).size;
    expect(plates(0.8)).toBeGreaterThan(plates(0.3));
  });
});

describe('paintOrder', () => {
  const day = (week: number, weekday: number) => ({ week, weekday });

  it('leaves a list of single days as it was', () => {
    const days = Array.from({ length: 28 }, (_, i) => day(Math.floor(i / 7), i % 7));
    expect(paintOrder(days)).toEqual(days);
  });

  it('paints a wide building after a day behind it and before a day in front of it', () => {
    const complex = { week: 2, weekday: 2, weeks: 5, days: 2 };
    const back = day(5, 1); // further along the weeks, so later in the list, but on a row behind the building
    const front = day(3, 4); // earlier in the list, on a row in front of it
    const order = paintOrder([front, back, complex].sort((a, b) => a.week - b.week || a.weekday - b.weekday));
    expect(order.indexOf(back)).toBeLessThan(order.indexOf(complex));
    expect(order.indexOf(complex)).toBeLessThan(order.indexOf(front));
  });

  it('paints a day past the end of a building after it', () => {
    const complex = { week: 2, weekday: 2, weeks: 3, days: 3 };
    const past = day(5, 3);
    expect(paintOrder([past, complex])).toEqual([complex, past]);
  });

  it('keeps every lot, once', () => {
    const lots = [{ week: 2, weekday: 2, weeks: 3, days: 3 }, day(0, 0), day(5, 0), day(1, 6), day(6, 6)];
    expect(new Set(paintOrder(lots)).size).toBe(lots.length);
  });
});
