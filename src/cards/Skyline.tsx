import type { Profile } from '../lib/profile';
import { heightOf, leveller, skylineFill } from './levels';
import { PAD, SIZES, Shell, shortDate, type CardProps } from './shell';

// Oblique projection: weeks run right and slightly down, weekdays run left and down, height is up.
const W = { x: 10, y: 2.4 };
const D = { x: -6.5, y: 5.2 };
const FILL = 0.82;
const MAX_H = 95;

type Pt = [number, number];
const r = (n: number) => Math.round(n * 10) / 10;
const pts = (list: Pt[]) => list.map(([x, y]) => `${r(x)},${r(y)}`).join(' ');

interface CityProps {
  profile: Profile;
  /** The box the city is scaled to fit and centered in. */
  box: { x: number; y: number; w: number; h: number };
  /** Stagger each week in with a CSS animation. */
  animate?: boolean;
}

/** The isometric city itself: one block per day on a grid floor. Shared by the skyline card and the OG image. */
export function SkylineCity({ profile, box, animate = true }: CityProps) {
  const level = leveller(profile);
  const max = profile.peakDay?.count ?? 0;
  const weeks = profile.weeks.length;

  const columns = profile.weeks.map((week, w) =>
    week.map((day) => {
      const px = w * W.x + day.weekday * D.x;
      const py = w * W.y + day.weekday * D.y;
      const a: Pt = [px, py];
      const b: Pt = [px + FILL * W.x, py + FILL * W.y];
      const c: Pt = [b[0] + FILL * D.x, b[1] + FILL * D.y];
      const e: Pt = [px + FILL * D.x, py + FILL * D.y];
      const h = day.count > 0 ? 2 + heightOf(day.count, max) * MAX_H : 0;
      const up = ([x, y]: Pt): Pt => [x, y - h];
      return { day, level: level(day), h, top: [up(a), up(b), up(c), up(e)], right: [b, c, up(c), up(b)], front: [e, c, up(c), up(e)] };
    }),
  );

  const all = columns.flat().flatMap((col) => [...col.top, ...col.right, ...col.front]) as Pt[];
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

  return (
    <g className="gc-sk" transform={`translate(${r(tx)} ${r(ty)}) scale(${r(scale * 100) / 100})`}>
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
              .filter((c) => c.level === 0)
              .map(({ day, top }) => (
                <polygon key={day.date} className="gc-sea" points={pts(top)}>
                  <title>{`0 on ${shortDate(day.date)}`}</title>
                </polygon>
              ))}
          </g>
        ))}
      </g>
      {columns.map((col, w) => (
        <g key={w} className={animate ? 'gc-a-rise' : undefined} style={animate ? { animationDelay: `${w * 12}ms` } : undefined}>
          {col
            .filter((c) => c.level > 0)
            .map(({ day, level: l, h, top, right, front }) => (
              <g key={day.date} className={l === 5 ? 'gc-glow' : undefined}>
                <title>{`${day.count} on ${shortDate(day.date)}`}</title>
                {h > 0 && <polygon className={`r ${skylineFill(l)}`} points={pts(right)} />}
                {h > 0 && <polygon className={`f ${skylineFill(l)}`} points={pts(front)} />}
                <polygon className={skylineFill(l)} points={pts(top)} />
              </g>
            ))}
        </g>
      ))}
    </g>
  );
}

/** The isometric SVG skyline. Doubles as the README image and the no-JS fallback for the 3D one. */
export function SkylineCard(props: CardProps) {
  const { profile } = props;
  const { width, height } = SIZES.wide;
  const first = profile.weeks[0]?.[0]?.date;
  const last = profile.weeks.at(-1)?.at(-1)?.date;

  return (
    <Shell
      {...props}
      id="skyline"
      tag="SKY"
      size="wide"
      eyebrow="Contribution skyline"
      label={`Contribution skyline: ${profile.totals.contributions} contributions in the last year`}
    >
      {first && last && (
        <text className="gc-muted" x={PAD} y={PAD + 36} fontSize={13}>
          {shortDate(first)} {first.slice(0, 4)} to {shortDate(last)} {last.slice(0, 4)}
        </text>
      )}
      <SkylineCity profile={profile} box={{ x: PAD, y: 92, w: width - PAD * 2, h: height - 92 - 52 }} />
    </Shell>
  );
}
