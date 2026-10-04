import { useEffect, useMemo, useState } from 'react';
import { fmt, shortDate } from '../lib/format';
import { latest, recentSeries, STAT_METRICS, type Count, type StatsHistory } from '../lib/stats';
import { urls } from '../lib/urls';
import { SITE } from '../site';
import { Stats3D } from './Stats3D';

/** How many days the 3D city shows (fewer on a phone, where 90 towers per lane would be slivers), and the table lists. */
const cityDays = () => (matchMedia('(max-width: 760px)').matches ? 30 : 90);
const TABLE_DAYS = 30;

type State = { status: 'loading' } | { status: 'empty' } | { status: 'error' } | { status: 'ready'; history: StatsHistory };

function useHistory(): State {
  const [state, setState] = useState<State>({ status: 'loading' });
  useEffect(() => {
    let live = true;
    fetch(urls.statsHistory(), { cache: 'no-cache' })
      .then(async (res) => {
        if (res.status === 404) return { status: 'empty' } as const;
        if (!res.ok) throw new Error(String(res.status));
        return { status: 'ready', history: (await res.json()) as StatsHistory } as const;
      })
      .catch(() => ({ status: 'error' }) as const)
      .then((next) => live && setState(next));
    return () => {
      live = false;
    };
  }, []);
  return state;
}

function Tile({ label, value, note }: { label: string; value: number | null; note: string }) {
  return (
    <li className="stat-tile hud">
      <span className="stat-label">{label}</span>
      <span className="stat-value tabular">{value === null ? '?' : fmt(value)}</span>
      <span className="caption">{note}</span>
    </li>
  );
}

function CountTable({ title, rows, link }: { title: string; rows: Count[]; link?: (name: string) => string }) {
  return (
    <div className="table-wrap">
      <table className="metric-table tabular">
        <caption className="eyebrow">{title}</caption>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Views</th>
            <th scope="col">Visitors</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <th scope="row">{link ? <a href={link(r.name)}>{r.name === '/' ? 'Repo home' : r.name}</a> : r.name}</th>
              <td>{r.views.toLocaleString()}</td>
              <td>{r.visitors.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function StatsApp() {
  const state = useHistory();
  const series = useMemo(() => (state.status === 'ready' ? recentSeries(state.history, cityDays()) : null), [state]);

  if (state.status === 'loading') return <p className="caption stats-status">Loading stats</p>;
  if (state.status === 'error') return <p className="caption stats-status">The stats file could not be loaded. Try again in a minute.</p>;
  if (state.status === 'empty' || !series?.dates.length) {
    return <p className="caption stats-status">No stats yet. The Stats workflow records the first day on its next run.</p>;
  }

  const { history } = state;
  const { dates, rows } = series;
  const recent = history.recent;
  const tableDates = Object.keys(history.days).slice(-TABLE_DAYS).reverse();

  return (
    <>
      <ul className="stat-tiles">
        <Tile label="Adopters" value={latest(history, 'adopters')} note="Repos running the Action" />
        <Tile label="Stars" value={latest(history, 'stars')} note="On GitHub" />
        <Tile label="Forks" value={latest(history, 'forks')} note="On GitHub" />
        <Tile label="Views" value={recent?.views ?? null} note={recent ? 'Repo pages, last 14 days' : 'Not collected yet'} />
        <Tile label="Visitors" value={recent?.visitors ?? null} note={recent ? 'Unique, last 14 days' : 'Not collected yet'} />
        <Tile label="Clones" value={recent?.clones ?? null} note={recent ? 'Last 14 days' : 'Not collected yet'} />
      </ul>

      <Stats3D lanes={rows} dates={dates} />
      <p className="caption">
        One lane per metric and one tower per day. Each lane is scaled to its own peak, the tallest day in green. Hover a tower for its
        number.
      </p>

      <section className="stats-section">
        <p className="eyebrow">Adopters</p>
        <h2 className="title rgb">Running the Action.</h2>
        {history.adopters.length ? (
          <ul className="adopters">
            {history.adopters.map((a) => (
              <li key={a.repo}>
                <a href={`https://github.com/${a.repo}`} rel="noopener">
                  {a.repo}
                </a>
                <span className="caption tabular">since {shortDate(a.since)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="caption">
            No public repos yet. Be the first from the <a href={SITE.marketplace}>Marketplace listing</a>.
          </p>
        )}
      </section>

      {history.traffic && (history.referrers.length > 0 || history.paths.length > 0) && (
        <section className="stats-section">
          <p className="eyebrow">Last 14 days</p>
          <h2 className="title rgb">Where visitors came from.</h2>
          <div className="stats-pair">
            <CountTable title="Referrers" rows={history.referrers} />
            <CountTable title="Repo pages" rows={history.paths} link={(path) => `${SITE.repo}${path === '/' ? '' : path}`} />
          </div>
        </section>
      )}

      <section className="stats-section">
        <p className="eyebrow">Daily numbers</p>
        <h2 className="title rgb">The last {tableDates.length} days.</h2>
        <div className="table-wrap">
          <table className="metric-table tabular">
            <thead>
              <tr>
                <th scope="col">Day</th>
                {STAT_METRICS.map((m) => (
                  <th key={m.key} scope="col">
                    {m.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableDates.map((date) => (
                <tr key={date}>
                  <th scope="row">{shortDate(date)}</th>
                  {STAT_METRICS.map((m) => {
                    const v = history.days[date][m.key];
                    return <td key={m.key}>{v === undefined ? <span aria-label="no data">·</span> : v.toLocaleString()}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="caption">
          Views, visitors and clones are daily. Stars, forks and adopters are totals at the end of each day. A dot means nothing was
          recorded.
        </p>
      </section>

      <ul className="fine-print">
        <li>
          Updated {new Date(history.updatedAt).toLocaleString()} by the daily Stats workflow, from the GitHub API. The raw file is{' '}
          <a href={urls.statsHistory()}>history.json</a>.
        </li>
        <li>GitHub only keeps 14 days of repo traffic, so older days come from earlier runs.</li>
        <li>Adopters come from GitHub code search, which skips some repos. Treat the count as a floor.</li>
        <li>Profile and card views on this site are not here. They are in Google Analytics.</li>
      </ul>
    </>
  );
}
