import { randomUUID } from 'node:crypto';
import prisma from '@/lib/server/prisma';

export interface CreateAgenticProjectInput {
  name: string;
  repositoryRemote?: string | null;
  defaultBranch?: string | null;
  branchName?: string | null;
  baseCommitSha?: string | null;
}

/**
 * Normalize a git remote for display/matching (never authorization). Returns
 * null for empty input and undefined for an unparseable remote.
 */
export function normalizeRepositoryRemote(value?: string | null) {
  if (!value) return null;
  const remote = value.trim();
  if (!remote) return null;

  try {
    const url = new URL(remote);
    if (!['http:', 'https:', 'ssh:', 'git:'].includes(url.protocol)) return undefined;
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    const scpRemote = remote.match(/^(?:[^@\s]+@)?([^:/\s]+):([^?#\s]+)$/);
    if (scpRemote) return `ssh://${scpRemote[1].toLowerCase()}/${scpRemote[2].replace(/^\/+/, '')}`;

    // Forms people type by hand: `github.com/owner/repo` or just `owner/repo` (GitHub).
    const hostPath = remote.match(/^([a-z0-9-]+(?:\.[a-z0-9-]+)+)\/([\w.-]+\/[\w.-]+(?:\/[\w.-]+)*)\/?$/i);
    if (hostPath) return `https://${hostPath[1].toLowerCase()}/${hostPath[2]}`;
    const ownerRepo = remote.match(/^([\w.-]+)\/([\w.-]+)$/);
    if (ownerRepo) return `https://github.com/${ownerRepo[1]}/${ownerRepo[2]}`;
    return undefined;
  }
}

/** Create a project with its default workspace, revision 0 and overview view. */
export async function createAgenticProject(
  ownerId: string,
  input: CreateAgenticProjectInput,
) {
  const branchName = input.branchName || input.defaultBranch || null;
  return prisma.agenticProject.create({
    data: {
      ownerId,
      name: input.name,
      repositoryRemote: input.repositoryRemote ?? null,
      defaultBranch: input.defaultBranch || null,
      workspaces: {
        create: {
          bindingKey: randomUUID(),
          branchName,
          baseCommitSha: input.baseCommitSha || null,
          revisions: {
            create: {
              revision: 0,
              baseCommitSha: input.baseCommitSha || null,
              snapshot: { components: [], relationships: [] },
              summary: 'Project created',
              actorType: 'user',
              actorId: ownerId,
            },
          },
          views: {
            create: {
              name: 'Architecture overview',
              viewType: 'overview',
              state: { focusNodeIds: [], direction: 'LR', annotations: [] },
            },
          },
        },
      },
    },
    select: {
      id: true,
      name: true,
      repositoryRemote: true,
      defaultBranch: true,
      createdAt: true,
      workspaces: {
        select: {
          id: true,
          branchName: true,
          baseCommitSha: true,
          currentRevision: true,
          revisions: { select: { revision: true } },
          views: { select: { id: true, name: true, viewType: true } },
        },
      },
    },
  });
}
