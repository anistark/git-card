import { fmt, maxChars, Neon, PAD, SIZES, Shell, truncate, wrap, type CardProps } from './shell';

export function OverviewCard(props: CardProps) {
  const { profile } = props;
  const { width } = SIZES.standard;
  const inner = width - PAD * 2;
  const name = truncate((profile.name || profile.login).toUpperCase(), maxChars(inner, 40));
  const sub = [`ID ${profile.login}`, profile.location && `LOC ${profile.location}`].filter(Boolean).join(' // ');
  const bio = profile.bio ? wrap(profile.bio, maxChars(inner, 15), 2) : [];

  const stats = [
    { label: 'Stars earned', value: fmt(profile.totals.stars), hero: true },
    { label: 'Contributions', value: fmt(profile.totals.contributions) },
    { label: 'Followers', value: fmt(profile.followers) },
    { label: 'Public repos', value: fmt(profile.totals.repos) },
    { label: 'Pull requests', value: fmt(profile.totals.pullRequests) },
    { label: 'Online since', value: profile.createdAt.slice(0, 4) },
  ];
  const colW = inner / 3;

  return (
    <Shell
      {...props}
      id="overview"
      tag="PRF"
      size="standard"
      eyebrow="Profile"
      label={`${profile.name || profile.login}: ${profile.totals.stars} stars, ${profile.totals.contributions} contributions in the last year`}
    >
      <Neon className="gc-fg gc-d" x={PAD} y={104} fontSize={40} fontWeight={700} letterSpacing="0.01em" split={1.5}>
        {name}
      </Neon>
      <text className="gc-muted" x={PAD} y={130} fontSize={14}>
        {truncate(sub, maxChars(inner, 14))}
      </text>
      {bio.map((line, i) => (
        <text key={i} className="gc-fg" x={PAD} y={164 + i * 22} fontSize={15} opacity={0.85}>
          {line}
        </text>
      ))}
      <line className="gc-rule" x1={PAD} x2={PAD + inner} y1={206} y2={206} strokeDasharray="2 4" />
      {stats.map((s, i) => {
        const x = PAD + (i % 3) * colW;
        const y = i < 3 ? 252 : 316;
        return (
          <g key={s.label} className="gc-a-rise" style={{ animationDelay: `${120 + i * 60}ms` }}>
            {s.hero ? (
              <Neon className="gc-accent gc-num gc-d" x={x} y={y} fontSize={34} fontWeight={700}>
                {s.value}
              </Neon>
            ) : (
              <text className="gc-fg gc-num gc-d" x={x} y={y} fontSize={34} fontWeight={600}>
                {s.value}
              </text>
            )}
            <text className="gc-muted gc-d" x={x} y={y + 20} fontSize={12} letterSpacing="0.16em" fontWeight={600}>
              {s.label.toUpperCase()}
            </text>
          </g>
        );
      })}
    </Shell>
  );
}
