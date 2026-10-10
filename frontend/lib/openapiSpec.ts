import { SITE_URL, LAST_UPDATED } from '@/lib/discovery';

export const OPENAPI_SPEC = {
  openapi: '3.0.3',
  info: {
    title: 'ArchDraw API',
    version: `v8-${LAST_UPDATED}`,
    description:
      'Public REST API for ArchDraw — AI-assisted system architecture diagramming. Generate diagrams from prompts or GitHub repos, persist via diagram load/session, share, and export. For agent discovery also see /llms.txt, /llms-full.txt, /docs/sitemap.md.',
    contact: { url: 'https://github.com/hiabhee/ArchDraw', name: 'ArchDraw' },
    license: { name: 'See GitHub repository', url: 'https://github.com/hiabhee/ArchDraw' },
  },
  servers: [
    { url: SITE_URL, description: 'Production' },
    { url: 'http://localhost:3000', description: 'Local development' },
  ],
  tags: [
    { name: 'generation', description: 'AI diagram generation (prompt → graph)' },
    { name: 'repo', description: 'Repo → diagram (GitHub URL → graph)' },
    { name: 'diagram', description: 'Persistence / session / export / share' },
    { name: 'discovery', description: 'AI agent discovery files' },
    { name: 'user', description: 'User canvases, quota, tutorial progress' },
    { name: 'system', description: 'Health / metadata' },
  ],
  paths: {
    '/api/generate-diagram': {
      get: {
        tags: ['system'],
        summary: 'Health check — diagram generation API is running',
        responses: {
          '200': {
            description: 'OK',
            content: { 'application/json': { example: { status: 'ok', message: 'Diagram generation API is running' } } },
          },
        },
      },
      post: {
        tags: ['generation'],
        summary: 'Generate a diagram from a text prompt (non-streaming)',
        description:
          'Runs quota check, cache lookup (v8::prompt::model::L), then the 6-stage AI Mermaid pipeline (ConceptDetection → ArchitecturePlanning → LayoutOverride → MermaidMaterialize → Score → Validation). Returns React Flow nodes/edges + progress events.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['description'],
                properties: {
                  description: { type: 'string', description: 'Plain English system description or Mermaid snippet', example: 'Design a video streaming pipeline with S3, transcoder workers, CDN, and analytics' },
                  systemType: { type: 'string', description: 'Optional hint (e.g. streaming, ecommerce, realtime)', example: 'streaming' },
                  complexity: { type: 'string', enum: ['low', 'medium', 'high'] },
                  model: { type: 'string', description: 'Groq/OpenRouter model id — must be in lib/ai/models.ts MODELS', example: 'llama-3.3-70b-versatile' },
                  diagramSize: { type: 'string', enum: ['small', 'medium', 'large'] },
                  detailLevel: { type: 'integer', enum: [1, 2, 3], description: 'L1/L2/L3 — controls node count via budget' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Generated diagram',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/GenerationResult' },
                    progress: { type: 'array', items: { $ref: '#/components/schemas/GenerationProgress' } },
                    cached: { type: 'boolean' },
                    quotaRemaining: { type: 'integer' },
                  },
                },
              },
            },
          },
          '400': { description: 'Validation error' },
          '429': { description: 'Quota exceeded — 3/hr guest, 10/day authed', content: { 'application/json': { schema: { $ref: '#/components/schemas/QuotaError' } } } },
          '502': { description: 'Generation failed' },
        },
      },
    },
    '/api/generate-diagram/streaming': {
      post: {
        tags: ['generation'],
        summary: 'Generate a diagram with SSE streaming progress',
        description: 'Same pipeline as /api/generate-diagram but streams `text/event-stream` events: start → progress (phase/message/progress) → complete | error. Quota checked before streaming.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['description'],
                properties: {
                  description: { type: 'string' },
                  systemType: { type: 'string' },
                  complexity: { type: 'string', enum: ['low', 'medium', 'high'] },
                  model: { type: 'string' },
                  diagramSize: { type: 'string', enum: ['small', 'medium', 'large'] },
                  stream: { type: 'boolean', default: true },
                  existingContext: { type: 'object', description: 'Existing canvas nodes/edges for edit mode (always uses LLM, skips concept template)' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'SSE stream', content: { 'text/event-stream': { schema: { type: 'string' } } } },
          '429': { description: 'Quota exceeded' },
        },
      },
    },
    '/api/repo-diagram': {
      post: {
        tags: ['repo'],
        summary: 'Generate a diagram from a GitHub repo URL (SSE stream)',
        description:
          'Multi-stage pipeline v2: Ingestion (tarball) → Cache check → Analysis/Baseline → Classify → Extract → Relationships → Verify → DocsReview → Finalization → Cache write. Streams SSE: progress → result | error. Only charges quota if client stays connected.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['repoUrl'],
                properties: {
                  repoUrl: { type: 'string', format: 'uri', example: 'https://github.com/vercel/next.js' },
                  detailLevel: { type: 'integer', enum: [1, 2, 3], default: 2, description: '1=overview, 2=standard, 3=detailed' },
                  userGithubToken: { type: 'string', description: 'Optional PAT (ghp_/gho_/ghs_/ghu_/ghr_/github_pat_) to raise GitHub rate limit; validated and dropped if malformed' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'SSE stream with result payload', content: { 'text/event-stream': { schema: { type: 'string' } } } },
          '400': { description: 'Invalid GitHub URL or JSON' },
          '429': { description: 'Quota exceeded' },
        },
      },
      delete: {
        tags: ['repo'],
        summary: 'Clear repo diagram caches (admin only)',
        security: [{ adminPasscode: [] }],
        responses: { '200': { description: 'Caches cleared' }, '401': { description: 'Admin auth required' } },
      },
    },
    '/api/diagram/load': {
      post: {
        tags: ['diagram'],
        summary: 'Create a shared diagram session from nodes/edges or Mermaid (world-writable)',
        description:
          'Used by the MCP server `generate_diagram` tool (Mermaid-first). Accepts either React Flow nodes/edges or a mermaid string which is run through `runMermaidPipeline`. Creates a SharedCanvas record (7-day expiry) and returns sessionId. No auth required — sharing admin (PATCH/PUT/DELETE) is guarded.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  nodes: { type: 'array', items: { type: 'object' }, description: 'React Flow nodes' },
                  edges: { type: 'array', items: { type: 'object' }, description: 'React Flow edges' },
                  label: { type: 'string', description: 'Canvas name' },
                  mermaid: { type: 'string', description: 'Mermaid graph LR/TD with subgraphs — alternative to nodes/edges' },
                  accessType: { type: 'string', example: 'anyone' },
                  linkPermission: { type: 'string', enum: ['viewer', 'editor'], example: 'viewer' },
                  users: { type: 'array', items: { type: 'object' } },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Session created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    sessionId: { type: 'string', format: 'uuid' },
                    nodes: { type: 'array', items: { type: 'object' } },
                    edges: { type: 'array', items: { type: 'object' } },
                    warnings: { type: 'array', items: { type: 'string' } },
                  },
                },
              },
            },
          },
          '400': { description: 'Invalid body or Mermaid parse failure' },
        },
      },
      patch: { tags: ['diagram'], summary: 'Update sharing accessType/linkPermission (auth required)', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Updated' }, '401': { description: 'Auth required' } } },
      put: { tags: ['diagram'], summary: 'Add collaborator to shared session (auth required)', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Added' }, '401': { description: 'Auth required' } } },
      delete: { tags: ['diagram'], summary: 'Remove collaborator from shared session (auth required)', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Removed' }, '401': { description: 'Auth required' } } },
    },
    '/api/diagram/session/{sessionId}': {
      get: {
        tags: ['diagram'],
        summary: 'Load a shared diagram session by id',
        parameters: [{ name: 'sessionId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': {
            description: 'Session payload',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    nodes: { type: 'array', items: { type: 'object' } },
                    edges: { type: 'array', items: { type: 'object' } },
                    label: { type: 'string' },
                    createdAt: { type: 'string', format: 'date-time' },
                    source: { type: 'string', example: 'manual' },
                  },
                },
              },
            },
          },
          '404': { description: 'Session not found' },
          '410': { description: 'Session expired' },
        },
      },
    },
    '/api/share/{id}': {
      get: {
        tags: ['diagram'],
        summary: 'Get shared canvas payload (public if not expired, ~30 days)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Shared canvas' }, '404': { description: 'Not found' } },
      },
    },
    '/api/embed/{id}': {
      get: {
        tags: ['diagram'],
        summary: 'Get embed payload for iframe viewers',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Embed payload' }, '404': { description: 'Not found' } },
      },
    },
    '/api/user/canvases': {
      get: { tags: ['user'], summary: 'List canvases for authenticated user', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Canvases' }, '401': { description: 'Auth required' } } },
      put: { tags: ['user'], summary: 'Upsert a user canvas (debounced from diagramStore)', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Saved' } } },
    },
    '/api/user/canvases/{id}': {
      delete: { tags: ['user'], summary: 'Delete a user canvas', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Deleted' } } },
    },
    '/api/user/quota': {
      get: { tags: ['user'], summary: 'Get remaining AI generation quota for current tier', responses: { '200': { description: 'Quota info' } } },
    },
    '/api/tutorial-check': {
      post: { tags: ['generation'], summary: 'Validate a tutorial canvas topology (adjacency-list check)', responses: { '200': { description: 'Check result' } } },
    },
    '/api/components/templates': {
      get: { tags: ['system'], summary: 'Fetch component templates by ids', parameters: [{ name: 'ids', in: 'query', schema: { type: 'string' } }], responses: { '200': { description: 'Templates' } } },
    },
    '/llms.txt': {
      get: { tags: ['discovery'], summary: 'Compact index for AI agents (llmstxt.org)', responses: { '200': { description: 'Markdown index', content: { 'text/plain': { schema: { type: 'string' } } } } } },
    },
    '/llms-full.txt': {
      get: { tags: ['discovery'], summary: 'Full corpus — all docs concatenated', responses: { '200': { description: 'Full markdown corpus' } } },
    },
    '/docs/sitemap.md': {
      get: { tags: ['discovery'], summary: 'Semantic index with summaries/prerequisites', responses: { '200': { description: 'Markdown sitemap' } } },
    },
    '/docs/taxonomy.json': {
      get: { tags: ['discovery'], summary: 'Canonical naming (taxonomy)', responses: { '200': { description: 'Taxonomy JSON' } } },
    },
    '/docs/graph.json': {
      get: { tags: ['discovery'], summary: 'Relationship graph (nodes/edges)', responses: { '200': { description: 'Graph JSON' } } },
    },
    '/robots.txt': {
      get: { tags: ['discovery'], summary: 'Crawler allowlist', responses: { '200': { description: 'robots.txt' } } },
    },
  },
  components: {
    schemas: {
      RfNode: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { type: 'string', enum: ['systemNode', 'shapeNode', 'groupNode', 'annotation', 'textLabel'], example: 'systemNode' },
          position: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } } },
          data: { type: 'object', properties: { label: { type: 'string' }, subtitle: { type: 'string' }, shape: { type: 'string' }, category: { type: 'string' }, color: { type: 'string' } } },
          parentNode: { type: 'string', nullable: true, description: 'Group id if nested' },
        },
      },
      RfEdge: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          source: { type: 'string' },
          target: { type: 'string' },
          label: { type: 'string', description: 'Protocol/label e.g. gRPC, WebSocket' },
          sourceHandle: { type: 'string', example: 'source-right' },
          targetHandle: { type: 'string', example: 'target-left' },
          type: { type: 'string', example: 'simpleFloating' },
        },
      },
      GenerationResult: {
        type: 'object',
        properties: {
          nodes: { type: 'array', items: { $ref: '#/components/schemas/RfNode' } },
          edges: { type: 'array', items: { $ref: '#/components/schemas/RfEdge' } },
          mermaid: { type: 'string', description: 'Canonical Mermaid produced by planner/validation' },
          warnings: { type: 'array', items: { type: 'string' } },
        },
      },
      GenerationProgress: {
        type: 'object',
        properties: {
          phase: { type: 'string', enum: ['planning', 'layout', 'validation', 'scoring'] },
          message: { type: 'string' },
          progress: { type: 'number', minimum: 0, maximum: 100 },
        },
      },
      QuotaError: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Quota exceeded' },
          code: { type: 'string', example: 'QUOTA_EXCEEDED' },
          status: { type: 'integer', example: 429 },
          remaining: { type: 'integer' },
          upgradePrompt: { type: 'string' },
        },
      },
      RepoResultPayload: {
        type: 'object',
        properties: {
          ndjson: { type: 'string', description: 'React Flow graph serialized as newline-delimited JSON (importable via importRepoDiagram)' },
          nodeCount: { type: 'integer' },
          edgeCount: { type: 'integer' },
          workflowCount: { type: 'integer' },
          workflows: { type: 'array', items: { type: 'object' } },
          repoMeta: { type: 'object' },
          repoProfile: { type: 'object' },
          dependencyMap: { type: 'object' },
          reviewNotes: { type: 'array', items: { type: 'string' } },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
    },
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'better-auth session cookie (not header Bearer in practice — sent via cookie)' },
      adminPasscode: { type: 'apiKey', in: 'header', name: 'x-admin-passcode', description: 'ADMIN_PASSCODE + ADMIN_SESSION_SECRET rate-limited guard' },
    },
  },
};
