import { Meter, PAD, SIZES, Shell, type CardProps } from './shell';

export function LanguagesCard(props: CardProps) {
  const { profile } = props;
  const inner = SIZES.standard.width - PAD * 2;
  const top = profile.languages[0]?.share ?? 1;

  return (
    <Shell
      {...props}
      id="languages"
      tag="LNG"
      size="standard"
      eyebrow="Languages · by bytes"
      label={`Top languages: ${profile.languages.map((l) => `${l.name} ${Math.round(l.share * 100)}%`).join(', ')}`}
    >
      {profile.languages.length === 0 && (
        <text className="gc-muted" x={PAD} y={120} fontSize={16}>
          NO SIGNAL. No public code yet.
        </text>
      )}
      {profile.languages.map((lang, i) => {
        const y = 98 + i * 40;
        const pct = lang.share * 100;
        return (
          <g key={lang.name} className="gc-a-fade" style={{ animationDelay: `${i * 70}ms` }}>
            <text className="gc-muted gc-d" x={PAD} y={y} fontSize={13} fontWeight={600}>
              {String(i + 1).padStart(2, '0')}
            </text>
            <text className="gc-fg" x={PAD + 30} y={y} fontSize={16}>
              {lang.name}
            </text>
            <text
              className={`gc-num gc-d ${i === 0 ? 'gc-accent gc-glow' : 'gc-muted'}`}
              x={PAD + inner}
              y={y}
              fontSize={17}
              fontWeight={600}
              textAnchor="end"
            >
              {pct < 1 ? '<1' : pct.toFixed(pct < 10 ? 1 : 0)}%
            </text>
            {/* Meters are scaled to the top language so the ranking reads at a glance. */}
            <Meter x={PAD} y={y + 14} width={inner} fill={lang.share / top} delay={150 + i * 70} />
          </g>
        );
      })}
    </Shell>
  );
}
