# Contributing

Thanks for helping out. Issues and pull requests are both welcome.

## Setup

You need Node 22+, [pnpm](https://pnpm.io) and [just](https://github.com/casey/just). The site needs no token: profiles load in the browser from public APIs. Only `just cards`, which renders README images with GraphQL, needs one, and it uses `$GITHUB_TOKEN` or your `gh` login.

```sh
just install
just dev
```

## Before you open a PR

```sh
just format
just ci
```

`just ci` checks formatting, lints, type checks, runs the tests and builds. It is what CI runs.

## Adding a card

1. Write the component in `src/cards/`. It is a pure React component (no hooks) that returns an SVG built on `Shell`, because it also renders to a file in Node.
2. Add one entry to `src/cards/registry.ts`. The key becomes its public URL slug and file name, so pick it carefully.
3. Run `just og` and look at the rendered preview images in `og-out/`.

The card then gets its own page, iframe embed, download and Action output without any more work.

## House rules

- No em dashes or semicolons in user-facing copy.
- Colors come from the tokens in `src/cards/style.ts`. Do not hardcode new ones.
- Contributions to private repositories must never be shown.
