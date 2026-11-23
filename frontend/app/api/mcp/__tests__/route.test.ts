import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  rateLimit: vi.fn(),
  create: vi.fn(),
  findUnique: vi.fn(),
  updateMany: vi.fn(),
}));
vi.mock('@/lib/server/redis', () => ({ checkRateLimitWithFallback: m.rateLimit, redis: {} }));
vi.mock('@/lib/server/env-validation', () => ({ validateRedisConfig: () => null }));
vi.mock('@/lib/server/prisma', () => ({
  default: { sharedCanvas: { create: m.create, findUnique: m.findUnique, updateMany: m.updateMany } },
}));
vi.mock('@/lib/server/quotaCheck', () => ({ getSessionFromRequest: async () => null, logUsage: vi.fn() }));
vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), log: vi.fn(), debug: vi.fn() } }));

import { POST, GET } from '../route';

const CLIENT_IP = '198.51.100.23';
let rpcId = 0;
function rpc(method: string, params: Record<string, unknown> = {}) {
  return new NextRequest('https://archdraw.test/api/mcp', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'x-vercel-forwarded-for': CLIENT_IP,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }),
  });
}
const now = () => Math.floor(Date.now() / 1000);

describe('POST /api/mcp (hosted MCP)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.rateLimit.mockResolvedValue({ allowed: true, remaining: 10, resetAt: now() + 60 });
    m.create.mockResolvedValue({ id: 'share-1' });
  });

  it('initializes and lists the ArchDraw tools', async () => {
    const init = await (await POST(rpc('initialize', {
      protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' },
    }))).json();
    expect(init.result.serverInfo.name).toBe('archdraw-mcp-server');

    const list = await (await POST(rpc('tools/list'))).json();
    const names = list.result.tools.map((t: { name: string }) => t.name);
    expect(names).toEqual(expect.arrayContaining(['generate_diagram', 'update_diagram', 'apply_template', 'show_diagram']));
  });

  it('generates in-process with a preview link, throttled by the real client IP, and keeps state across requests', async () => {
    const res = await POST(rpc('tools/call', {
      name: 'generate_diagram',
      arguments: { mermaid: 'graph LR\n  Web[Web App] --> API[API Server]\n  API --> DB[("Postgres")]' },
    }));
    const body = await res.json();
    expect(body.result.isError).toBeFalsy();
    const shareUrl = new URL(body.result.structuredContent.shareUrl);
    expect(shareUrl.pathname).toBe('/share/share-1');
    expect(shareUrl.searchParams.get('direction')).toBe('LR');
    expect(body.result.content[0].text).toMatch(/Show these links to the user/);
    expect(m.rateLimit).toHaveBeenCalledWith(`diagram-load:create:ip:${CLIENT_IP}`, 30, 3600);
    expect(m.create).toHaveBeenCalledTimes(1);

    const workingSessionId = body.result.structuredContent.workingSessionId;
    const state = await (await POST(rpc('tools/call', {
      name: 'get_diagram_state', arguments: { workingSessionId },
    }))).json();
    expect(JSON.parse(state.result.content[0].text).nodes.length).toBeGreaterThanOrEqual(3);
  });

  it('returns a private 15-product diagram for the interactive canvas', async () => {
    const mermaid = `graph LR
  contacts["Google Contacts"] --> gmail["Gmail"]
  gmail --> calendar["Google Calendar"]
  calendar --> meet["Google Meet"]
  meet --> drive["Google Drive"]
  gmail --> chat["Google Chat"]
  chat --> tasks["Google Tasks"]
  gemini["Gemini"] --> keep["Google Keep"]
  gemini --> drive
  forms["Google Forms"] --> sheets["Google Sheets"]
  sheets --> slides["Google Slides"]
  slides --> sites["Google Sites"]
  drive --> docs["Google Docs"]
  docs --> sites
  script["Apps Script"] --> sheets`;
    const response = await POST(rpc('tools/call', {
      name: 'generate_diagram',
      arguments: { mermaid, label: 'Google Workspace', publish: false, compactResponse: true },
    }));
    const { result } = await response.json();

    expect(result.structuredContent.success).toBe(true);
    expect(result.structuredContent.nodes).toBeUndefined();
    const canvas = result._meta['archdraw/previewCanvas'];
    expect(canvas.nodes).toHaveLength(15);
    expect(canvas.edges).toHaveLength(14);
    expect(canvas.nodes.find((node: { id: string }) => node.id === 'calendar')?.data.label).toBe('Google Calendar');
    expect(m.create).not.toHaveBeenCalled();
  });

  it('returns 429 when the per-IP endpoint limit is exhausted', async () => {
    m.rateLimit.mockResolvedValueOnce({ allowed: false, remaining: 0, resetAt: now() + 30 });
    const res = await POST(rpc('tools/list'));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBeTruthy();
    expect(m.rateLimit).toHaveBeenCalledWith(`mcp:ip:${CLIENT_IP}`, 120, 60);
  });

  it('rejects oversized bodies and GET streams', async () => {
    const big = new NextRequest('https://archdraw.test/api/mcp', {
      method: 'POST', headers: { 'content-length': '2000000' }, body: 'x',
    });
    expect((await POST(big)).status).toBe(413);
    expect((await GET()).status).toBe(405);
  });
});
