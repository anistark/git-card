import { useEffect, useId, useState } from 'react';
import { getCard, type CardId } from '../cards/registry';
import { SIZES } from '../cards/shell';
import { LIGHT_THEME, standaloneCss, THEME_CHOICES, type Theme } from '../cards/style';
import { SITE } from '../site';
import { absolute, urls } from '../lib/urls';

// ---- Hosted snapshots ------------------------------------------------------------------------
// The Pages workflow pre-renders cards for the logins in SNAPSHOT_USERS and publishes an index.

interface Manifest {
  generatedAt: string;
  users: Record<string, { cards: string[] }>;
}

let manifest: Promise<Manifest | null> | null = null;
const loadManifest = () =>
  (manifest ??= fetch(urls.snapshotIndex())
    .then((r) => (r.ok ? (r.json() as Promise<Manifest>) : null))
    .catch(() => null));

function useHosted(login: string, card: CardId): boolean {
  const [hosted, setHosted] = useState(false);
  useEffect(() => {
    let live = true;
    loadManifest().then((m) => live && setHosted(!!m?.users[login.toLowerCase()]?.cards.includes(card)));
    return () => {
      live = false;
    };
  }, [login, card]);
  return hosted;
}

// ---- Standalone SVG from the card already on the page ----------------------------------------------

/** The inline card inherits page styles. A file needs its own tokens, size and namespace. */
export function standaloneSvg(svg: SVGSVGElement, theme: Theme): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const { width, height } = svg.viewBox.baseVal;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = standaloneCss(theme);
  clone.insertBefore(style, clone.querySelector('title')?.nextSibling ?? clone.firstChild);
  return new XMLSerializer().serializeToString(clone);
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---- UI ----------------------------------------------------------------------------------------

function CopyField({ id, label, value, hint }: { id: string; label: string; value: string; hint: string }) {
  const [copied, setCopied] = useState<'idle' | 'copied' | 'manual'>('idle');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied('copied');
    } catch {
      (document.getElementById(id) as HTMLInputElement | null)?.select();
      setCopied('manual');
    }
    setTimeout(() => setCopied('idle'), 1600);
  };
  const multiline = value.includes('\n');
  return (
    <div className="embed-field">
      <label htmlFor={id} className="eyebrow">
        {label}
      </label>
      <div className="embed-row">
        {multiline ? (
          <textarea id={id} value={value} readOnly spellCheck={false} rows={value.split('\n').length} />
        ) : (
          <input id={id} value={value} readOnly spellCheck={false} />
        )}
        <button type="button" onClick={copy}>
          {copied === 'copied' ? 'Copied' : copied === 'manual' ? 'Press Cmd+C' : 'Copy'}
        </button>
      </div>
      <p className="caption">{hint}</p>
    </div>
  );
}

export function EmbedPanel({
  login,
  card,
  getSvg,
  open = false,
}: {
  login: string;
  card: CardId;
  getSvg: () => SVGSVGElement | null;
  open?: boolean;
}) {
  const uid = useId();
  const [theme, setTheme] = useState<Theme>('auto');
  const hosted = useHosted(login, card);
  const def = getCard(card)!;
  const { width, height } = SIZES[def.size];
  const suffix = theme === 'auto' ? '' : `-${theme}`;
  const file = `${card}${suffix}.svg`;
  const alt = `${def.title} for @${login}`;
  const profileUrl = absolute(urls.profile(login));

  const action = `# .github/workflows/git-card.yml in your profile repo
name: git-card
on:
  schedule: [{ cron: '17 3 * * *' }]
  workflow_dispatch:
permissions:
  contents: write
jobs:
  cards:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: ${SITE.action}
        with:
          username: ${login}
          cards: ${card}${LIGHT_THEME ? `\n          theme: ${theme}` : ''}
      - run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add git-card
          git diff --staged --quiet || git commit -m "Update git-card"
          git push`;

  return (
    <details className="embed" open={open}>
      <summary className="eyebrow">Embed</summary>
      <div className="embed-body hud">
        {LIGHT_THEME && (
          <fieldset className="embed-theme">
            <legend className="eyebrow">Theme</legend>
            {THEME_CHOICES.map((t) => (
              <label key={t}>
                <input type="radio" name={`${uid}-theme`} value={t} checked={theme === t} onChange={() => setTheme(t)} />
                {t === 'auto' ? 'Follow viewer' : t}
              </label>
            ))}
          </fieldset>
        )}

        {hosted ? (
          <CopyField
            id={`${uid}-md`}
            label="README"
            value={`[![${alt}](${absolute(urls.snapshotSvg(login, card, theme))})](${profileUrl})`}
            hint="A hosted image, refreshed daily. Paste it into any README."
          />
        ) : (
          <>
            <CopyField
              id={`${uid}-md`}
              label="README"
              value={`[![${alt}](./git-card/${file})](${profileUrl})`}
              hint="READMEs need an image file. Download it into a git-card folder in your repo, or let the Action below keep it fresh."
            />
            <div className="embed-actions">
              <button
                type="button"
                onClick={() => {
                  const svg = getSvg();
                  if (svg) download(file, standaloneSvg(svg, theme));
                }}
              >
                Download {file}
              </button>
            </div>
            <CopyField
              id={`${uid}-action`}
              label="Auto-update with GitHub Actions"
              value={action}
              hint="Re-renders the card every day with fresh data and commits it to your repo."
            />
          </>
        )}

        <CopyField
          id={`${uid}-link`}
          label="Link"
          value={absolute(urls.card(login, card, { theme }))}
          hint="Share this card on its own page."
        />
        <CopyField
          id={`${uid}-iframe`}
          label="iframe"
          value={`<iframe src="${absolute(urls.card(login, card, { embed: true, theme }))}" width="${width}" height="${height}" style="border:0;max-width:100%;aspect-ratio:${width}/${height};height:auto" loading="lazy" title="${alt}"></iframe>`}
          hint={
            def.interactive
              ? 'Live and interactive, with the 3D view. For blogs and portfolios.'
              : 'Live and animated. For blogs and portfolios.'
          }
        />
      </div>
    </details>
  );
}
