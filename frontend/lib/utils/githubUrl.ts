/**
 * Shared GitHub URL validation and normalization.
 * Keeps frontend and backend validation consistent.
 */

export interface ParsedGitHubUrl {
  owner: string;
  repo: string;
  canonical: string;
}

export function parseGitHubUrl(url: string): ParsedGitHubUrl | null {
  let cleaned = url.trim().replace(/\/+$/, '');
  cleaned = cleaned.replace(
    /^(https?:\/\/(?:www\.)?github\.com\/[a-zA-Z0-9-._]+\/[a-zA-Z0-9-._]+?)(?:\.git)?(\/.*)?$/,
    '$1',
  );
  const match = cleaned.match(
    /^https?:\/\/(?:www\.)?github\.com\/([a-zA-Z0-9-._]+)\/([a-zA-Z0-9-._]+?)(?:\.git)?$/,
  );
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
