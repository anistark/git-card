import { fmt, maxChars, PAD, SIZES, Shell, truncate, type CardProps } from './shell';

const ROWS = 5;
const ROW_H = 54;

// Rough advance widths at 24px in the display face, enough to park the star next to the number.
const numWidth = (s: string) => [...s].reduce((w, c) => w + (c === '.' ? 6 : 13.5), 0);

/** A drawn star, because not every font (or renderer) has the glyph. */
function Star({ cx, cy, r, className }: { cx: number; cy: number; r: number; className: string }) {
  const points = Array.from({ length: 10 }, (_, i) => {
    const radius = i % 2 === 0 ? r : r * 0.45;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    return `${(cx + radius * Math.cos(angle)).toFixed(1)},${(cy + radius * Math.sin(angle)).toFixed(1)}`;
  }).join(' ');
  return <polygon className={className} points={points} />;
}

export function TopReposCard(props: CardProps) {
  const { profile } = props;
  const inner = SIZES.standard.width - PAD * 2;
  const repos = profile.topRepos.slice(0, ROWS);
  const nameX = PAD + 34;
  const textW = inner - 34 - 110;

  return (
    <Shell
      {...props}
      id="top-repos"
      tag="REP"
      size="standard"
      eyebrow="Top repositories"
      label={`Top repositories: ${repos.map((r) => `${r.name} (${r.stars} stars)`).join(', ')}`}
    >
      {repos.length === 0 && (
        <text className="gc-muted" x={PAD} y={120} fontSize={16}>
          NO SIGNAL. No public repositories yet.
        </text>
      )}
      {repos.map((repo, i) => {
        const y = 100 + i * ROW_H;
        const meta = [repo.language?.toUpperCase(), `${fmt(repo.forks)} FORKS`].filter(Boolean).join(' // ');
        const first = i === 0 && repo.stars > 0;
        return (
          <g key={repo.name} className="gc-a-rise" style={{ animationDelay: `${i * 80}ms` }}>
            {i > 0 && <line className="gc-rule" x1={PAD} x2={PAD + inner} y1={y - 26} y2={y - 26} strokeDasharray="2 4" />}
            <text className={first ? 'gc-accent gc-d' : 'gc-muted gc-d'} x={PAD} y={y} fontSize={14} fontWeight={700}>
              {String(i + 1).padStart(2, '0')}
            </text>
            <text className="gc-fg" x={nameX} y={y} fontSize={17}>
              {truncate(repo.name, maxChars(textW, 17))}
            </text>
            <text className="gc-muted" x={nameX} y={y + 20} fontSize={13}>
              {truncate(meta, maxChars(textW, 13))}
            </text>
            <text
              className={`gc-num gc-d ${first ? 'gc-accent gc-glow' : 'gc-fg'}`}
              x={PAD + inner}
              y={y + 8}
              fontSize={24}
              fontWeight={600}
              textAnchor="end"
            >
              {fmt(repo.stars)}
            </text>
            <Star cx={PAD + inner - numWidth(fmt(repo.stars)) - 14} cy={y} r={8} className={first ? 'gc-accent gc-glow' : 'gc-muted'} />
          </g>
        );
      })}
    </Shell>
  );
}
