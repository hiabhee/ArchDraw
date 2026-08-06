import { describe, it, expect } from 'vitest';
import { parseMermaid } from './parse';

function p(code: string) {
  const r = parseMermaid(code);
  if (!r.ok) console.log('PARSE FAILED:', JSON.stringify(r.errors));
  return r;
}

describe('Mermaid Full Syntax Coverage', () => {

  it('ALL node shapes', () => {
    const r = p(`graph LR
      A["rectangle"]
      B("rounded")
      C(("circle"))
      D[("cylinder")]
      E{{"hexagon"}}
      F{"diamond"}
      G[/"parallelogram"/]
      H[\\"trapezoid\\"]
      I[("big circle")]
      J[["subroutine"]]
      K[("database")]
      L{{"hexagonal"}}
      M([stadium])
      N>asymmetric]
      O(((double circle)))`);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ast.nodes.length).toBe(15);
      const shapes = Object.fromEntries(r.ast.nodes.map(n => [n.id, n.shape]));
      expect(shapes['A']).toBe('rectangle');
      expect(shapes['B']).toBe('rounded');
      expect(shapes['C']).toBe('circle');
      expect(shapes['D']).toBe('cylinder');
      expect(shapes['E']).toBe('hexagon');
      expect(shapes['F']).toBe('diamond');
      expect(shapes['G']).toBe('parallelogram');
      expect(shapes['H']).toBe('parallelogram');
      expect(shapes['I']).toBe('cylinder');
      expect(shapes['J']).toBe('rectangle');
      expect(shapes['K']).toBe('cylinder');
      expect(shapes['L']).toBe('hexagon');
      expect(shapes['M']).toBe('rounded');
      expect(shapes['N']).toBe('parallelogram');
      expect(shapes['O']).toBe('circle');
    }
  });

  it('ALL arrow types', () => {
    const r = p(`graph LR
      A --> B
      C -->|"normal"| D
      E -.-> F
      G -.label.-> H
      I ==> J
      K <--> L
      M --- N
      O --x P
      Q --o R`);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ast.edges.length).toBe(9);
      const types = Object.fromEntries(r.ast.edges.map(e => [`${e.source}-${e.target}`, e.type]));
      expect(types['A-B']).toBe('arrow');
      expect(types['C-D']).toBe('arrow');
      expect(types['E-F']).toBe('dotted');
      expect(types['G-H']).toBe('dotted');
      expect(types['I-J']).toBe('thick');
      expect(types['K-L']).toBe('bidirectional');
      expect(types['M-N']).toBe('open');
      expect(types['O-P']).toBe('open');
      expect(types['Q-R']).toBe('open');
    }
  });

  it('edge labels with pipe syntax', () => {
    const r = p(`graph LR
      A -->|"hello world"| B
      C -->|"with spaces & special"| D
      E -.->|"dotted label"| F
      G ==>|"thick label"| H`);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ast.edges.length).toBe(4);
      expect(r.ast.edges[0].label).toBe('hello world');
      expect(r.ast.edges[1].label).toBe('with spaces & special');
      expect(r.ast.edges[2].label).toBe('dotted label');
      expect(r.ast.edges[3].label).toBe('thick label');
    }
  });

  it('edge labels with space syntax (normalizeEdgeLabels)', () => {
    const r = p(`graph LR
      A -- hello --> B
      C -- with spaces --> D`);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ast.edges.length).toBe(2);
      expect(r.ast.edges[0].label).toBe('hello');
      expect(r.ast.edges[1].label).toBe('with spaces');
    }
  });

  it('HTML in labels', () => {
    const r = p(`graph LR
      A["line1<br/>line2"]
      B -->|"label<br/>break"| C`);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ast.nodes[0].label).toBe('line1<br/>line2');
      expect(r.ast.edges[0].label).toBe('label<br/>break');
    }
  });

  it('nested subgraphs', () => {
    const r = p(`graph LR
      subgraph Outer["Outer"]
        subgraph Inner["Inner"]
          A["Node"]
        end
      end`);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ast.subgraphs.length).toBe(2);
      expect(r.ast.subgraphs[0].id).toBe('Outer');
      expect(r.ast.subgraphs[0].parentId).toBeUndefined();
      expect(r.ast.subgraphs[1].id).toBe('Inner');
      expect(r.ast.subgraphs[1].parentId).toBe('Outer');
    }
  });

  it('subgraph without explicit label', () => {
    const r = p(`graph TD
      subgraph MyGroup
        A["Node"]
      end`);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ast.subgraphs.length).toBe(1);
      expect(r.ast.subgraphs[0].id).toBe('MyGroup');
      expect(r.ast.subgraphs[0].label).toBe('MyGroup');
    }
  });

  it('comments %%', () => {
    const r = p(`graph LR
      %% this is a comment
      A["Node"] %% inline comment
      B["Node"]`);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ast.nodes.length).toBe(2);
    }
  });

  it('all directions', () => {
    expect(p('graph TD\n  A-->B').ok).toBe(true);
    expect(p('graph TB\n  A-->B').ok).toBe(true);
    expect(p('graph LR\n  A-->B').ok).toBe(true);
    expect(p('graph RL\n  A-->B').ok).toBe(true);
    expect(p('graph BT\n  A-->B').ok).toBe(true);
    expect(p('flowchart TD\n  A-->B').ok).toBe(true);
  });

  it('chained edges', () => {
    const r = p(`graph LR
      A --> B --> C
      D -->|"x"| E -->|"y"| F`);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ast.nodes.length).toBe(6);
      expect(r.ast.edges.length).toBe(4);
      expect(r.ast.edges[0].source).toBe('A');
      expect(r.ast.edges[0].target).toBe('B');
      expect(r.ast.edges[1].source).toBe('B');
      expect(r.ast.edges[1].target).toBe('C');
    }
  });

  it('standalone node declarations', () => {
    const r = p(`graph LR
      A["First"]
      B("Second")
      C[("Third")]
      A --> B`);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ast.nodes.length).toBe(3);
      expect(r.ast.edges.length).toBe(1);
      expect(r.ast.nodes[0].label).toBe('First');
      expect(r.ast.nodes[1].label).toBe('Second');
    }
  });

  it('unicode and special chars in labels', () => {
    const r = p(`graph LR
      A["日本語テスト"]
      B["café résumé"]
      C["price: $100"]
      A --> B`);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ast.nodes[0].label).toBe('日本語テスト');
      expect(r.ast.nodes[1].label).toBe('café résumé');
      expect(r.ast.nodes[2].label).toBe('price: $100');
    }
  });

  it('IDs with hyphens and underscores', () => {
    const r = p(`graph LR
      my-node["Hyphen ID"]
      my_node["Underscore ID"]
      my-node --> my_node`);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ast.nodes.length).toBe(2);
      expect(r.ast.nodes[0].id).toBe('my-node');
      expect(r.ast.nodes[1].id).toBe('my_node');
    }
  });

  it('empty graph (no edges)', () => {
    const r = p(`graph LR
      A["Node"]`);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ast.nodes.length).toBe(1);
      expect(r.ast.edges.length).toBe(0);
    }
  });

  it('completely empty mermaid', () => {
    const r = p(`graph LR`);
    expect(r.ok).toBe(true);
  });

  it('multiple edges between same nodes', () => {
    const r = p(`graph LR
      A -->|"request"| B
      A -->|"response"| B`);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ast.edges.length).toBe(2);
    }
  });

  it('mixed arrow types in chains', () => {
    const r = p(`graph LR
      A -.-> B --> C ==> D`);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ast.edges.length).toBe(3);
      expect(r.ast.edges[0].type).toBe('dotted');
      expect(r.ast.edges[1].type).toBe('arrow');
      expect(r.ast.edges[2].type).toBe('thick');
    }
  });

  it('complex real-world diagram', () => {
    const r = p(`graph LR
      subgraph Frontend["Frontend App"]
        React["React SPA"]
        NextJS["Next.js SSR"]
      end

      subgraph Backend["Backend Services"]
        API["API Gateway"]
        Auth["Auth Service"]
        User["User Service"]
      end

      subgraph Data["Data Layer"]
        PG[("PostgreSQL")]
        Redis[("Redis Cache")]
      end

      subgraph Infra["Infrastructure"]
        K8s["Kubernetes"]
        Prom["Prometheus"]
      end

      React -->|"HTTPS"| API
      NextJS -->|"HTTPS"| API
      API -->|"JWT"| Auth
      API -->|"REST"| User
      User -->|"SQL"| PG
      User -.->|"cache"| Redis
      Auth -.->|"cache"| Redis
      User -.->|"metrics"| Prom
      Auth -.->|"logs"| Prom`);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ast.subgraphs.length).toBe(4);
      expect(r.ast.nodes.length).toBe(9);
      expect(r.ast.edges.length).toBe(9);
    }
  });

  it('roundtrip: parse -> serialize -> parse', () => {
    const mermaid = `graph LR
  subgraph App["My App"]
    BL("Business Logic")
  end
  subgraph Core["Core"]
    Notifier("request")
  end
  BL -->|"builds & calls"| Notifier`;

    const r1 = p(mermaid);
    expect(r1.ok).toBe(true);

    // Simulate roundtrip
    if (r1.ok) {
      // Build mermaid from AST manually
      const lines = [`graph ${r1.ast.direction}`];
      for (const sub of r1.ast.subgraphs) {
        lines.push(`  subgraph ${sub.id}["${sub.label}"]`);
        for (const nid of sub.nodeIds) {
          const n = r1.ast.nodes.find(x => x.id === nid);
          if (n) lines.push(`    ${n.id}("${n.label}")`);
        }
        lines.push('  end');
      }
      for (const e of r1.ast.edges) {
        if (e.label) {
          lines.push(`  ${e.source} -->|"${e.label}"| ${e.target}`);
        } else {
          lines.push(`  ${e.source} --> ${e.target}`);
        }
      }

      const r2 = p(lines.join('\n'));
      expect(r2.ok).toBe(true);
      if (r2.ok) {
        expect(r2.ast.nodes.length).toBe(r1.ast.nodes.length);
        expect(r2.ast.edges.length).toBe(r1.ast.edges.length);
        expect(r2.ast.subgraphs.length).toBe(r1.ast.subgraphs.length);
      }
    }
  });

  it('multi-line quoted labels across nested subgraphs', () => {
    const r = p(`flowchart LR
      Producer["Producer"]
      subgraph Kafka["Kafka Cluster"]
        direction TB
        Topic["Topic : Orders"]
        subgraph Broker1["Broker 1"]
          P0["Partition 0
Offset 0
Offset 1
Offset 2"]
        end
        Topic --> P0
      end
      Consumer1["Consumer Group A
Consumer 1"]
      Producer --> Topic
      P0 --> Consumer1`);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const labels = Object.fromEntries(r.ast.nodes.map(n => [n.id, n.label]));
      expect(labels['P0']).toBe('Partition 0\nOffset 0\nOffset 1\nOffset 2');
      expect(labels['Consumer1']).toBe('Consumer Group A\nConsumer 1');
      expect(labels['Topic']).toBe('Topic : Orders');
      // No spurious nodes created from continuation lines
      expect(r.ast.nodes.map(n => n.id)).not.toContain('Offset');
      expect(r.ast.edges.length).toBe(3);
      const broker1 = r.ast.subgraphs.find(s => s.id === 'Broker1');
      expect(broker1?.parentId).toBe('Kafka');
      expect(broker1?.nodeIds).toEqual(['P0']);
    }
  });

  it('escaped quotes in labels do not leak quote state across lines', () => {
    const r = p(`graph LR
      A[\\"trapezoid\\"]
      B["plain"]
      C --> D`);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ast.nodes.map(n => n.id)).toEqual(['A', 'B', 'C', 'D']);
      expect(r.ast.edges.length).toBe(1);
    }
  });

  it('ampersand multi-node edges', () => {
    const r = p(`flowchart TB
      A & B --> C & D
      E --> F & G`);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ast.nodes.map(n => n.id).sort()).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
      expect(r.ast.edges.length).toBe(6);
      const pairs = r.ast.edges.map(e => `${e.source}->${e.target}`).sort();
      expect(pairs).toEqual(['A->C', 'A->D', 'B->C', 'B->D', 'E->F', 'E->G']);
    }
  });

  it('invisible links ~~~', () => {
    const r = p(`graph LR
      A ~~~ B
      C --> D`);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ast.edges.length).toBe(2);
      const inv = r.ast.edges.find(e => e.source === 'A' && e.target === 'B');
      expect(inv?.type).toBe('invisible');
      expect(r.ast.edges.find(e => e.source === 'C')?.type).toBe('arrow');
    }
  });

  it('@{ shape } expanded syntax', () => {
    const r = p(`flowchart LR
      A@{ shape: diamond, label: "Decide" }
      B@{ shape: stadium, label: "Start" }
      C@{ shape: cyl, label: "DB" }
      A --> B --> C`);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const byId = Object.fromEntries(r.ast.nodes.map(n => [n.id, n]));
      expect(byId.A.shape).toBe('diamond');
      expect(byId.A.label).toBe('Decide');
      expect(byId.B.shape).toBe('rounded');
      expect(byId.B.label).toBe('Start');
      expect(byId.C.shape).toBe('cylinder');
      expect(r.ast.edges.length).toBe(2);
    }
  });

  it('markdown string labels', () => {
    const r = p(`flowchart LR
      A["\`**Bold** and _italic_\`"]
      B["\`Line1
Line2\`"]
      A --> B`);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ast.nodes.find(n => n.id === 'A')?.label).toBe('Bold and italic');
      expect(r.ast.nodes.find(n => n.id === 'B')?.label).toBe('Line1\nLine2');
    }
  });

  it('YAML frontmatter and accTitle/accDescr are ignored', () => {
    const r = p(`---
title: Demo
config:
  theme: dark
---
flowchart LR
  accTitle: Accessible title
  accDescr: A longer description
  A --> B`);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ast.nodes.map(n => n.id)).toEqual(['A', 'B']);
      expect(r.ast.edges.length).toBe(1);
      expect(r.ast.direction).toBe('LR');
    }
  });

  it('classDef and style apply fill to nodes', () => {
    const r = p(`graph LR
      classDef hot fill:#ff0000,stroke:#111
      A["Hot"]
      B["Styled"]
      class A hot
      style B fill:#00ff00,stroke:#222
      A --> B`);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ast.nodes.find(n => n.id === 'A')?.style?.fill).toBe('#ff0000');
      expect(r.ast.nodes.find(n => n.id === 'B')?.style?.fill).toBe('#00ff00');
      expect(r.ast.nodes.find(n => n.id === 'B')?.style?.stroke).toBe('#222');
    }
  });

  it('edge ids before arrows are accepted', () => {
    const r = p(`flowchart LR
      A e1@--> B
      A e2@==> C`);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ast.edges.length).toBe(2);
      expect(r.ast.edges[0].type).toBe('arrow');
      expect(r.ast.edges[1].type).toBe('thick');
    }
  });

  it('chained ampersand segments', () => {
    const r = p(`flowchart LR
      a --> b & c --> d`);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const pairs = r.ast.edges.map(e => `${e.source}->${e.target}`).sort();
      expect(pairs).toEqual(['a->b', 'a->c', 'b->d', 'c->d']);
    }
  });
});
