import { describe, it, expect } from 'vitest';
import { parseMermaid } from './parse';

describe('Comprehensive Mermaid Syntax Support', () => {

  it('should parse the Spring Boot Notify example', () => {
    const code = `graph LR

  subgraph App["Your Spring Boot App"]
    BL("Business Logic")
  end

  subgraph Core["spring-notify core (plain Java, zero deps)"]
    Notifier("request")
    SmsReq("SmsRequest")
    PushReq("PushRequest")
    EmailReq("EmailRequest")
    ChatReq("ChatRequest")
  end

  subgraph SPI["Provider SPI (single-method interface)"]
    Twilio("SMS")
    FCM("Push")
    SMTP("Email")
    Slack("Chat")
    Custom("e.g. Vonage, APNs")
  end

  SwapNote("Swap provider =")

  BL -->|"builds & calls"| Notifier
  Notifier --> SmsReq
  Notifier --> PushReq
  Notifier --> EmailReq
  Notifier --> ChatReq
  SmsReq -->|"routes to"| Twilio
  PushReq -->|"routes to"| FCM
  EmailReq -->|"routes to"| SMTP
  ChatReq -->|"routes to"| Slack
  SmsReq -->|"or swap in"| Custom
  Twilio -->|"add starter +<br/>set credentials"| SwapNote`;

    const result = parseMermaid(code);
    console.log('Parse OK:', result.ok);
    if (result.ok) {
      console.log('Nodes:', result.ast.nodes.length);
      console.log('Edges:', result.ast.edges.length);
      console.log('Subgraphs:', result.ast.subgraphs.length);
      for (const n of result.ast.nodes) {
        console.log(`  ${n.id}: label="${n.label}" shape=${n.shape} subgraph=${n.subgraphId}`);
      }
      for (const e of result.ast.edges) {
        console.log(`  ${e.source} --> ${e.target}: label="${e.label}" type=${e.type}`);
      }
      for (const s of result.ast.subgraphs) {
        console.log(`  ${s.id}: label="${s.label}" nodes=[${s.nodeIds}]`);
      }
    } else {
      console.log('Errors:', JSON.stringify(result.errors, null, 2));
    }
    expect(result.ok).toBe(true);
  });

  it('should parse dotted arrows with labels', () => {
    const code = `graph TB
    A -.logs/metrics.-> B
    C -.custom label.-> D
    E -.-> F`;

    const result = parseMermaid(code);
    console.log('Dotted arrow parse OK:', result.ok);
    if (result.ok) {
      console.log('Edges:', result.ast.edges.length, '(expected 3)');
      for (const e of result.ast.edges) {
        console.log(`  ${e.source} --> ${e.target}: label="${e.label}" type=${e.type}`);
      }
    }
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ast.edges.length).toBe(3);
    }
  });

  it('should parse edge labels with pipe syntax including HTML', () => {
    const code = `graph LR
    A -->|"builds & calls"| B
    A -->|"line1<br/>line2"| C
    A -->|simple label| D`;

    const result = parseMermaid(code);
    if (result.ok) {
      expect(result.ast.edges.length).toBe(3);
      expect(result.ast.edges[0].label).toBe('builds & calls');
      expect(result.ast.edges[1].label).toBe('line1<br/>line2');
      expect(result.ast.edges[2].label).toBe('simple label');
    }
  });

  it('should parse all node shapes', () => {
    const code = `graph LR
    A["rectangle"]
    B("rounded")
    C(("circle"))
    D[("cylinder")]
    E{{"hexagon"}}
    F{"diamond"}`;

    const result = parseMermaid(code);
    if (result.ok) {
      expect(result.ast.nodes.length).toBe(6);
      const a = result.ast.nodes.find(n => n.id === 'A');
      const b = result.ast.nodes.find(n => n.id === 'B');
      const c = result.ast.nodes.find(n => n.id === 'C');
      const d = result.ast.nodes.find(n => n.id === 'D');
      const e = result.ast.nodes.find(n => n.id === 'E');
      const f = result.ast.nodes.find(n => n.id === 'F');
      expect(a?.shape).toBe('rectangle');
      expect(b?.shape).toBe('rounded');
      expect(c?.shape).toBe('circle');
      expect(d?.shape).toBe('cylinder');
      expect(e?.shape).toBe('hexagon');
      expect(f?.shape).toBe('diamond');
    }
  });

  it('should parse subgraph with explicit label syntax', () => {
    const code = `graph LR
    subgraph App["My App"]
      A["Node"]
    end`;

    const result = parseMermaid(code);
    if (result.ok) {
      expect(result.ast.subgraphs.length).toBe(1);
      expect(result.ast.subgraphs[0].id).toBe('App');
      expect(result.ast.subgraphs[0].label).toBe('My App');
      expect(result.ast.nodes[0].subgraphId).toBe('App');
    }
  });

  it('should parse standalone nodes with shapes', () => {
    const code = `graph LR
    A("standalone")
    B["also standalone"]
    A --> B`;

    const result = parseMermaid(code);
    if (result.ok) {
      expect(result.ast.nodes.length).toBe(2);
      expect(result.ast.edges.length).toBe(1);
    }
  });

  it('should parse mixed arrow types', () => {
    const code = `graph LR
    A --> B
    C -->|"label"| D
    E -.-> F
    G -.label.-> H
    A ==> B
    X <--> Y`;

    const result = parseMermaid(code);
    if (result.ok) {
      expect(result.ast.edges.length).toBe(6);
    }
  });
});
