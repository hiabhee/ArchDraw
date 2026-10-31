import { describe, expect, it } from 'vitest';
import { runMermaidPipeline } from '@/lib/diagram/mermaid/pipeline';

type Laid = { id: string; position: { x: number; y: number }; height?: number; parentNode?: string; parentId?: string };

async function layout(mermaid: string) {
  const result: any = await runMermaidPipeline(mermaid, { layoutProfile: 'studio-minimal', areaOrder: 'flow' });
  const nodes = result.data.nodes as Laid[];
  const byId = new Map(nodes.map(node => [node.id, node]));
  const absolute = (node: Laid): { x: number; y: number } => {
    const parent = node.parentNode ?? node.parentId;
    const offset = parent ? absolute(byId.get(parent)!) : { x: 0, y: 0 };
    return { x: node.position.x + offset.x, y: node.position.y + offset.y };
  };
  const centerY = (id: string) => absolute(byId.get(id)!).y + (byId.get(id)!.height ?? 0) / 2;
  return { centerY };
}

const interviewApp = `graph LR
  client["Client"]
  subgraph flask["Flask API"]
    rest["REST API<br/>Flask · gunicorn"]
    engine["Interview engine<br/>tech interview logic"]
    ai["AI service<br/>Groq prompts"]
    voice["Voice service<br/>TTS and STT"]
    db[("App database<br/>Postgres · SQLAlchemy")]
  end
  subgraph ext["External"]
    groq["Groq<br/>LLM API"]
    eleven["ElevenLabs<br/>voice API"]
  end
  client --> rest
  rest --> engine
  engine --> ai
  ai -->|"prompts"| groq
  rest --> voice
  voice -->|"audio"| eleven
  rest -->|"rows"| db
`;

describe('cross-group edges are drawn level', () => {
  it('puts a service and the external API it calls on the same level', async () => {
    const { centerY } = await layout(interviewApp);
    expect(Math.abs(centerY('voice') - centerY('eleven'))).toBeLessThan(1);
    expect(Math.abs(centerY('ai') - centerY('groq'))).toBeLessThan(1);
  });

  it('leaves large offsets (separate lanes) alone', async () => {
    const { centerY } = await layout(`graph LR
  subgraph a["A"]
    a1["One"]
    a2["Two"]
    a3["Three"]
    a4["Four"]
    a5["Five"]
    a6["Six"]
  end
  subgraph b["B"]
    b1["Target"]
  end
  a1 --> a2 --> a3 --> a4 --> a5 --> a6
  a6 --> b1
`);
    expect(Number.isFinite(centerY('b1'))).toBe(true);
  });
});
