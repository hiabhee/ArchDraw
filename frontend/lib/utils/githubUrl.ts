/**
 * Shared GitHub URL validation and normalization.
 * Keeps frontend and backend validation consistent.
 */

const GITHUB_URL_PATTERN = /^https?:\/\/(?:www\.)?github\.com\/([a-zA-Z0-9-._]+)\/([a-zA-Z0-9-._]+?)(?:\.git)?(?:\/)?$/;

export interface ParsedGitHubUrl {
  owner: string;
  repo: string;
  canonical: string;
}

export function parseGitHubUrl(url: string): ParsedGitHubUrl | null {
  const cleaned = url.trim().replace(/\/+$/, '');
  const match = cleaned.match(GITHUB_URL_PATTERN);
  if (!match) return null;
  const owner = match[1];
  const repo = match[2].replace(/\.git$/, '');
  return {
    owner,
    repo,
    canonical: `https://github.com/${owner}/${repo}`,
  };
}

export function isGitHubRepoUrl(value: string): boolean {
  return parseGitHubUrl(value) !== null;
}
