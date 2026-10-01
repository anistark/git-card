import { leveller } from './levels';
import { hasCalendar } from '../lib/profile';
import { CalendarOffline, fmt, monthName, Neon, PAD, Shell, shortDate, WEEKDAYS, type CardProps } from './shell';

const STEP = 12;
const CELL = 10;
const GRID_X = PAD + 32;
const GRID_Y = 156;

export function HeatmapCard(props: CardProps) {
  const { profile } = props;
  if (!hasCalendar(profile)) {
    return (
      <Shell
        {...props}
        id="heatmap"
        tag="CAL"
        size="wide"
        eyebrow="Contributions · last 12 months"
        label="Contribution calendar unavailable"
      >
        <CalendarOffline width={760} height={400} />
      </Shell>
    );
  }
  const level = leveller(profile);
  const busiest = profile.byWeekday.indexOf(Math.max(...profile.byWeekday));

  // Month label above the first week that starts in a new month, skipping ones that would collide.
  const months: { x: number; label: string }[] = [];
  profile.weeks.forEach((week, i) => {
    const first = week[0];
    if (!first) return;
    const prev = profile.weeks[i - 1]?.[0];
    if (prev && prev.date.slice(5, 7) === first.date.slice(5, 7)) return;
    const x = GRID_X + i * STEP;
    if (months.length && x - months[months.length - 1].x < 36) return;
    months.push({ x, label: monthName(first.date) });
  });

  const stats = [
    { label: 'Peak day', value: profile.peakDay ? `${shortDate(profile.peakDay.date)} · ${profile.peakDay.count}` : 'None yet' },
    { label: 'Busiest weekday', value: profile.totals.contributions ? WEEKDAYS[busiest] : 'None yet' },
    { label: 'Commits', value: fmt(profile.totals.commits) },
  ];

  return (
    <Shell
      {...props}
      id="heatmap"
      tag="CAL"
      size="wide"
      eyebrow="Contributions · last 12 months"
      label={`${profile.totals.contributions} contributions in the last year`}
    >
      <Neon className="gc-accent gc-num gc-d" x={PAD} y={106} fontSize={48} fontWeight={700}>
        {profile.totals.contributions.toLocaleString('en-US')}
      </Neon>

      {months.map((m) => (
        <text key={m.x} className="gc-muted" x={m.x} y={GRID_Y - 10} fontSize={12}>
          {m.label}
        </text>
      ))}
      {[1, 3, 5].map((d) => (
        <text key={d} className="gc-muted" x={PAD} y={GRID_Y + d * STEP + CELL - 1} fontSize={12}>
          {WEEKDAYS[d]}
        </text>
      ))}

      {profile.weeks.map((week, w) => (
        <g key={w} className="gc-a-fade" style={{ animationDelay: `${w * 14}ms` }}>
          {week.map((day) => (
            <rect
              key={day.date}
              className={level(day) === 5 ? 'gc-l5 gc-glow' : `gc-l${level(day)}`}
              x={GRID_X + w * STEP}
              y={GRID_Y + day.weekday * STEP}
              width={CELL}
              height={CELL}
            >
              <title>{`${day.count} on ${shortDate(day.date)}`}</title>
            </rect>
          ))}
        </g>
      ))}

      {stats.map((s, i) => (
        <g key={s.label} className="gc-a-rise" style={{ animationDelay: `${500 + i * 80}ms` }}>
          <text className="gc-muted gc-d" x={PAD + i * 230} y={284} fontSize={12} fontWeight={600} letterSpacing="0.16em">
            {s.label.toUpperCase()}
          </text>
          <text
            className={`gc-num gc-d ${i === 0 && profile.peakDay ? 'gc-hot gc-glow' : 'gc-fg'}`}
            x={PAD + i * 230}
            y={314}
            fontSize={24}
            fontWeight={600}
          >
            {s.value}
          </text>
        </g>
      ))}

      <g transform={`translate(${760 - PAD}, 104)`}>
        <text className="gc-muted" textAnchor="end" x={-5 * STEP - 48} y={-1} fontSize={12}>
          Less
        </text>
        {[0, 1, 2, 3, 4].map((l) => (
          <rect key={l} className={`gc-l${l}`} x={-5 * STEP - 40 + l * STEP} y={-CELL} width={CELL} height={CELL} />
        ))}
        <text className="gc-muted" textAnchor="end" y={-1} fontSize={12}>
          More
        </text>
      </g>
    </Shell>
  );
}
