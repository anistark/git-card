import { describe, expect, it } from 'vitest';
import { urls } from './urls';

describe('urls.profile', () => {
  it('links to the query-string profile page', () => {
    expect(urls.profile('octocat')).toBe('/u/?user=octocat');
  });

  it('appends UTM tags for snippets', () => {
    expect(urls.profile('octocat', { source: 'readme', medium: 'card', campaign: 'skyline' })).toBe(
      '/u/?user=octocat&utm_source=readme&utm_medium=card&utm_campaign=skyline',
    );
  });
});
