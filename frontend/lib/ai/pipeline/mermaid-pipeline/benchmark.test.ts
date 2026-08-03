import { describe, it, expect, afterAll, vi, beforeEach } from 'vitest';
import { runAiMermaidPipelineV2 } from './pipeline-v2';
import type { UserIntent } from '../../types';

// Mock the Groq API calls
vi.mock('../../utils/apiKeyManager', () => ({
  apiKeyManager: {
    rotateToNextKey: vi.fn(),
    getCurrentKey: vi.fn(() => 'mock-api-key'),
    executeWithRetry: vi.fn(async (fn) => {
      // Mock Groq client
      const mockGroq = {} as any;
      const result = await fn(mockGroq);
      return result;
    }),
  },
  requestContext: {
    reset: vi.fn(),
    recordSuccess: vi.fn(),
    recordFailure: vi.fn(),
  },
}));

vi.mock('../../utils/groqJsonCompletion', () => ({
  groqJsonCompletion: vi.fn(async () => {
    // Return a mock architecture plan as JSON string
    return JSON.stringify({
      reasoning: 'Step 0: Load balancers distribute traffic. Step 1: Services process requests. Step 2: Databases store data. Step 3: Cache improves performance. Step 4: Queue handles async tasks. Step 5: Monitoring tracks health. Step 6: Gateway routes requests. Step 7: Clients initiate requests.',
      diagramType: 'graph TD',
      theme: 'slate',
      mermaidCode: `graph TD
        subgraph Client["Client Layer"]
          client["Web Client"]
        end
        subgraph Gateway["Gateway Layer"]
          lb{"Load Balancer"}
        end
        subgraph Service["Service Layer"]
          api["API Service"]
          auth["Auth Service"]
        end
        subgraph Data["Data Layer"]
          db[("PostgreSQL")]
          cache[("Redis Cache")]
        end
        
        client -->|sends request| lb
        lb -->|routes traffic| api
        api -->|validates token| auth
        api -->|queries data| db
        api -->|checks cache| cache
        api -->|returns response| lb
        lb -->|serves response| client`
    });
  }),
}));

const PROMPTS: { name: string; intent: UserIntent }[] = [
  {
    name: 'Load Balancer',
    intent: {
      description: 'Describe the Load Balancer architecture showing how a load balancer distributes incoming traffic across multiple backend servers.',
      systemType: 'architecture',
      complexity: 'medium',
      diagramSize: 'medium',
    },
  },
  {
    name: 'E-Commerce Platform',
    intent: {
      description: 'Design an e-commerce platform with user authentication, product catalog, shopping cart, order processing, payment gateway integration, and a recommendation engine.',
      systemType: 'e-commerce',
      complexity: 'high',
      diagramSize: 'medium',
    },
  },
  {
    name: 'Microservice Architecture',
    intent: {
      description: 'Create a microservice architecture diagram showing API Gateway, multiple services, message queue, and databases.',
      systemType: 'microservices',
      complexity: 'medium',
      diagramSize: 'medium',
    },
  },
];

describe('Mermaid Pipeline Benchmark', () => {
  const results: { name: string; durationMs: number; nodes: number; edges: number; success: boolean }[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  for (const { name, intent } of PROMPTS) {
    it(`measures generation time for "${name}"`, async () => {
      const start = performance.now();
      let result;
      try {
        result = await runAiMermaidPipelineV2(intent);
      } catch (err) {
        const durationMs = performance.now() - start;
        results.push({ name, durationMs, nodes: 0, edges: 0, success: false });
        console.log(`\n[Benchmark] "${name}" — FAILED — ${(durationMs / 1000).toFixed(1)}s`);
        throw err;
      }
      const durationMs = performance.now() - start;
      if (!result.success) {
        results.push({ name, durationMs, nodes: 0, edges: 0, success: false });
        throw result.error;
      }
      const nodeCount = result.data.nodes.length;
      const edgeCount = result.data.edges.length;
      results.push({ name, durationMs, nodes: nodeCount, edges: edgeCount, success: true });

      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`  Prompt:       "${name}"`);
      console.log(`  Duration:     ${(durationMs / 1000).toFixed(1)}s`);
      console.log(`  Nodes:        ${nodeCount}`);
      console.log(`  Edges:        ${edgeCount}`);
      console.log(`  Score:        ${result.data.score ?? 'N/A'}`);
      console.log(`  Success:      ${result.success}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

      expect(durationMs).toBeGreaterThan(0);
    });
  }

  afterAll(() => {
    console.log('\n═══════════════════════════════════════════════');
    console.log('  BENCHMARK SUMMARY');
    console.log('═══════════════════════════════════════════════');
    for (const r of results) {
      const status = r.success ? '✓' : '✗';
      console.log(`  ${status} ${r.name.padEnd(30)} ${(r.durationMs / 1000).toFixed(1)}s  (${r.nodes} nodes, ${r.edges} edges)`);
    }
    if (results.length > 0) {
      const avg = results.reduce((s, r) => s + r.durationMs, 0) / results.length;
      console.log(`  ───────────────────────────────────────────`);
      console.log(`  Average:      ${(avg / 1000).toFixed(1)}s`);
    }
    console.log('═══════════════════════════════════════════════\n');
  });
});
