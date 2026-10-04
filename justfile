# git-card tasks. Run `just` to list them.

# List recipes
default:
    @just --list --unsorted

# Install dependencies
install:
    pnpm install

# Start the dev server at http://localhost:4321/git-card/
dev:
    pnpm astro dev

# Static build into dist/, ready for GitHub Pages
build:
    pnpm build

# Build, then serve dist/ locally
preview: build
    pnpm astro preview

# Format everything with Prettier
format:
    pnpm prettier --write .

# Lint with ESLint
lint:
    pnpm eslint .

# Lint and apply safe fixes
lint-fix:
    pnpm eslint . --fix

# Run the tests
test:
    pnpm vitest run

# Run the tests in watch mode
test-watch:
    pnpm vitest

# Type check .astro and .ts files
check:
    pnpm astro check

# Render README cards for users into a folder (uses $GITHUB_TOKEN, or your gh login)
cards users out="og-out/cards":
    GITHUB_TOKEN="${GITHUB_TOKEN:-$(gh auth token)}" pnpm exec tsx scripts/generate.tsx --users {{ quote(users) }} --out {{ quote(out) }}

# Count public repos whose workflows use the git-card Action (uses $GITHUB_TOKEN, or your gh login)
adoption:
    GITHUB_TOKEN="${GITHUB_TOKEN:-$(gh auth token)}" pnpm exec tsx scripts/adoption.ts

# Rebuild every logo asset (site, favicons, embedded card logo) from assets/brand/git-card-logo.png
brand:
    node scripts/brand.mjs
    pnpm exec tsx scripts/generate.tsx --site-og public/og.png

# Regenerate the site's own link preview image, public/og.png
og-site:
    pnpm exec tsx scripts/generate.tsx --site-og public/og.png

# Render every OG preview image to a folder to look at
og dir="og-out":
    OG_OUT={{ quote(dir) }} pnpm vitest run src/og

# Everything CI runs: formatting, lint, types, tests, build
ci:
    pnpm prettier --check .
    pnpm eslint .
    pnpm astro check
    pnpm vitest run
    pnpm build

# Remove build output and caches
clean:
    rm -rf dist .astro node_modules/.vite og-out
