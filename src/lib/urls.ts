// Every internal link goes through here, because a GitHub Pages project site lives under /<repo>/.
// Profiles and cards use query strings (u/?user=x) rather than paths (u/x), since a static host has no
// rewrites: u/index.html exists, u/x/index.html does not.

import type { Theme } from '../cards/style';

const BASE = (import.meta.env?.BASE_URL ?? '/').replace(/\/?$/, '/');

export const href = (path = '') => BASE + path.replace(/^\//, '');

/** UTM tags, so Google Analytics can tell which pasted snippet a visit came from. */
export interface Utm {
  source: string;
  medium: string;
  campaign?: string;
}

export interface CardLinkOptions {
  embed?: boolean;
  theme?: Theme;
}

const query = (params: Record<string, string | boolean | undefined>) => {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== false && v !== 'auto')
    .map(([k, v]) => (v === true ? k : `${k}=${encodeURIComponent(String(v))}`));
  return parts.length ? `?${parts.join('&')}` : '';
};

const utm = (tags?: Utm) => tags && { utm_source: tags.source, utm_medium: tags.medium, utm_campaign: tags.campaign };

export const urls = {
  home: () => href(''),
  rank: () => href('rank/'),
  profile: (login: string, tags?: Utm) => href(`u/${query({ user: login, ...utm(tags) })}`),
  card: (login: string, card: string, opts: CardLinkOptions = {}) =>
    href(`card/${query({ user: login, id: card, embed: opts.embed, theme: opts.theme })}`),
  /** Pre-rendered SVGs published with the site for the logins in SNAPSHOT_USERS. */
  snapshotIndex: () => href('cards/index.json'),
  snapshotSvg: (login: string, card: string, theme: Theme = 'auto') =>
    href(`cards/${login.toLowerCase()}/${card}${theme === 'auto' ? '' : `-${theme}`}.svg`),
};

/** Absolute URL for copy-paste snippets, against wherever the site is being served from. */
export const absolute = (path: string) => new URL(path, typeof location === 'undefined' ? 'https://example.com' : location.origin).href;
