import { Neon, PAD, SIZES, Shell, shortDate, WEEKDAYS, type CardProps } from './shell';

export function StreakCard(props: CardProps) {
  const { profile } = props;
  const { current, longest, longestStart, longestEnd } = profile.streaks;
  const inner = SIZES.standard.width - PAD * 2;
  const right = PAD + inner * 0.56;

  const max = Math.max(1, ...profile.byWeekday);
  const busiest = profile.byWeekday.indexOf(max);
  const slot = inner / 7;
  const barW = slot - 14;
  const base = 334;
  const barMax = 64;
  const seg = 4; // segmented bars: 4px cells with 2px gaps

  return (
    <Shell
      {...props}
      id="streak"
      tag="STR"
      size="standard"
      eyebrow="Streak"
      label={`Current streak ${current} days, longest ${longest} days`}
    >
      <g className="gc-a-rise">
        <Neon
          className={`gc-num gc-d ${current > 0 ? 'gc-accent' : 'gc-fg'}`}
          x={PAD - 4}
          y={188}
          fontSize={120}
          fontWeight={700}
          letterSpacing="-0.02em"
          split={3}
        >
          {current}
        </Neon>
        <text className="gc-muted gc-d" x={PAD} y={216} fontSize={13} fontWeight={600} letterSpacing="0.16em">
          {current === 1 ? 'DAY IN A ROW' : 'DAYS IN A ROW'}
        </text>
      </g>

      <g className="gc-a-rise" style={{ animationDelay: '120ms' }}>
        <text className="gc-muted gc-d" x={right} y={104} fontSize={12} fontWeight={600} letterSpacing="0.16em">
          LONGEST RUN
        </text>
        <text className="gc-fg gc-num gc-d" x={right} y={150} fontSize={44} fontWeight={600}>
          {longest}
          <tspan className="gc-muted" fontSize={15} dx={8}>
            days
          </tspan>
        </text>
        {longestStart && longestEnd && (
          <text className="gc-muted" x={right} y={176} fontSize={14}>
            {shortDate(longestStart)} to {shortDate(longestEnd)}
          </text>
        )}
      </g>

      <text className="gc-muted gc-d" x={PAD} y={base - barMax - 16} fontSize={12} fontWeight={600} letterSpacing="0.16em">
        WEEKLY RHYTHM
      </text>
      {profile.byWeekday.map((count, d) => {
        const h = Math.max(seg, Math.round(((count / max) * barMax) / (seg + 2)) * (seg + 2));
        const x = PAD + d * slot;
        const hot = d === busiest && count > 0;
        return (
          <g key={d}>
            <title>{`${count} contributions on ${WEEKDAYS[d]}s`}</title>
            <line
              className="gc-track-s"
              x1={x + barW / 2}
              x2={x + barW / 2}
              y1={base}
              y2={base - barMax}
              strokeWidth={barW}
              strokeDasharray={`${seg} 2`}
            />
            <line
              // No glow filter here: a vertical line has a zero-width bounding box, so a filter would clip it away.
              className={`gc-a-up ${hot ? 'gc-accent-s' : 'gc-data-s'}`}
              x1={x + barW / 2}
              x2={x + barW / 2}
              y1={base}
              y2={base - h}
              strokeWidth={barW}
              strokeDasharray={`${seg} 2`}
              style={{ animationDelay: `${200 + d * 60}ms` }}
            />
            <text
              className={hot ? 'gc-accent gc-d' : 'gc-muted gc-d'}
              x={x + barW / 2}
              y={base + 20}
              fontSize={12}
              fontWeight={600}
              textAnchor="middle"
            >
              {WEEKDAYS[d].toUpperCase()}
            </text>
          </g>
        );
      })}
    </Shell>
  );
}
