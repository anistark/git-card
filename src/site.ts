// Site-wide identity and links. Edit here, not in the components.

const repo = 'https://github.com/anistark/git-card';

export const SITE = {
  name: 'GIT CARD',
  tagline: 'Your GitHub, as a city.',
  repo,
  issues: `${repo}/issues`,
  license: { name: 'MIT', url: `${repo}/blob/main/LICENSE` },
  contributing: `${repo}/blob/main/CONTRIBUTING.md`,
  author: { name: 'Ani', url: 'https://github.com/anistark' },
  /** The GitHub Action people use to keep README cards fresh. `just release` moves the major tag. */
  action: 'anistark/git-card@v0',
  /** Google Analytics. The tag only runs on this host, so local builds and forks never report here. */
  analytics: { id: 'G-WTCT8ZW8H8', host: 'anistark.github.io' },
} as const;

export type IconName = 'x' | 'mastodon';

export const SOCIALS: { label: string; url: string; icon: IconName; rel?: string }[] = [
  { label: 'X', url: 'https://x.com/kranirudha', icon: 'x' },
  // rel="me" lets Mastodon verify the link back to this site.
  { label: 'Mastodon', url: 'https://fosstodon.org/@ani', icon: 'mastodon', rel: 'me' },
];

export const BUILT_WITH = [
  { label: 'Astro', url: 'https://astro.build' },
  { label: 'three.js', url: 'https://threejs.org' },
  { label: 'GitHub Pages', url: 'https://pages.github.com' },
  { label: 'resvg', url: 'https://github.com/linebender/resvg' },
];
