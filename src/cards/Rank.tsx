import { ELITE, formatStanding, formatTop, rankProfile, TIERS } from '../lib/rank';
import { Meter, Neon, PAD, SIZES, Shell, type CardProps } from './shell';

/** The F to SSS rank: the tier in big letters, how each category contributes, and the full ladder. */
export function RankCard(props: CardProps) {
  const { profile } = props;
  const rank = rankProfile(profile);
  const { width } = SIZES.wide;
  // Without the calendar, contributions and active days read as zero and the tier would be wrong. Show none.
  const pending = !rank.complete;
  const right = width - PAD;
  const panel = 352; // x where the right-hand panel starts
  const panelW = right - panel;

  // Tier letters shrink to fit: one letter is huge, three still fit the left panel.
  const letters = pending ? '?' : rank.tier.name;
  const size = letters.length === 1 ? 176 : letters.length === 2 ? 150 : 120;
  const baseline = 160 + size * 0.5;
  const tone = pending ? 'gc-muted' : rank.elite ? 'gc-accent' : rank.tier.name === 'F' || rank.tier.name === 'E' ? 'gc-muted' : 'gc-fg';

  // Ladder, worst to best, left to right.
  const ladder = [...TIERS].reverse();
  const cell = { w: 40, gap: 3.5 };
  const ladderX = right - ladder.length * (cell.w + cell.gap) + cell.gap;
  const eliteStart = ladder.findIndex((t) => ELITE.has(t.name));

  return (
    <Shell
      {...props}
      id="rank"
      tag="RNK"
      size="wide"
      eyebrow="Rank · F to SSS"
      label={
        pending
          ? 'Rank pending: contribution calendar offline'
          : `Rank ${rank.tier.name} (${rank.tier.title}): estimated ${formatStanding(rank.top).toLowerCase()} of active GitHub developers`
      }
    >
      {/* Left: the tier. */}
      <g className="gc-a-rise">
        {rank.elite && !pending && (
          <g>
            <rect className="gc-hot" x={PAD} y={64} width={112} height={20} />
            <text className="gc-d gc-on-fill" x={PAD + 56} y={78} fontSize={11} fontWeight={700} letterSpacing="0.2em" textAnchor="middle">
              SUPER ELITE
            </text>
          </g>
        )}
        <Neon
          className={`${tone} gc-d`}
          x={PAD - 4}
          y={baseline}
          fontSize={size}
          fontWeight={700}
          letterSpacing="-0.02em"
          split={rank.elite ? 3.5 : 2}
        >
          {letters}
        </Neon>
        <text className="gc-fg gc-d" x={PAD} y={292} fontSize={20} fontWeight={700} letterSpacing="0.12em">
          {pending ? 'PENDING' : rank.tier.title.toUpperCase()}
        </text>
        <text className="gc-accent gc-num gc-d gc-glow" x={PAD} y={324} fontSize={22} fontWeight={700}>
          {pending ? 'CALENDAR OFFLINE' : formatStanding(rank.top).toUpperCase()}
        </text>
        <text className="gc-muted" x={PAD} y={346} fontSize={13}>
          {pending
            ? 'Refresh in a minute to rank.'
            : rank.next
              ? `Next: ${rank.next.name} at top ${formatTop(rank.next.top)}`
              : 'Maximum rank'}
        </text>
      </g>

      {/* Right: categories. Meters show how far each sits above the developer population, 0 to 100. */}
      {rank.categories.map((c, i) => {
        const y = 92 + i * 56;
        return (
          <g key={c.key} className="gc-a-fade" style={{ animationDelay: `${150 + i * 90}ms` }}>
            <text className="gc-fg gc-d" x={panel} y={y} fontSize={14} fontWeight={700} letterSpacing="0.14em">
              {c.label.toUpperCase()}
            </text>
            <text className="gc-muted gc-num gc-d" x={right} y={y} fontSize={14} fontWeight={600} textAnchor="end">
              {formatStanding(c.top).toUpperCase()}
            </text>
            <Meter x={panel} y={y + 16} width={panelW} fill={1 - c.top} delay={250 + i * 90} />
          </g>
        );
      })}

      {/* Ladder: every tier, current one lit, the super elite bracketed. */}
      <g>
        {eliteStart >= 0 && (
          <g>
            <path
              className="gc-accent-s"
              fill="none"
              strokeWidth={1.5}
              d={`M${ladderX + eliteStart * (cell.w + cell.gap)},${282} v-8 H${right} v8`}
            />
            <text className="gc-accent gc-d" x={right} y={266} fontSize={11} fontWeight={700} letterSpacing="0.2em" textAnchor="end">
              SUPER ELITE
            </text>
          </g>
        )}
        {ladder.map((t, i) => {
          const x = ladderX + i * (cell.w + cell.gap);
          const current = !pending && t.name === rank.tier.name;
          return (
            <g key={t.name}>
              <rect className={current ? (rank.elite ? 'gc-hot' : 'gc-data') : 'gc-track'} x={x} y={290} width={cell.w} height={30} />
              <text
                className={`gc-d ${current ? 'gc-on-fill' : 'gc-muted'}`}
                x={x + cell.w / 2}
                y={310}
                fontSize={t.name.length === 3 ? 11 : 13}
                fontWeight={700}
                textAnchor="middle"
              >
                {t.name}
              </text>
            </g>
          );
        })}
        <text className="gc-muted" x={panel} y={346} fontSize={12}>
          Estimated against a model of active GitHub developers.
        </text>
      </g>
    </Shell>
  );
}
