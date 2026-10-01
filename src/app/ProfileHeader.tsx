import { fmt } from '../lib/format';
import type { Profile } from '../lib/profile';
import { formatStanding, type Rank } from '../lib/rank';
import { urls } from '../lib/urls';

export function RankBadge({ login, rank }: { login: string; rank: Rank }) {
  if (!rank.complete) {
    return (
      <a
        className="rank-badge"
        href={urls.card(login, 'rank')}
        title="The rank needs the contribution calendar, which could not be loaded. Refresh in a minute."
      >
        <span className="rank-label">Rank</span>
        <span className="rank-tier">?</span>
        <span className="rank-top tabular">Calendar offline</span>
      </a>
    );
  }
  return (
    <a
      className={rank.elite ? 'rank-badge elite' : 'rank-badge'}
      href={urls.card(login, 'rank')}
      title={`${rank.tier.title}: estimated ${formatStanding(rank.top).toLowerCase()} of active GitHub developers`}
    >
      <span className="rank-label">Rank</span>
      <span className="rank-tier">{rank.tier.name}</span>
      <span className="rank-top tabular">{formatStanding(rank.top)}</span>
    </a>
  );
}

export function ProfileHeader({ profile, rank }: { profile: Profile; rank: Rank }) {
  const display = profile.name || profile.login;
  const hud = [
    `ONLINE SINCE ${profile.createdAt.slice(0, 4)}`,
    profile.location && `LOC ${profile.location.toUpperCase()}`,
    `${fmt(profile.followers)} FOLLOWERS`,
  ]
    .filter(Boolean)
    .join(' // ');
  return (
    <header className="profile-head">
      <div className="avatar-frame hud">
        <img src={profile.avatarUrl} alt="" width={112} height={112} />
      </div>
      <div>
        <p className="eyebrow">Subject // @{profile.login}</p>
        <h1 className="title glitch rgb" data-text={display}>
          {display}
        </h1>
        <p className="profile-hud tabular">{hud}</p>
        {profile.bio && <p className="caption profile-bio">{profile.bio}</p>}
      </div>
      <div className="profile-side">
        <RankBadge login={profile.login} rank={rank} />
        <a className="btn btn-ghost" href={`https://github.com/${profile.login}`} rel="noopener">
          GitHub ↗
        </a>
      </div>
    </header>
  );
}
