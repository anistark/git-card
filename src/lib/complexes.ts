// Where days stand shoulder to shoulder, the city builds big. A solid run of similar days becomes one building on one
// roof: an apartment block, a school or the City Hall. Where they stand truly level there is room for a game, and a
// court or a football ground goes in, which is rare on purpose. Worked out from the calendar alone, so the card, the 3D
// skyline and any later render of the same year agree on what stands where.

import { partFaces, type Face, type Part, type Pt, type TowerStyle } from './towers';

export type ComplexStyle = 'apartments' | 'school' | 'hall' | 'basketball' | 'football';

/** What a viewer calls each one. */
export const COMPLEX_NAMES: Record<ComplexStyle, string> = {
  apartments: 'Apartment block',
  school: 'School',
  hall: 'City Hall',
  basketball: 'Basketball court',
  football: 'Football ground',
};

export interface Complex {
  style: ComplexStyle;
  /** The back corner of the block, and how far it runs along the weeks and the weekdays. */
  week: number;
  weekday: number;
  weeks: number;
  days: number;
  /** One roof for the whole block, 0-1: the mean of its days, so the building holds as much as they did. */
  height: number;
  /** Every day it stands on, oldest first. */
  dates: string[];
}

/** A day that might join a block. */
export interface Lot {
  id: string;
  week: number;
  weekday: number;
  height: number;
  style: TowerStyle;
}

/** Share of a plot a building fills, the rest being the street around it. Matches the card and the 3D skyline. */
export const FILL = 0.82;

const MAX_WEEKS = 6;
const MAX_WEEKDAYS = 5;
/** A city stays a skyline: past this many, a busy year would be nothing but slabs. */
const MAX_COMPLEXES = 5;
/** How far apart the tallest and shortest day of a block may stand. One roof has to be fair to all of them. */
const MAX_SPREAD = 2.5;
/**
 * The same for a game, which needs flat ground. On real calendars about one year in five has room for a court at this,
 * and one in twenty five for a football ground. Any looser and they stop being a find.
 */
const LEVEL = 1.2;
/** Plain buildings can merge. A landmark needs open sky, and today is still going up. */
const JOINS = new Set<TowerStyle>(['block', 'penthouse', 'setback', 'terrace']);
/** Under this many plot widths tall, a block is a school. */
const SCHOOL_BELOW = 2.2;
/** A dome needs this many to read as one. */
const HALL_ABOVE = 1.2;
/** How many plot widths the top of the height scale stands, for anything that has to keep its size on any building. */
const TALLEST = 8;

interface Rule {
  /** What goes up. Left out, the block gets whichever building suits it. */
  style?: ComplexStyle;
  /** How many a city gets. */
  most: number;
  spread: number;
  fits: (short: number, long: number) => boolean;
}

/** In order: the rare finds get first pick of the ground, and buildings go up on what is left. */
const RULES: Rule[] = [
  // The shape of a real pitch, near enough, and a real court.
  { style: 'football', most: 1, spread: LEVEL, fits: (short, long) => short >= 3 && long > short && long <= short * 1.7 },
  { style: 'basketball', most: 2, spread: LEVEL, fits: (short, long) => short === 2 && long >= 3 && long <= 4 },
  // At least nine days, and two along each side, since a single row is only a street of houses.
  { most: MAX_COMPLEXES, spread: MAX_SPREAD, fits: (short, long) => short >= 2 && short * long >= 9 },
];

/** Eight slots to a week for seven days, so a block that runs off the end of one never wraps into the next. */
const key = (week: number, weekday: number) => week * 8 + weekday;

interface Block {
  week: number;
  weekday: number;
  weeks: number;
  days: number;
  spread: number;
}

/** The biggest block left for a rule. Ties go to the one whose days sit closest together, then the oldest. */
function biggest(free: Map<number, Lot>, rule: Rule): Block | null {
  let best: Block | null = null;
  for (const { week, weekday } of free.values()) {
    for (let days = 1; days <= MAX_WEEKDAYS; days++) {
      let [low, high] = [Infinity, 0];
      for (let weeks = 1; weeks <= MAX_WEEKS; weeks++) {
        const column = Array.from({ length: days }, (_, d) => free.get(key(week + weeks - 1, weekday + d)));
        if (!column.every(Boolean)) break;
        for (const lot of column) [low, high] = [Math.min(low, lot!.height), Math.max(high, lot!.height)];
        const spread = high / low;
        if (spread > rule.spread) break;
        if (!rule.fits(Math.min(weeks, days), Math.max(weeks, days))) continue;
        const area = weeks * days;
        const top = best ? best.weeks * best.days : 0;
        if (area > top || (area === top && spread < best!.spread)) best = { week, weekday, weeks, days, spread };
      }
    }
  }
  return best;
}

/** Every complex in a year. A street stays open around each one, so two never fuse into a wall. */
export function findComplexes(lots: Lot[]): Complex[] {
  const free = new Map(lots.filter((lot) => lot.height > 0 && JOINS.has(lot.style)).map((lot) => [key(lot.week, lot.weekday), lot]));
  const found: (Omit<Complex, 'style'> & Pick<Rule, 'style'>)[] = [];

  for (const rule of RULES) {
    for (let n = 0; n < rule.most && found.length < MAX_COMPLEXES; n++) {
      const block = biggest(free, rule);
      if (!block) break;
      const { week, weekday, weeks, days } = block;
      const members: Lot[] = [];
      for (let w = week - 1; w <= week + weeks; w++) {
        for (let d = weekday - 1; d <= weekday + days; d++) {
          const lot = free.get(key(w, d));
          free.delete(key(w, d));
          if (lot && w >= week && w < week + weeks && d >= weekday && d < weekday + days) members.push(lot);
        }
      }
      found.push({
        style: rule.style,
        week,
        weekday,
        weeks,
        days,
        dates: members.map((lot) => lot.id).sort(),
        height: members.reduce((sum, lot) => sum + lot.height, 0) / members.length,
      });
    }
  }

  // One City Hall to a city, on the biggest block with room for a dome.
  const hall = found.find((block) => !block.style && Math.min(block.weeks, block.days) >= 3 && block.height * TALLEST >= HALL_ABOVE);
  return found.map((block) => ({
    ...block,
    style: block.style ?? (block === hall ? 'hall' : block.height * TALLEST < SCHOOL_BELOW ? 'school' : 'apartments'),
  }));
}

/** How a complex measures up, in plot widths. */
const span = ({ weeks, days, height }: Pick<Complex, 'weeks' | 'days' | 'height'>) => ({
  W: weeks - 1 + FILL,
  D: days - 1 + FILL,
  H: Math.max(height * TALLEST, 0.5),
});

type Size = { W: number; D: number; H: number };

/** A box or a taper in plot widths around the middle of the block, as a part in the building's unit box. */
function solid({ W, D, H }: Size, x: number, y: number, w: Pt, d: Pt, z: Pt, sides: 4 | 8 = 4): Part {
  const at: Pt = [x / W, y / D];
  return { z: [z[0] / H, z[1] / H], r: [w[0] / 2 / W, w[1] / 2 / W], ry: [d[0] / 2 / D, d[1] / 2 / D], at: [at, at], sides };
}

const flat = (size: Size, x: number, y: number, w: number, d: number, z0: number, z1: number) =>
  solid(size, x, y, [w, w], [d, d], [z0, z1]);

/**
 * A slab with its facade in a grid: recessed walls behind floor plates, and a pier for each plot along the two sides
 * that show. Real parts rather than a texture, so the 2D and 3D buildings get the same windows.
 */
function slab(size: Size, y: number, depth: number, roof: number): Part[] {
  const { W } = size;
  const count = Math.min(10, Math.max(2, Math.round(roof / 0.48)));
  const each = roof / count;
  const inset = 0.09;
  const piers = (length: number) => Math.max(2, Math.round(length));
  const along = Array.from({ length: piers(W) + 1 }, (_, i) => -W / 2 + 0.03 + ((W - 0.06) / piers(W)) * i);
  const across = Array.from({ length: piers(depth) + 1 }, (_, i) => y - depth / 2 + 0.03 + ((depth - 0.06) / piers(depth)) * i);
  return [
    ...Array.from({ length: count }, (_, i) => [
      flat(size, 0, y, W - inset, depth - inset, i * each, i * each + each * 0.7),
      flat(size, 0, y, W, depth, i * each + each * 0.7, (i + 1) * each),
    ]).flat(),
    ...across.map((py) => flat(size, W / 2 - 0.03, py, 0.06, 0.06, 0, roof)),
    ...along.map((px) => flat(size, px, y + depth / 2 - 0.03, 0.06, 0.06, 0, roof)),
  ];
}

/** Long slabs with a lane between them when the block is deep enough, and plant on the roof. */
function apartments(size: Size): Part[] {
  const { W, D, H } = size;
  const roof = H - Math.min(0.32, H * 0.12);
  const two = D > 3;
  const depth = two ? (D - 0.7) / 2 : D;
  const rows = two ? [-(D - depth) / 2, (D - depth) / 2] : [0];
  return rows.flatMap((y) => [
    ...slab(size, y, depth, roof),
    flat(size, -W * 0.28, y, 0.5, Math.min(0.5, depth * 0.5), roof, H),
    flat(size, W * 0.22, y, 0.5, Math.min(0.5, depth * 0.5), roof, H),
  ]);
}

/** A hipped roof over a wing: it closes to a ridge along the longer side. */
function hip(size: Size, x: number, y: number, w: number, d: number, z0: number, z1: number): Part {
  const ridge = Math.abs(w - d);
  return { ...solid(size, x, y, [w, w > d ? ridge : 0], [d, d > w ? ridge : 0], [z0, z1]), shade: 'cap' };
}

/** A long hall at the back with two wings reaching forward round a yard, a bell tower and a flag. */
function school(size: Size): Part[] {
  const { W, D, H } = size;
  const eaves = H * 0.62;
  const ridge = H * 0.82;
  const hallDepth = Math.min(D * 0.5, 1.5);
  const wing = Math.min(W * 0.24, 1.3);
  const hallY = -(D - hallDepth) / 2;
  const reach = D - hallDepth;
  const wingY = hallY + hallDepth / 2 + reach / 2;
  const wingX = (W - wing) / 2;
  const tower = Math.min(0.62, hallDepth * 0.6);
  return [
    flat(size, 0, 0, W, D, 0, H * 0.03),
    flat(size, 0, hallY, W, hallDepth, 0, eaves),
    hip(size, 0, hallY, W, hallDepth, eaves, ridge),
    flat(size, 0, hallY, tower, tower, 0, H * 0.84),
    hip(size, 0, hallY, tower, tower, H * 0.84, H),
    flat(size, -wingX, wingY, wing, reach, 0, eaves),
    hip(size, -wingX, wingY, wing, reach, eaves, ridge),
    flat(size, wingX, wingY, wing, reach, 0, eaves),
    hip(size, wingX, wingY, wing, reach, eaves, ridge),
    flat(size, 0, wingY, 0.06, 0.06, 0, H * 0.72),
    flat(size, 0.13, wingY, 0.22, 0.04, H * 0.62, H * 0.72),
  ];
}

/** A stone plinth, a long block with a pillared front, and a dome on a drum in the middle. */
function hall(size: Size): Part[] {
  const { W, D, H } = size;
  const plinth = H * 0.06;
  const eaves = H * 0.42;
  const front = D / 2;
  const body = D * 0.74;
  const bodyY = -(D - body) / 2 + D * 0.03;
  const portico = W * 0.5;
  const porch = front - (bodyY + body / 2);
  const porchY = front - porch / 2;
  const pillars = Math.max(4, Math.min(8, Math.round(portico / 0.42)));
  const radius = Math.min(W, D) * 0.27;
  const dome = H - H * 0.14 - (eaves + H * 0.14);
  const [drum, crown] = [eaves + H * 0.14, H * 0.86];
  const rise = (share: number) => drum + dome * share;
  const round = (r0: number, r1: number, z0: number, z1: number) => solid(size, 0, bodyY, [r0 * 2, r1 * 2], [r0 * 2, r1 * 2], [z0, z1], 8);
  return [
    flat(size, 0, 0, W, D, 0, plinth / 2),
    flat(size, 0, 0, W - 0.2, D - 0.2, plinth / 2, plinth),
    flat(size, 0, bodyY, W - 0.36, body, plinth, eaves),
    flat(size, 0, bodyY, W - 0.26, body + 0.1, eaves, eaves + H * 0.035),
    round(radius * 1.12, radius * 1.12, eaves, eaves + H * 0.04),
    round(radius, radius, eaves + H * 0.04, drum),
    round(radius, radius * 0.93, drum, rise(0.32)),
    round(radius * 0.93, radius * 0.68, rise(0.32), rise(0.68)),
    round(radius * 0.68, radius * 0.22, rise(0.68), crown),
    round(radius * 0.16, radius * 0.16, crown, crown + H * 0.06),
    solid(size, 0, bodyY, [radius * 0.14, 0], [radius * 0.14, 0], [crown + H * 0.06, H]),
    ...Array.from({ length: pillars }, (_, i) => {
      const x = -portico / 2 + (portico / (pillars - 1)) * i;
      return flat(size, x, front - 0.12, 0.1, 0.1, plinth, eaves - H * 0.05);
    }),
    flat(size, 0, porchY, portico + 0.14, porch, eaves - H * 0.05, eaves),
    solid(size, 0, porchY, [portico + 0.14, portico], [porch, 0], [eaves, eaves + H * 0.09]),
  ];
}

/**
 * Paint for a flat floor, drawn along its long side however the floor lies. Each mark is a part with no height a hair
 * above the last, so the 3D scene layers them the way a flat drawing does.
 */
function painter(size: Size, x: number, y: number, z: number, turned: boolean) {
  let lift = 0;
  const line = 0.08;
  const mark = (u: number, v: number, length: number, breadth: number, shade: Face['kind'], sides: 4 | 8 = 4): Part => {
    const [px, py, w, d] = turned ? [x + v, y + u, breadth, length] : [x + u, y + v, length, breadth];
    const top = z + (lift += 0.006);
    return { ...solid(size, px, py, [w, w], [d, d], [top, top], sides), shade };
  };
  const box = (u: number, v: number, length: number, breadth: number): Part[] => [
    mark(u, v - breadth / 2, length, line, 'cap'),
    mark(u, v + breadth / 2, length, line, 'cap'),
    mark(u - length / 2, v, line, breadth, 'cap'),
    mark(u + length / 2, v, line, breadth, 'cap'),
  ];
  const ring = (radius: number, inside: Face['kind']): Part[] => [
    mark(0, 0, radius * 2, radius * 2, 'cap', 8),
    mark(0, 0, radius * 2 - line * 2, radius * 2 - line * 2, inside, 8),
  ];
  return { mark, box, ring, line };
}

/** What a game stands on: storeys under anything tall, and a plain base under the rest. */
const base = (size: Size, top: number): Part[] => (top > 1 ? slab(size, 0, size.D, top) : [flat(size, 0, 0, size.W, size.D, 0, top)]);

/** A court on the roof, or nearly on the ground on a quiet run of days, with a hoop at each end. */
function basketball(size: Size): Part[] {
  const { W, D, H } = size;
  const turned = D > W;
  const [length, breadth] = turned ? [D, W] : [W, D];
  const deck = Math.max(H - 0.3, H * 0.4);
  const { mark, box, ring, line } = painter(size, 0, 0, deck, turned);
  const [courtL, courtB] = [length - 0.36, breadth - 0.36];
  const lane = courtL * 0.2;
  const ends = [-1, 1];
  const hoops = ends.flatMap((end) => {
    const at = end * (courtL / 2 - 0.1);
    const [x, y] = turned ? [0, at] : [at, 0];
    const [boardW, boardD] = turned ? [0.34, 0.04] : [0.04, 0.34];
    return [flat(size, x, y, 0.05, 0.05, deck, H), flat(size, x, y, boardW, boardD, H - Math.min(0.14, (H - deck) / 2), H)];
  });
  return [
    ...base(size, deck),
    mark(0, 0, length - 0.14, breadth - 0.14, 'front'),
    ...ends.map((end) => mark((end * (courtL - lane)) / 2, 0, lane, courtB * 0.42, 'right')),
    ...box(0, 0, courtL, courtB),
    mark(0, 0, line, courtB, 'cap'),
    ...ring(courtB * 0.17, 'front'),
    ...ends.flatMap((end) => box((end * (courtL - lane)) / 2, 0, lane, courtB * 0.42)),
    ...hoops,
  ];
}

/** Terraces rising to the back of the ground, tallest first so they paint in order. */
function terraces(size: Size, deck: number, top: number, depth: number, side: 'back' | 'left'): Part[] {
  const { W, D } = size;
  const rows = 3;
  const step = depth / rows;
  return Array.from({ length: rows }, (_, i) => {
    const edge = step * (i + 0.5);
    const rise = deck + ((top - deck) * (rows - i)) / rows;
    return side === 'back' ? flat(size, 0, -D / 2 + edge, W, step, deck, rise) : flat(size, -W / 2 + edge, 0, step, D, deck, rise);
  });
}

/** A pitch up on its stands: terraces along the two far sides, so the near ones never hide the game, and floodlights. */
function football(size: Size): Part[] {
  const { W, D, H } = size;
  const turned = D > W;
  const deck = Math.max(H - 0.7, H * 0.35);
  const stand = Math.min(W, D) * 0.2;
  const rim = 0.12;
  const [fieldW, fieldD] = [W - stand - rim, D - stand - rim];
  const [length, breadth] = turned ? [fieldD, fieldW] : [fieldW, fieldD];
  const { mark, box, ring, line } = painter(size, (stand - rim) / 2, (stand - rim) / 2, deck, turned);
  const stripes = 8;
  const [lineL, lineB] = [length - 0.24, breadth - 0.24];
  const area = lineL * 0.17;
  const top = deck + (H - deck) * 0.72;
  const mast = (x: number, y: number): Part[] => [
    flat(size, x, y, 0.06, 0.06, deck, H),
    { ...flat(size, x, y, 0.24, 0.24, H - Math.min(0.1, (H - deck) / 4), H), shade: 'cap' },
  ];
  const [mx, my] = [W / 2 - 0.12, D / 2 - 0.12];
  return [
    ...base(size, deck),
    ...terraces(size, deck, top, stand, 'back'),
    ...terraces(size, deck, top, stand, 'left'),
    mark(0, 0, length, breadth, 'front'),
    // Mown stripes are what make a field a field from this far up.
    ...Array.from({ length: stripes / 2 }, (_, i) => mark(((i * 2 + 0.5) / stripes - 0.5) * length, 0, length / stripes, breadth, 'right')),
    ...box(0, 0, lineL, lineB),
    mark(0, 0, line, lineB, 'cap'),
    ...ring(lineB * 0.17, 'front'),
    ...box(-(lineL - area) / 2, 0, area, lineB * 0.55),
    ...box((lineL - area) / 2, 0, area, lineB * 0.55),
    flat(size, 0, D / 2 - rim / 2, W, rim, deck, deck + 0.08),
    flat(size, W / 2 - rim / 2, 0, rim, D, deck, deck + 0.08),
    ...mast(-mx, -my),
    ...mast(mx, -my),
    ...mast(-mx, my),
    ...mast(mx, my),
  ];
}

const DRAWINGS: Record<ComplexStyle, (size: Size) => Part[]> = { apartments, school, hall, basketball, football };

/** Every face of a complex in its unit box, in paint order. */
export function complexFaces(complex: Pick<Complex, 'style' | 'weeks' | 'days' | 'height'>): Face[] {
  return DRAWINGS[complex.style](span(complex)).flatMap(partFaces);
}

interface Spread {
  week: number;
  weekday: number;
  weeks?: number;
  days?: number;
}

/** Whether one lot has to be painted before another: it stands further back, and they could overlap on screen. */
function behind(a: Spread, b: Spread): boolean {
  const [aw, ad, bw, bd] = [
    a.week + (a.weeks ?? 1) - 1,
    a.weekday + (a.days ?? 1) - 1,
    b.week + (b.weeks ?? 1) - 1,
    b.weekday + (b.days ?? 1) - 1,
  ];
  return (aw < b.week && a.weekday <= bd) || (ad < b.weekday && a.week <= bw);
}

/** Back to front. A building across many plots has no one place in a list of days, so each goes in after all it hides. */
export function paintOrder<T extends Spread>(lots: T[]): T[] {
  const seen = new Set<T>();
  const order: T[] = [];
  const visit = (lot: T) => {
    if (seen.has(lot)) return;
    seen.add(lot);
    for (const other of lots) if (behind(other, lot)) visit(other);
    order.push(lot);
  };
  lots.forEach(visit);
  return order;
}
