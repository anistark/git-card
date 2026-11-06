import { Fragment } from 'react';
import { COMPLEX_NAMES, complexFaces, FILL, paintOrder, type ComplexStyle } from '../lib/complexes';
import { findEggs, MAX_SIGNS, signEggs, type Egg } from '../lib/eggs';
import { hasCalendar, type Profile } from '../lib/profile';
import { RIG, TOWER_NAMES, towerOutline, type Beam, type Face, type V } from '../lib/towers';
import { weatherFor, type Weather } from '../lib/weather';
import { heightOf, leveller, profileComplexes, profileTowers, skylineFill } from './levels';
import { CalendarOffline, PAD, SIZES, Shell, shortDate, type CardProps } from './shell';
import { WeatherBack, WeatherClip, WeatherFront, WeatherGround, type Box, type CityView } from './Weather';

// Oblique projection: weeks run right and slightly down, weekdays run left and down, height is up.
const W = { x: 10, y: 2.4 };
const D = { x: -6.5, y: 5.2 };
const MAX_H = 95;
// Rooftop neon sign for an easter egg, in city units.
const SIGN = { h: 11, rise: 12, char: 4.6, pad: 7, gap: 3 };
// The rig on today's roof: a plot's width and depth, the same up, and how far past rest gc-slew stretches the jib.
const PLOT = { w: [FILL * W.x, FILL * W.y], d: [FILL * D.x, FILL * D.y], z: FILL * W.x };
const SWING = 1.2;

type Pt = [number, number];
const centerOf = (quad: Pt[]): Pt => [quad.reduce((n, p) => n + p[0], 0) / 4, quad.reduce((n, p) => n + p[1], 0) / 4];
const r = (n: number) => Math.round(n * 10) / 10;
const pts = (list: Pt[]) => list.map(([x, y]) => `${r(x)},${r(y)}`).join(' ');
/** The shade class for each way a building's face can look. */
const SHADE: Record<Face['kind'], string> = { cap: '', right: 'r ', front: 'f ' };
/** A point of the rig, from the middle of the roof. */
const onRoof = ([x, y, z]: V): Pt => [x * PLOT.w[0] + y * PLOT.d[0], x * PLOT.w[1] + y * PLOT.d[1] - z * PLOT.z];
const beams = (list: Beam[]) =>
  list
    .map((beam) => {
      const [[x1, y1], [x2, y2]] = beam.map(onRoof);
      return `M${r(x1)} ${r(y1)}L${r(x2)} ${r(y2)}`;
    })
    .join('');

interface CityProps {
  profile: Profile;
  /** The box the city is scaled to fit and centered in. */
  box: Box;
  /** Stagger each week in with a CSS animation. */
  animate?: boolean;
  /** Weather to draw over the city, and the area it may fill. Defaults to the box. */
  weather?: Weather | null;
  sky?: Box;
  /** Easter egg signs on the roofs. Off where the city is mirrored, since their text would read backwards. */
  signs?: boolean;
}

/** The isometric city itself: one block per day on a grid floor. Shared by the skyline card and the OG image. */
export function SkylineCity({ profile, box, animate = true, weather, sky = box, signs: showSigns = true }: CityProps) {
  const level = leveller(profile);
  const max = profile.peakDay?.count ?? 0;
  const weeks = profile.weeks.length;
  const towers = profileTowers(profile);
  const roofOf = (height: number) => 2 + height * MAX_H;

  // A complex stands on many days, with one roof and one drawing for all of them.
  const complexes = profileComplexes(profile).map((complex) => {
    const a: Pt = [complex.week * W.x + complex.weekday * D.x, complex.week * W.y + complex.weekday * D.y];
    const [wide, deep] = [complex.weeks - 1 + FILL, complex.days - 1 + FILL];
    const across: Pt = [wide * W.x, wide * W.y];
    const back: Pt = [deep * D.x, deep * D.y];
    const [mx, my] = [a[0] + (across[0] + back[0]) / 2, a[1] + (across[1] + back[1]) / 2];
    const h = roofOf(complex.height);
    return {
      ...complex,
      h,
      faces: towerOutline(complexFaces(complex), ([x, y, z]) => [
        mx + x * across[0] + y * back[0],
        my + x * across[1] + y * back[1] - z * h,
      ]),
    };
  });
  const complexOf = new Map(complexes.flatMap((complex) => complex.dates.map((date) => [date, complex])));

  const columns = profile.weeks.map((week, w) =>
    week.map((day) => {
      const px = w * W.x + day.weekday * D.x;
      const py = w * W.y + day.weekday * D.y;
      const a: Pt = [px, py];
      const b: Pt = [px + FILL * W.x, py + FILL * W.y];
      const c: Pt = [b[0] + FILL * D.x, b[1] + FILL * D.y];
      const e: Pt = [px + FILL * D.x, py + FILL * D.y];
      const complex = complexOf.get(day.date);
      const h = complex?.h ?? (day.count > 0 ? roofOf(heightOf(day.count, max)) : 0);
      const up = ([x, y]: Pt): Pt => [x, y - h];
      const style = towers.get(day.date) ?? 'block';
      const site = style === 'site';
      // From the building's unit box onto this plot.
      const [mx, my] = centerOf([a, b, c, e]);
      const faces = complex
        ? []
        : towerOutline(style, ([x, y, z]) => [
            mx + x * (b[0] - a[0]) + y * (e[0] - a[0]),
            my + x * (b[1] - a[1]) + y * (e[1] - a[1]) - z * h,
          ]);
      const l = level(day);
      return {
        day,
        week: w,
        weekday: day.weekday,
        complex,
        level: l,
        sea: l === 0 && !site,
        h,
        style,
        faces,
        rig: site ? ([mx, my - h] as Pt) : null,
        top: [up(a), up(b), up(c), up(e)],
      };
    }),
  );

  const signs = showSigns ? placeSigns(findEggs(profile), columns.flat()) : [];
  // Everything standing, back to front, in runs of one week so each run can rise together.
  const standing = paintOrder([...columns.flat().filter((c) => !c.sea && !c.complex), ...complexes]);
  const runs = standing.reduce<(typeof standing)[]>((list, lot) => {
    const run = list.at(-1);
    if (run?.[0].week === lot.week) run.push(lot);
    else list.push([lot]);
    return list;
  }, []);
  const all = [
    ...standing.flatMap((lot) => lot.faces.flatMap((face) => face.points)),
    ...columns.flat().flatMap(({ rig }) => (rig ? rigReach(rig) : [])),
    ...signs.flatMap((s): Pt[] => [
      [s.x, s.y],
      [s.x + s.w, s.y],
    ]),
  ] as Pt[];
  if (!all.length) return null; // no calendar: nothing to draw, and no bounds to fit
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const scale = Math.min(box.w / (maxX - minX || 1), box.h / (maxY - minY || 1));
  const tx = box.x + (box.w - (maxX - minX) * scale) / 2 - minX * scale;
  const ty = box.y + (box.h - (maxY - minY) * scale) / 2 - minY * scale;

  // Floor line between two (week, weekday) grid points, in the same projection as the buildings.
  const at = ([w, d]: Pt): Pt => [w * W.x + d * D.x, w * W.y + d * D.y];
  const seg = (a: Pt, b: Pt) => {
    const [[x1, y1], [x2, y2]] = [at(a), at(b)];
    return { x1: r(x1), y1: r(y1), x2: r(x2), y2: r(y2) };
  };

  // The same transform the city groups apply, so weather can draw in card coordinates around the city.
  const k = r(scale * 100) / 100;
  const transform = `translate(${r(tx)} ${r(ty)}) scale(${k})`;
  const screen = ([x, y]: Pt): Pt => [r(tx) + x * k, r(ty) + y * k];
  const view: CityView | null = weather
    ? {
        at: (w, d, h = 0) => screen([w * W.x + d * D.x, w * W.y + d * D.y - h]),
        scale: k,
        weeks,
        roofs: new Map(columns.flat().flatMap((c): [string, Pt][] => (c.h > 0 ? [[c.day.date, screen(centerOf(c.top))]] : []))),
        peak: profile.peakDay?.date ?? null,
        sky,
        id: `gc-wx-${profile.login}`,
        seed: profile.login.toLowerCase(),
      }
    : null;
  const fade = animate ? 'gc-a-fade' : undefined;
  const counts = new Map(profile.weeks.flat().map((day) => [day.date, day.count]));

  return (
    <g>
      {weather && view && (
        <g className={fade}>
          <defs>
            <WeatherClip view={view} />
          </defs>
          <WeatherBack weather={weather} view={view} />
        </g>
      )}
      <g className="gc-sk" transform={transform}>
        {/* Grid floor: lines along each weekday row and every fourth week. */}
        <g className="gc-accent-s" strokeWidth={0.6} opacity={0.35}>
          {Array.from({ length: 8 }, (_, d) => (
            <line key={`d${d}`} {...seg([-1, d - 0.1], [weeks + 1, d - 0.1])} />
          ))}
          {Array.from({ length: Math.ceil(weeks / 4) + 2 }, (_, i) => (
            <line key={`w${i}`} {...seg([i * 4 - 1, -0.1], [i * 4 - 1, 6.9])} />
          ))}
        </g>
        {/* Sea first: flat tiles on the ground can never hide a building. Grouped by week so a wave can sweep across. */}
        <g className={animate ? 'gc-a-fade' : undefined}>
          {columns.map((col, w) => (
            <g key={w} className={animate ? 'gc-wave' : undefined} style={animate ? { animationDelay: `${w * 60}ms` } : undefined}>
              {col
                .filter((c) => c.sea)
                .map(({ day, top }) => (
                  <polygon key={day.date} className="gc-sea" points={pts(top)}>
                    <title>{`0 on ${shortDate(day.date)}`}</title>
                  </polygon>
                ))}
            </g>
          ))}
        </g>
        {weather && (
          <WeatherGround
            weather={weather}
            tiles={columns.flat().flatMap((c) => (c.sea ? [c.top] : []))}
            seed={profile.login.toLowerCase()}
          />
        )}
        {runs.map((run, i) => (
          <g
            key={i}
            className={animate ? 'gc-a-rise' : undefined}
            style={animate ? { animationDelay: `${run[0].week * 12}ms` } : undefined}
          >
            {run.map((lot) => {
              if ('dates' in lot) return <ComplexBuilding key={lot.dates[0]} complex={lot} counts={counts} />;
              const { day, level: l, style, faces, rig } = lot;
              const title = `${TOWER_NAMES[style] ? `${TOWER_NAMES[style]}: ` : ''}${day.count} on ${shortDate(day.date)}`;
              return (
                <Fragment key={day.date}>
                  <g className={l === 5 ? 'gc-glow' : undefined}>
                    <title>{title}</title>
                    {faces.map(({ kind, points }, i) => (
                      <polygon key={i} className={`${SHADE[kind]}${l > 0 ? skylineFill(l) : 'gc-l0'}`} points={pts(points)} />
                    ))}
                  </g>
                  {/* Beside the tower, not in it: a moving part inside a glow would redo the filter every frame. */}
                  {rig && <Rig at={rig} title={title} />}
                </Fragment>
              );
            })}
          </g>
        ))}
      </g>
      {weather && view && (
        <g className={fade}>
          <WeatherFront weather={weather} view={view} />
        </g>
      )}
      {signs.length > 0 && (
        <g transform={transform}>
          <g className={animate ? 'gc-a-fade' : undefined} style={animate ? { animationDelay: '1.2s' } : undefined}>
            {signs.map(({ egg, x, y, w, roof }, i) => (
              <g key={egg.key}>
                <title>{`${egg.label}: ${shortDate(egg.date)} ${egg.date.slice(0, 4)}`}</title>
                <line className="gc-accent-s" x1={r(x + w / 2)} y1={r(roof)} x2={r(x + w / 2)} y2={r(y + SIGN.h)} strokeWidth={0.8} />
                <g className={animate ? 'gc-glow gc-a-flicker' : 'gc-glow'} style={animate ? { animationDelay: `${i * 1.7}s` } : undefined}>
                  <rect className="gc-sign" x={r(x)} y={r(y)} width={r(w)} height={SIGN.h} strokeWidth={0.8} />
                  <text
                    className="gc-accent gc-d"
                    x={r(x + w / 2)}
                    y={r(y + 8)}
                    fontSize={7}
                    fontWeight={700}
                    letterSpacing="0.06em"
                    textAnchor="middle"
                  >
                    {egg.sign}
                  </text>
                </g>
              </g>
            ))}
          </g>
        </g>
      )}
    </g>
  );
}

interface BuildingProps {
  complex: { style: ComplexStyle; dates: string[]; level: number; faces: { kind: Face['kind']; points: Pt[] }[] };
  counts: Map<string, number>;
}

/** One building across a block of days. Its name and total stand in for the days it replaced. */
function ComplexBuilding({ complex: { style, dates, level, faces }, counts }: BuildingProps) {
  const total = dates.reduce((sum, date) => sum + (counts.get(date) ?? 0), 0);
  return (
    <g>
      <title>{`${COMPLEX_NAMES[style]}: ${total} over ${dates.length} days, ${shortDate(dates[0])} to ${shortDate(dates.at(-1)!)}`}</title>
      {faces.map(({ kind, points }, i) => (
        <polygon key={i} className={`${SHADE[kind]}${skylineFill(level)}`} points={pts(points)} />
      ))}
    </g>
  );
}

/** Everywhere the rig reaches from a roof, with the jib at the far end of its swing. */
const rigReach = ([x, y]: Pt): Pt[] => [RIG.mast, ...RIG.jib].flat().map((p) => [x + onRoof(p)[0] * SWING, y + onRoof(p)[1]]);

/** Open steel and a crane on today's roof. At rest for a still frame, and the jib swings slowly when it can move. */
function Rig({ at: [x, y], title }: { at: Pt; title: string }) {
  const [bx, by] = onRoof(RIG.beacon);
  return (
    <g className="gc-accent-s" fill="none" transform={`translate(${r(x)} ${r(y)})`}>
      <title>{title}</title>
      <path d={beams(RIG.steel)} strokeWidth={0.5} opacity={0.75} />
      <path d={beams([RIG.mast])} strokeWidth={0.8} />
      <g className="gc-slew">
        <path d={beams(RIG.jib)} strokeWidth={0.55} />
        <path d={beams(RIG.weights)} strokeWidth={1.8} />
      </g>
      <circle className="gc-accent gc-beacon" cx={r(bx)} cy={r(by)} r={0.9} stroke="none" />
    </g>
  );
}

interface Sign {
  egg: Egg & { sign: string; date: string };
  /** Top-left of the sign, and the roof it stands on, in city units. */
  x: number;
  y: number;
  w: number;
  roof: number;
}

/** Signs for the rarest eggs, each on its day's roof, skipping any that would overlap one already placed. */
function placeSigns(eggs: Egg[], cells: { day: { date: string }; h: number; rig: Pt | null; top: Pt[] }[]): Sign[] {
  const byDate = new Map(cells.map((c) => [c.day.date, c]));
  const placed: Sign[] = [];
  for (const egg of signEggs(eggs)) {
    const cell = byDate.get(egg.date);
    if (!cell || cell.h === 0 || cell.rig) continue; // a sign goes up once the building is finished
    const cx = cell.top.reduce((n, p) => n + p[0], 0) / 4;
    const roof = cell.top.reduce((n, p) => n + p[1], 0) / 4;
    const w = egg.sign.length * SIGN.char + SIGN.pad;
    const sign = { egg, x: cx - w / 2, y: roof - SIGN.rise - SIGN.h, w, roof };
    const clash = placed.some((o) => Math.abs(o.x + o.w / 2 - cx) < (o.w + w) / 2 + SIGN.gap && Math.abs(o.y - sign.y) < SIGN.h + SIGN.gap);
    if (!clash) placed.push(sign);
    if (placed.length === MAX_SIGNS) break;
  }
  return placed;
}

/** The isometric SVG skyline. Doubles as the README image and the no-JS fallback for the 3D one. */
export function SkylineCard(props: CardProps) {
  const { profile } = props;
  const { width, height } = SIZES.wide;
  const first = profile.weeks[0]?.[0]?.date;
  const last = profile.weeks.at(-1)?.at(-1)?.date;
  const weather = props.weather === false || props.calendarLoading ? null : weatherFor(profile);

  return (
    <Shell
      {...props}
      id="skyline"
      tag="SKY"
      size="wide"
      eyebrow="Contribution skyline"
      label={`Contribution skyline: ${profile.totals.contributions} contributions in the last year${weather ? `. Forecast: ${weather.label}` : ''}`}
    >
      {first && last && (
        <text className="gc-muted" x={PAD} y={PAD + 36} fontSize={13}>
          {shortDate(first)} {first.slice(0, 4)} to {shortDate(last)} {last.slice(0, 4)}
        </text>
      )}
      {weather && (
        <text className="gc-muted" x={width - PAD} y={PAD + 36} fontSize={13} textAnchor="end">
          <title>{weather.reason}</title>
          Forecast: <tspan className="gc-fg">{weather.label}</tspan>
        </text>
      )}
      {hasCalendar(profile) ? (
        <SkylineCity
          profile={profile}
          box={{ x: PAD, y: 92, w: width - PAD * 2, h: height - 92 - 52 }}
          weather={weather}
          sky={{ x: 1, y: 76, w: width - 2, h: height - 76 - 46 }}
        />
      ) : (
        <CalendarOffline width={width} height={height} loading={props.calendarLoading} />
      )}
    </Shell>
  );
}
