// The buildings of the skyline. A day's height picks its building off a ladder ordered by how tall the real ones
// stand, so the bigger the day, the bigger the landmark, and the peak day is the tallest building in the world.
// Each building is a stack of parts in a unit box, which the SVG card and the 3D scenes both draw from.

import { hash } from './seeded';

export type TowerStyle =
  | 'block'
  | 'penthouse'
  | 'setback'
  | 'terrace'
  | 'clock'
  | 'pyramid'
  | 'chrysler'
  | 'eiffel'
  | 'tokyo'
  | 'kl'
  | 'empire'
  | 'petronas'
  | 'taipei'
  | 'burj';

/** What a viewer calls each landmark. Plain buildings have no name. */
export const TOWER_NAMES: Partial<Record<TowerStyle, string>> = {
  clock: 'Big Ben',
  pyramid: 'Transamerica Pyramid',
  chrysler: 'Chrysler Building',
  eiffel: 'Eiffel Tower',
  tokyo: 'Tokyo Tower',
  kl: 'KL Tower',
  empire: 'Empire State Building',
  petronas: 'Petronas Towers',
  taipei: 'Taipei 101',
  burj: 'Burj Khalifa',
};

/**
 * Every rung below the peak, tallest first, with the share of active days at or above it. Landmarks are rare on
 * purpose: a slim tower only reads against open sky, so they stand clear of a solid city. Ranked rather than cut by
 * height, so a steady year gets the whole ladder too and a card's size stays the same whatever the calendar holds.
 */
const LADDER: [TowerStyle, number][] = [
  ['taipei', 0.012],
  ['petronas', 0.025],
  ['empire', 0.04],
  ['kl', 0.055],
  ['tokyo', 0.07],
  ['eiffel', 0.085],
  ['chrysler', 0.1],
  ['pyramid', 0.115],
  ['clock', 0.13],
  ['terrace', 0.24],
  ['setback', 0.4],
  ['penthouse', 0.6],
];

/** Below this share of the peak a tower is too short to read as anything, so it stays a plain block. */
const MIN_HEIGHT = 0.18;

/**
 * A style for each day, by rank. Days of the same height split by a hash of their id, so a run of equal days does
 * not hand the tall rungs to the earliest ones. `peak` is the day that takes the top rung.
 */
export function towerStyles(days: { id: string; height: number }[], peak?: string | null): Map<string, TowerStyle> {
  const active = days.filter((d) => d.height > 0);
  const ranked = active.sort(
    (a, b) => Number(b.id === peak) - Number(a.id === peak) || b.height - a.height || hash(a.id) - hash(b.id) || a.id.localeCompare(b.id),
  );
  return new Map(
    ranked.map(({ id, height }, i) => {
      if (i === 0) return [id, 'burj'];
      if (height < MIN_HEIGHT) return [id, 'block'];
      return [id, LADDER.find(([, share]) => i / ranked.length < share)?.[0] ?? 'block'];
    }),
  );
}

type Pt = [number, number];
export type V = [number, number, number];

/** One solid in a building: a tapered prism in a unit box, with the plot running -0.5 to 0.5 and height 0 to 1. */
export interface Part {
  /** Bottom and top, as shares of the tower's height. */
  z: Pt;
  /** Half width at the bottom and the top, as shares of the plot. 0.5 fills it, 0 at the top makes a point. */
  r: Pt;
  /** Centre at the bottom and the top. Legs lean in with this. Defaults to the middle of the plot. */
  at?: [Pt, Pt];
  /** 8 for round things. */
  sides?: 4 | 8;
}

const tier = (z0: number, z1: number, r0: number, r1 = r0, sides: 4 | 8 = 4): Part => ({ z: [z0, z1], r: [r0, r1], sides });
const round = (z0: number, z1: number, r0: number, r1 = r0): Part => tier(z0, z1, r0, r1, 8);
const spire = (z0: number, r0: number): Part => tier(z0, 1, r0, 0);
const shift = (part: Part, x: number, y: number): Part => ({
  ...part,
  at: [
    [x, y],
    [x, y],
  ],
});

/** Four legs leaning in from `out0` to `out1`, back to front so they paint in order. */
const legs = (z0: number, z1: number, out0: number, out1: number, r0: number, r1: number): Part[] =>
  [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ].map(([x, y]) => ({
    z: [z0, z1],
    r: [r0, r1],
    at: [
      [x * out0, y * out0],
      [x * out1, y * out1],
    ],
  }));

/** One of the Petronas pair: round, stepping in to a pinnacle. */
const petronas = (x: number): Part[] =>
  [
    round(0, 0.58, 0.2, 0.19),
    round(0.58, 0.72, 0.17, 0.15),
    round(0.72, 0.82, 0.13, 0.1),
    round(0.82, 0.89, 0.08, 0.06),
    spire(0.89, 0.04),
  ].map((part) => shift(part, x, 0));

/**
 * Each building back to front and bottom to top, the order an SVG has to paint them in. Landmarks run a little
 * wider than their plot: one day is a narrow footprint for a tower this tall, and their neighbours are lower.
 */
const BUILDINGS: Record<TowerStyle, Part[]> = {
  block: [tier(0, 1, 0.5)],
  penthouse: [tier(0, 0.9, 0.5), tier(0.9, 1, 0.26)],
  setback: [tier(0, 0.72, 0.5), tier(0.72, 1, 0.36)],
  terrace: [tier(0, 0.62, 0.5), tier(0.62, 0.84, 0.4), tier(0.84, 1, 0.29)],
  clock: [tier(0, 0.66, 0.33), tier(0.66, 0.8, 0.41), spire(0.8, 0.35)],
  pyramid: [tier(0, 0.86, 0.54, 0.11), spire(0.86, 0.11)],
  chrysler: [
    tier(0, 0.18, 0.54),
    tier(0.18, 0.56, 0.39),
    tier(0.56, 0.63, 0.34, 0.28),
    tier(0.63, 0.7, 0.27, 0.21),
    tier(0.7, 0.77, 0.2, 0.14),
    tier(0.77, 0.83, 0.13, 0.08),
    spire(0.83, 0.06),
  ],
  eiffel: [
    ...legs(0, 0.18, 0.46, 0.27, 0.13, 0.09),
    tier(0.18, 0.21, 0.4),
    ...legs(0.21, 0.38, 0.25, 0.13, 0.08, 0.06),
    tier(0.38, 0.41, 0.22),
    tier(0.41, 0.7, 0.15, 0.055),
    tier(0.7, 0.92, 0.055, 0.03),
    tier(0.92, 0.95, 0.06),
    spire(0.95, 0.03),
  ],
  tokyo: [
    ...legs(0, 0.38, 0.44, 0.22, 0.12, 0.08),
    tier(0.38, 0.45, 0.34),
    tier(0.45, 0.7, 0.23, 0.1),
    tier(0.7, 0.74, 0.16),
    tier(0.74, 0.86, 0.09, 0.045),
    spire(0.86, 0.045),
  ],
  kl: [
    round(0, 0.05, 0.5, 0.24),
    round(0.05, 0.62, 0.18, 0.12),
    round(0.62, 0.67, 0.12, 0.44),
    round(0.67, 0.72, 0.44),
    round(0.72, 0.76, 0.44, 0.12),
    round(0.76, 0.81, 0.09, 0.07),
    spire(0.81, 0.05),
  ],
  empire: [
    tier(0, 0.1, 0.56),
    tier(0.1, 0.2, 0.47),
    tier(0.2, 0.6, 0.35),
    tier(0.6, 0.68, 0.28),
    tier(0.68, 0.74, 0.2),
    tier(0.74, 0.79, 0.13),
    tier(0.79, 0.85, 0.08, 0.06),
    spire(0.85, 0.05),
  ],
  petronas: [...petronas(-0.3), shift(tier(0.5, 0.525, 0.12), 0, 0), ...petronas(0.3)],
  taipei: [
    tier(0, 0.2, 0.5, 0.34),
    ...Array.from({ length: 8 }, (_, i) => tier(0.2 + i * 0.07, 0.27 + i * 0.07, 0.3, 0.43)),
    tier(0.76, 0.81, 0.23, 0.17),
    tier(0.81, 0.86, 0.11, 0.08),
    spire(0.86, 0.05),
  ],
  burj: [
    tier(0, 0.14, 0.56, 0.5),
    tier(0.14, 0.28, 0.46, 0.42),
    tier(0.28, 0.42, 0.37, 0.33),
    tier(0.42, 0.54, 0.29, 0.25),
    tier(0.54, 0.64, 0.22, 0.19),
    tier(0.64, 0.73, 0.16, 0.13),
    tier(0.73, 0.81, 0.1, 0.07),
    spire(0.81, 0.06),
  ],
};

export interface Face {
  /** Wound counter-clockwise seen from outside, in a frame where x turns into y seen from above. */
  points: V[];
  normal: V;
  /** Which way it looks, for the shade it gets. Slopes count as sides. */
  kind: 'cap' | 'right' | 'front';
}

const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

function face(points: V[], cap: boolean): Face {
  // Across the diagonals. A side that closes to a point has three corners, and the same sum works with c as d.
  const [a, b, c, d = c] = points;
  const n = cross(sub(c, a), sub(d, b));
  const length = Math.hypot(...n) || 1;
  const normal: V = [n[0] / length, n[1] / length, n[2] / length];
  return { points, normal, kind: cap ? 'cap' : normal[0] >= normal[1] ? 'right' : 'front' };
}

/** A ring of corners counter-clockwise from above, flat sides square to the plot. */
function ring(r: number, [cx, cy]: Pt, z: number, sides: number): V[] {
  const radius = r / Math.cos(Math.PI / sides);
  return Array.from({ length: sides }, (_, i) => {
    const angle = ((2 * i + 1) * Math.PI) / sides;
    return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle), z];
  });
}

function partFaces({ z, r, at = [[0, 0] as Pt, [0, 0] as Pt], sides = 4 }: Part): Face[] {
  const bottom = ring(r[0], at[0], z[0], sides);
  const top = ring(r[1], at[1], z[1], sides);
  const walls = bottom.map((b, i) => {
    const next = (i + 1) % sides;
    return face(r[1] > 0 ? [b, bottom[next], top[next], top[i]] : [b, bottom[next], top[i]], false);
  });
  return [...(z[0] > 0 ? [face([...bottom].reverse(), true)] : []), ...walls, ...(r[1] > 0 ? [face(top, true)] : [])];
}

const FACES = new Map<TowerStyle, Face[]>();

/** Every face of a building, in paint order. */
export function towerFaces(style: TowerStyle): Face[] {
  let faces = FACES.get(style);
  if (!faces) FACES.set(style, (faces = BUILDINGS[style].flatMap(partFaces)));
  return faces;
}

/** The faces a flat drawing shows, through a projection that keeps the top of a block facing the viewer. */
export function towerOutline(style: TowerStyle, project: (v: V) => Pt): { kind: Face['kind']; points: Pt[] }[] {
  return towerFaces(style).flatMap(({ points, kind }) => {
    const flat = points.map(project);
    // The shoelace sum: turned away from the viewer, a face winds the other way round.
    const area = flat.reduce((sum, [x, y], i) => {
      const [nx, ny] = flat[(i + 1) % flat.length];
      return sum + x * ny - nx * y;
    }, 0);
    return area > 1e-6 ? [{ kind, points: flat }] : [];
  });
}
