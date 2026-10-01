import { KINDS, ownershipSplit, type Kind } from '../lib/profile';
import { fmt, maxChars, Neon, PAD, SIZES, Shell, truncate, type CardProps } from './shell';

const ROWS = 5;
const ROW_H = 32;

// One color per kind of contribution, all from the palette. The hot color stays reserved for the peak day.
export const KIND_STYLE: Record<Kind, { label: string; className: string }> = {
  commits: { label: 'Commits', className: 'gc-data' },
  pullRequests: { label: 'PRs', className: 'gc-accent' },
  reviews: { label: 'Reviews', className: 'gc-fg' },
  issues: { label: 'Issues', className: 'gc-muted' },
};

export function OrgsCard(props: CardProps) {
  const { profile } = props;
  const { width } = SIZES.wide;
  const right = width - PAD;
  const orgs = profile.owners.filter((o) => o.type === 'org');
  const shown = orgs.slice(0, ROWS);
  const max = Math.max(1, ...shown.map((o) => o.total));

  const split = ownershipSplit(profile.owners);
  const all = split.org + split.self + split.user;
  const shares = [
    { key: 'org', label: 'Orgs', value: split.org, className: 'gc-data' },
    { key: 'self', label: 'Own', value: split.self, className: 'gc-muted' },
    { key: 'user', label: 'Others', value: split.user, className: 'gc-track' },
  ].filter((s) => s.value > 0);
  const pct = (v: number) => {
    const p = (v / all) * 100;
    return p < 1 ? '<1%' : `${Math.round(p)}%`;
  };

  // Numeric columns, right aligned, and the mix bar between the name and the numbers.
  const cols = KINDS.map((kind, i) => ({ kind, x: right - (KINDS.length - 1 - i) * 74 }));
  const bar = { x: 262, w: 150 };
  const nameW = bar.x - (PAD + 30) - 12;

  return (
    <Shell
      {...props}
      id="orgs"
      tag="ORG"
      size="wide"
      eyebrow="Organizations · last 12 months"
      label={`Contributions to ${orgs.length} organizations in the last year: ${shown.map((o) => `${o.login} ${o.total}`).join(', ')}`}
    >
      <g className="gc-a-rise">
        <Neon className="gc-accent gc-num gc-d" x={PAD} y={110} fontSize={48} fontWeight={700}>
          {orgs.length}
        </Neon>
        <text
          className="gc-muted gc-d"
          x={PAD + String(orgs.length).length * 30 + 14}
          y={108}
          fontSize={13}
          fontWeight={600}
          letterSpacing="0.16em"
        >
          {orgs.length === 1 ? 'ORG' : 'ORGS'}
        </text>
      </g>

      {/* Where the year's public work went: organizations, own repos, other people's repos. */}
      {all > 0 && (
        <g>
          <text className="gc-muted gc-d" x={300} y={78} fontSize={12} fontWeight={600} letterSpacing="0.16em">
            WHERE THE WORK WENT
          </text>
          {(() => {
            let x = 300;
            const w = right - 300;
            return shares.map((s, i) => {
              const segW = (s.value / all) * w;
              const seg = (
                <rect
                  key={s.key}
                  className={`${s.className} gc-a-grow`}
                  x={x}
                  y={88}
                  width={Math.max(0, segW - (segW > 2 ? 2 : 0))}
                  height={10}
                  style={{ animationDelay: `${i * 90}ms` }}
                />
              );
              x += segW;
              return seg;
            });
          })()}
          {shares.map((s, i) => (
            <g key={s.key} transform={`translate(${300 + i * 140}, 118)`}>
              <rect className={s.className} x={0} y={-9} width={9} height={9} />
              <text className="gc-muted gc-d" x={15} y={0} fontSize={12} fontWeight={600} letterSpacing="0.12em">
                {s.label.toUpperCase()} {pct(s.value)}
              </text>
            </g>
          ))}
        </g>
      )}

      {shown.length === 0 ? (
        <text className="gc-muted" x={PAD} y={190} fontSize={16}>
          NO ORG SIGNAL. No public contributions to organizations this year.
        </text>
      ) : (
        <g>
          <line className="gc-rule" x1={PAD} x2={right} y1={146} y2={146} strokeDasharray="2 4" />
          <text className="gc-muted gc-d" x={PAD} y={166} fontSize={12} fontWeight={600} letterSpacing="0.16em">
            ORGANIZATION
          </text>
          <text className="gc-muted gc-d" x={bar.x} y={166} fontSize={12} fontWeight={600} letterSpacing="0.16em">
            MIX
          </text>
          {/* Header labels are colored like their mix segments, so they double as the legend. */}
          {cols.map(({ kind, x }) => (
            <text
              key={kind}
              className={`${KIND_STYLE[kind].className} gc-d`}
              x={x}
              y={166}
              fontSize={12}
              fontWeight={600}
              letterSpacing="0.1em"
              textAnchor="end"
            >
              {KIND_STYLE[kind].label.toUpperCase()}
            </text>
          ))}

          {shown.map((org, i) => {
            const y = 200 + i * ROW_H;
            let bx = bar.x;
            const scale = (bar.w * org.total) / max;
            return (
              <g key={org.login} className="gc-a-rise" style={{ animationDelay: `${120 + i * 70}ms` }}>
                <text className={`gc-d ${i === 0 ? 'gc-accent' : 'gc-muted'}`} x={PAD} y={y} fontSize={13} fontWeight={700}>
                  {String(i + 1).padStart(2, '0')}
                </text>
                <text className="gc-fg" x={PAD + 30} y={y} fontSize={15}>
                  {truncate(org.login, maxChars(nameW, 15))}
                </text>
                {KINDS.map((kind) => {
                  const w = (org[kind] / org.total) * scale;
                  const seg = w > 0 && (
                    <rect key={kind} className={KIND_STYLE[kind].className} x={bx} y={y - 10} width={Math.max(1, w - 1)} height={10} />
                  );
                  bx += w;
                  return seg;
                })}
                {cols.map(({ kind, x }) => (
                  <text
                    key={kind}
                    className={`gc-num gc-d ${org[kind] ? 'gc-fg' : 'gc-muted'}`}
                    x={x}
                    y={y}
                    fontSize={17}
                    fontWeight={600}
                    textAnchor="end"
                  >
                    {org[kind] ? fmt(org[kind]) : '-'}
                  </text>
                ))}
              </g>
            );
          })}
          {orgs.length > ROWS && (
            <text className="gc-muted gc-d" x={PAD + 30} y={200 + ROWS * ROW_H - 6} fontSize={12} fontWeight={600} letterSpacing="0.16em">
              +{orgs.length - ROWS} MORE
            </text>
          )}
        </g>
      )}
    </Shell>
  );
}
