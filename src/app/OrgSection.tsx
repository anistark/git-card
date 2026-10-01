import { KIND_STYLE } from '../cards/Orgs';
import { cardsIn } from '../cards/registry';
import { fmt } from '../lib/format';
import { KINDS, type Counts, type Profile } from '../lib/profile';
import { CardFigure } from './CardFigure';

const pad = (n: number) => String(n).padStart(2, '0');
const plural = (n: number, one: string) => `${fmt(n)} ${n === 1 ? one : `${one}s`}`;
const summary = (c: Counts) =>
  [
    c.commits && plural(c.commits, 'commit'),
    c.pullRequests && plural(c.pullRequests, 'PR'),
    c.reviews && plural(c.reviews, 'review'),
    c.issues && plural(c.issues, 'issue'),
  ]
    .filter(Boolean)
    .join(' · ');

export function OrgSection({ profile }: { profile: Profile }) {
  const orgs = profile.owners.filter((o) => o.type === 'org');
  const others = profile.owners.filter((o) => o.type === 'user').slice(0, 8);
  const active = new Set(orgs.map((o) => o.login.toLowerCase()));
  const quiet = profile.memberOf.filter((m) => !active.has(m.login.toLowerCase()));

  return (
    <section className="org-section" aria-labelledby="orgs-heading">
      <p className="eyebrow">Organizations // last 12 months</p>
      <h2 className="title rgb" id="orgs-heading">
        Where the work went.
      </h2>
      <p className="lead">
        Public commits, pull requests, reviews and issues, grouped by the account that owns the repository. Based on the most recent 100 of
        each.
      </p>

      {cardsIn('orgs').map((id) => (
        <CardFigure key={id} profile={profile} card={id} />
      ))}

      {orgs.length > 0 ? (
        <ol className="org-grid">
          {orgs.map((org, i) => (
            <li key={org.login} className="org hud">
              <header className="org-head">
                <img className="org-avatar" src={org.avatarUrl} alt="" width={48} height={48} loading="lazy" />
                <div className="org-id">
                  <span className="org-rank">{pad(i + 1)}</span>
                  <a className="org-name" href={`https://github.com/${org.login}`} rel="noopener">
                    {org.name || org.login}
                  </a>
                  {org.name && <span className="caption">@{org.login}</span>}
                </div>
                <span className="org-total tabular" title={`${org.total} contributions`}>
                  {fmt(org.total)}
                </span>
              </header>
              <div className="mix" aria-hidden="true">
                {KINDS.map((k) => org[k] > 0 && <span key={k} className={`mix-${k}`} style={{ flexGrow: org[k] }} />)}
              </div>
              <dl className="org-stats tabular">
                {KINDS.map((k) => (
                  <div key={k} className={org[k] === 0 ? 'zero' : undefined}>
                    <dt>
                      <span className={`key mix-${k}`} aria-hidden="true" />
                      {KIND_STYLE[k].label}
                    </dt>
                    <dd>{fmt(org[k])}</dd>
                  </div>
                ))}
              </dl>
              <ul className="org-repos">
                {org.repos.slice(0, 5).map((r) => (
                  <li key={r.name}>
                    <a href={`https://github.com/${org.login}/${r.name}`} rel="noopener">
                      {r.name}
                    </a>
                    <span className="caption tabular">{summary(r)}</span>
                  </li>
                ))}
                {org.repos.length > 5 && <li className="caption">+{org.repos.length - 5} more repos</li>}
              </ul>
            </li>
          ))}
        </ol>
      ) : (
        <p className="caption org-empty">No public contributions to organizations found in the last 12 months.</p>
      )}

      {others.length > 0 && (
        <div className="org-sub">
          <p className="eyebrow">Other people's repos</p>
          <ul className="owner-list">
            {others.map((o) => (
              <li key={o.login}>
                <img src={o.avatarUrl} alt="" width={28} height={28} loading="lazy" />
                <a href={`https://github.com/${o.login}`} rel="noopener">
                  @{o.login}
                </a>
                <span className="caption tabular">{summary(o)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {quiet.length > 0 && (
        <div className="org-sub">
          <p className="eyebrow">Also a member of</p>
          <ul className="chips">
            {quiet.map((m) => (
              <li key={m.login}>
                <a href={`https://github.com/${m.login}`} rel="noopener">
                  <img src={m.avatarUrl} alt="" width={24} height={24} loading="lazy" />
                  {m.login}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="caption">Public repositories only. Contributions to private repositories are never shown.</p>
    </section>
  );
}
