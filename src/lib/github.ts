// GraphQL data source for the README card generator (scripts/generate.tsx).
import { normalize, type Profile, type RawUser } from './profile';

const QUERY = /* GraphQL */ `
  query ($login: String!) {
    user(login: $login) {
      login
      name
      avatarUrl(size: 256)
      bio
      location
      company
      websiteUrl
      createdAt
      followers {
        totalCount
      }
      following {
        totalCount
      }
      pullRequests {
        totalCount
      }
      issues {
        totalCount
      }
      repositories(first: 100, ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC, orderBy: { field: STARGAZERS, direction: DESC }) {
        totalCount
        nodes {
          name
          description
          url
          stargazerCount
          forkCount
          pushedAt
          primaryLanguage {
            name
          }
          languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
            edges {
              size
              node {
                name
              }
            }
          }
        }
      }
      organizations(first: 30) {
        nodes {
          login
          name
          avatarUrl(size: 96)
        }
      }
      contributionsCollection {
        totalCommitContributions
        totalPullRequestContributions
        totalPullRequestReviewContributions
        totalIssueContributions
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              contributionCount
              weekday
            }
          }
        }
        # For commits, totalCount is the number of commits. For the others it is the number of PRs, reviews or issues.
        commitContributionsByRepository(maxRepositories: 100) {
          repository {
            ...Repo
          }
          contributions {
            totalCount
          }
        }
        pullRequestContributionsByRepository(maxRepositories: 100) {
          repository {
            ...Repo
          }
          contributions {
            totalCount
          }
        }
        pullRequestReviewContributionsByRepository(maxRepositories: 100) {
          repository {
            ...Repo
          }
          contributions {
            totalCount
          }
        }
        issueContributionsByRepository(maxRepositories: 100) {
          repository {
            ...Repo
          }
          contributions {
            totalCount
          }
        }
      }
    }
  }

  fragment Repo on Repository {
    name
    isPrivate
    owner {
      __typename
      login
      avatarUrl(size: 96)
      ... on Organization {
        name
      }
    }
  }
`;

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 404 | 429 | 503,
  ) {
    super(message);
  }
}

/**
 * Full-fidelity profile via GraphQL. Needs a token, so it only runs where one is available for free:
 * the README card generator inside GitHub Actions. The website itself uses public-api.ts.
 */
export async function fetchProfileGraphQL(login: string, token: string, attempts = 3): Promise<Profile> {
  let res: Response | undefined;
  // This query is heavy, and GitHub sometimes times out on big accounts. Those 50x answers are worth a retry.
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 2000 * 2 ** (i - 1)));
    res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: { authorization: `bearer ${token}`, 'content-type': 'application/json', 'user-agent': 'git-card' },
      body: JSON.stringify({ query: QUERY, variables: { login } }),
    });
    if (![502, 503, 504].includes(res.status)) break;
  }
  res = res!;

  if (res.status === 401) throw new GitHubError('GitHub token was rejected.', 401);
  if (res.status === 403 || res.status === 429) throw new GitHubError('GitHub rate limit reached. Try again soon.', 429);
  if (!res.ok) throw new GitHubError(`GitHub responded with ${res.status}.`, 503);

  const body = (await res.json()) as {
    data?: { user: RawUser | null };
    errors?: Array<{ type?: string; message: string }>;
  };

  if (body.errors?.some((e) => e.type === 'NOT_FOUND') || body.data?.user === null) {
    throw new GitHubError(`No GitHub user called ${login}.`, 404);
  }
  if (body.errors?.some((e) => e.type === 'RATE_LIMITED')) throw new GitHubError('GitHub rate limit reached. Try again soon.', 429);
  if (!body.data?.user) throw new GitHubError(body.errors?.[0]?.message ?? 'Unexpected response from GitHub.', 503);
  return normalize(body.data.user);
}
