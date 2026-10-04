// Counts the public repos whose workflows use the git-card Action. README cards are images behind GitHub's
// proxy, so analytics never sees them, and this is the closest thing to a usage number.
//
//   tsx scripts/adoption.ts
//
// Needs GITHUB_TOKEN, since code search requires auth. In Actions it also writes a table to the job summary.

import { appendFileSync } from 'node:fs';
import { SITE } from '../src/site';

const token = process.env.GITHUB_TOKEN;
if (!token) throw new Error('GITHUB_TOKEN is required, since code search needs auth.');

const action = SITE.action.split('@')[0];
const self = new URL(SITE.repo).pathname.slice(1).toLowerCase();
const q = `"${action}" path:.github/workflows`;

interface Page {
  total_count: number;
  incomplete_results: boolean;
  items: { repository: { full_name: string; html_url: string; stargazers_count?: number } }[];
}

const repos = new Map<string, string>();
let incomplete = false;
// Code search returns at most 1000 results, 100 a page.
for (let page = 1; page <= 10; page++) {
  const params = new URLSearchParams({ q, per_page: '100', page: String(page) });
  const res = await fetch(`https://api.github.com/search/code?${params}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw new Error(`Code search failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as Page;
  incomplete ||= data.incomplete_results;
  for (const { repository } of data.items) {
    if (repository.full_name.toLowerCase() !== self) repos.set(repository.full_name, repository.html_url);
  }
  if (page * 100 >= data.total_count) break;
}

const sorted = [...repos].sort(([a], [b]) => a.localeCompare(b));
console.log(`${sorted.length} repos use ${action}${incomplete ? ' (search was incomplete, so this may be low)' : ''}`);
for (const [name] of sorted) console.log(`  ${name}`);

const summary = process.env.GITHUB_STEP_SUMMARY;
if (summary) {
  const rows = sorted.map(([name, url]) => `| [${name}](${url}) |`);
  appendFileSync(
    summary,
    [
      `### ${sorted.length} repos use \`${action}\``,
      incomplete ? '\nGitHub marked the search incomplete, so the real number may be higher.\n' : '',
      ...(rows.length ? ['| Repo |', '| --- |', ...rows] : []),
      '',
    ].join('\n'),
  );
}
