# Agentic ArchDraw — workflow contract

Status: Phase 0 decisions, 2026-10-02.

This document fixes the first-release identity, persistence, mutation, evidence, and screen behavior contracts. It does not add product behavior by itself.

## Harness target

OpenCode is the first adapter target because this repository already contains a project-local MCP configuration for ArchDraw. The current `opencode.json` uses the legacy `mcp.<name>` shape. Current OpenCode v2 documentation uses `mcp.servers.<name>`. The installer must recognize the supported format and merge only ArchDraw-owned entries without replacing user settings.

OpenCode's official documentation describes local MCP servers started over stdio, project-level configuration, and project `AGENTS.md` instructions. These mechanisms support a local MCP process plus explicit project instructions, but they do not guarantee that every task invokes ArchDraw automatically. Setup must show a fallback instruction and any required harness restart. Sources: [OpenCode MCP servers](https://opencode.ai/docs/mcp-servers/), [OpenCode v2 MCP servers](https://opencode.ai/v2/docs/mcp-servers), [OpenCode rules](https://opencode.ai/docs/rules/).

The supported version range and package-install command remain release checks. The package currently declares `@hiabhee/archdraw-mcp-server@1.0.2`; this repository configuration is evidence of an existing integration, not proof that a clean external install succeeds.

## Identity and storage

| Entity | Contract |
|---|---|
| Project | Opaque server-generated ID, owner account, optional repository association, entitlement, and connection status. Project ID is never an authorization credential. |
| Repository association | Normalized remote URL is a display/matching hint only. It grants no access. Repositories without a remote can bind manually. A fork requires an explicit choice to connect to an existing project or create a new one. |
| Worktree | Opaque ID for one connected checkout/worktree, plus observed branch/ref and base commit. Persist the binding locally so a harness restart resumes the same worktree. Branch name and commit are metadata, not credentials. |
| Branch isolation | Each worktree context has its own architecture revision stream. A feature branch cannot mutate the default branch map. Reconciliation into the default context is an explicit operation after inspecting the implementation. |
| Authority | The authenticated hosted project API and its durable store are authoritative. Local files may contain the project/worktree binding, a bounded read cache, and recoverable pending operations; they are not a second master copy. |
| Credentials | Short-lived pairing flow produces a revocable project-scoped credential. Store it outside tracked files in the platform credential store. Never place it in URLs, tool output, or repository instructions. |

### Pairing implementation status

The browser flow lives at `/connect-agent`. `POST /api/agentic/pairing` creates a ten-minute request and returns a user code plus a client token to the process that initiated it. The token is inactive until an authenticated owner approves a project and workspace in the browser. The first authenticated poll activates that same token as a 90-day project-scoped credential; the API stores only its SHA-256 hash. Polling the completed request is safe to retry and never returns the token again.

The agent credential can read its bound project and workspace through the project GET routes. Project owners can inspect credential metadata and revoke a credential through the credentials routes or the browser page. The MCP package does not yet start pairing, keep the token in an OS credential store, write a local project/worktree binding, or resume after restart; AG-011 remains incomplete. The approval screen supports project creation without a Git remote.

### Architecture and evidence

- Components and relationships have stable opaque IDs. IDs are not derived from labels; a rename preserves identity and references.
- Architecture semantics are stored separately from React Flow positions, view preferences, and human annotations.
- Evidence records a repository-relative path, optional symbol and line range, observed commit or content hash, and origin (`code`, `documentation`, or `inference`). Line ranges are hints. A changed file/hash marks evidence stale until rechecked.
- Missing or stale evidence does not imply that a component or relationship was deleted. Deletion requires an explicit semantic operation.
- A view references component IDs and stores focus, filters, layout, and annotations. Views do not fork the underlying architecture.
- A proposal stores its base revision and proposed operations. Its lifecycle is `draft → accepted/rejected`; accepted work remains proposed until code is inspected and the architecture is reconciled. `implemented` requires a recorded verification result; it is never inferred from acceptance.
- Verification records the checks actually performed and their result. User-supplied evidence is not a passing test result.

### Mutation and conflict behavior

Every mutation includes project ID, worktree ID, expected architecture revision, idempotency key, actor, and semantic operations. The server validates the complete operation set before writing it atomically.

- A matching expected revision applies one new immutable revision.
- A repeated idempotency key returns the original result and does not apply the operation twice.
- A stale expected revision returns a conflict with current revision and affected IDs. It does not partially apply or silently merge.
- A branch/worktree mismatch is a separate conflict from a stale document revision.
- Restoring history creates a new revision; it does not erase later history.
- Project reads and writes require authenticated ownership checks on the server. Public sharing remains a separate explicit action.

### Privacy boundary

The local MCP process performs no model inference. The coding harness uses its existing model configuration. ArchDraw receives selected architecture metadata and repository references needed for an operation; it does not automatically upload source trees, secrets, or raw prompts. Rendering uses the deterministic Mermaid-to-Dagre pipeline. New project tools must not call the paid generation endpoint.

The current legacy rendering path still sends Mermaid content to the configured ArchDraw API. Do not describe that path as fully local or offline; show the remote-processing disclosure when that path is used.

## Primary screens and recovery states

| Screen | Main content | Required state and next action |
|---|---|---|
| Setup | Harness detected, account pairing, project selection, repository hint, connected worktree | Cancelled pairing offers retry. No Git remote offers manual binding. Existing binding to another project asks the developer to choose before switching. Setup ends with a visible fallback invocation and restart guidance. |
| Current architecture | Project overview, architecture status, branch/worktree, last synced revision, changed evidence | First map shows `initial mapping`; empty repositories offer an explicit retry. `stale` identifies affected paths and asks the developer to inspect them. `disconnected` offers reconnect. |
| Focused explanation | Focused component/flow, breadcrumbs, evidence and freshness inspector, related decisions | Missing evidence is labeled uncertain. A stale line reference points to its file and asks for a fresh inspection. Returning to overview preserves the current canvas viewport. |
| Proposal review | Base revision, add/change/remove diff, evidence, decision and lifecycle | Accept/reject is recorded with actor/time. Acceptance does not change current architecture. A stale base revision requires refresh/rebase before a decision can be applied. |
| Reconnect/conflict recovery | Local and server revisions, pending operation summary, affected IDs | The developer can retry an idempotent operation, discard it, export it, or open a focused conflict view. Newer server state is never overwritten automatically. |

Visible synchronization states are `initial mapping`, `ready`, `updating`, `stale`, `pending`, `disconnected`, `conflict`, and `failed`. Each state names the last known revision when available and gives one concrete recovery action. Color is paired with text or a pattern.

## Phase 0 baseline notes

Measured statically from `mcp-server/src/index.ts` on 2026-10-02 by evaluating the literal `TOOLS` array with the installed TypeScript parser:

| Measure | Current baseline |
|---|---:|
| Registered legacy tools | 12 |
| Top-level tool description text | 8,050 characters / 8,088 UTF-8 bytes |
| Serialized tool definitions (descriptions + input schemas) | 17,863 characters / 17,903 UTF-8 bytes |
| MCP package version in `mcp-server/package.json` | 1.0.2 |
| Existing repo setup | `opencode.json` launches `npx -y @hiabhee/archdraw-mcp-server` with `API_BASE_URL` set |

These byte/character values are exact for the source literal but are not token counts. No reference tokenizer is installed in this workspace, so a tokenizer name/version and token count remain to be captured. Current full-state response sizes and canonical layout outputs also remain unmeasured; capture them from the three checked-in fixtures before setting comparative targets. Do not present estimates as measured token counts.

Current setup steps inferred from the checked-in OpenCode config are: use Node.js 18+, add a local stdio MCP entry that launches the package, set the ArchDraw API base URL, start/restart OpenCode, and invoke an ArchDraw tool. Fresh-repository installation, pairing, and reconnect behavior have not yet been validated.
