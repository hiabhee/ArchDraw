const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType, VerticalAlign, PageNumber, TabStopType, TabStopPosition, LevelFormat, convertInchesToTwip } = require('docx');
const fs = require('fs');
const path = require('path');

const SITE_DOMAIN = 'archdraw.app';
const AUDIT_DATE = '2026-09-02';
const AUDIT_TYPE = 'FULL AUDIT';
const OUT_DIR = path.join(__dirname, '..', 'outputs');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const docxPath = path.join(OUT_DIR, `seo-audit-${SITE_DOMAIN.replace(/\./g, '-')}-${AUDIT_DATE}.docx`);
const pdfPath = path.join(OUT_DIR, `seo-audit-${SITE_DOMAIN.replace(/\./g, '-')}-${AUDIT_DATE}.pdf`);

// Scores
const SCORES = { seo: 8, geo: 6, aeo: 7 };
function scoreColor(score) { if (score >=8) return '16A34A'; if (score>=5) return 'D97706'; return 'DC2626'; }
function statusLabel(score) { if (score>=8) return 'Strong'; if (score>=5) return 'On Track'; return 'Needs Work'; }
function statusColor(score) { return scoreColor(score); }

// Helpers
function cell(text, opts={}) {
  const { bold=false, size=11, color='1E293B', align=AlignmentType.LEFT, shading, italics=false, font='Arial' } = opts;
  const para = new Paragraph({
    alignment: align,
    children: [new TextRun({ text, bold, size: size*2, color, italics, font })],
    spacing: { before: 40, after: 40 },
  });
  const props = { verticalAlign: VerticalAlign.CENTER };
  if (shading) props.shading = { type: ShadingType.CLEAR, color: 'auto', fill: shading };
  if (opts.borders) props.borders = opts.borders;
  if (opts.width) props.width = opts.width;
  if (opts.columnSpan) props.columnSpan = opts.columnSpan;
  return new TableCell({ children: [para], ...props, margins: { top: 80, bottom: 80, left: 100, right: 100 } });
}
function heading(text, level, color='1B2A4A', size=24) {
  return new Paragraph({
    heading: level,
    spacing: { before: 240, after: 160 },
    children: [new TextRun({ text, bold: true, size: size*2, color, font: 'Arial' })],
  });
}
function body(text, opts={}) {
  const { bold=false, size=11, color='475569', spacingAfter=120 } = opts;
  return new Paragraph({
    spacing: { after: spacingAfter },
    children: [new TextRun({ text, size: size*2, color, bold, font: 'Arial' })],
    alignment: AlignmentType.LEFT,
  });
}
function bullet(text) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 60 },
    children: [new TextRun({ text, size: 22, color: '475569', font: 'Arial' })],
  });
}

// Cover section
const coverChildren = [];

// top spacer
coverChildren.push(new Paragraph({ children: [new TextRun({ text: '', size: 22, color: '1B2A4A' })], spacing: { before: 1800, after: 0 }, shading: { type: ShadingType.CLEAR, color: 'auto', fill: '1B2A4A' } }));
coverChildren.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 200 },
  children: [new TextRun({ text: SITE_DOMAIN, bold: true, size: 72, color: 'FFFFFF', font: 'Arial' })],
  shading: { type: ShadingType.CLEAR, color: 'auto', fill: '1B2A4A' }
}));
coverChildren.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 300 },
  children: [new TextRun({ text: 'SEO / GEO / AEO Audit Report', size: 36, color: '93C5FD', font: 'Arial' })],
  shading: { type: ShadingType.CLEAR, color: 'auto', fill: '1B2A4A' }
}));
coverChildren.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 400 },
  children: [new TextRun({ text: AUDIT_TYPE, size: 22, color: 'FFFFFF', font: 'Arial' })],
  shading: { type: ShadingType.CLEAR, color: 'auto', fill: '1B2A4A' }
}));

// Score table on cover - 3 columns
const coverScoreTable = new Table({
  width: { size: 9360, type: WidthType.DXA },
  borders: { top: { style: BorderStyle.NONE, size: 0, color: '1B2A4A' }, bottom: { style: BorderStyle.NONE, size: 0, color: '1B2A4A' }, left: { style: BorderStyle.NONE, size: 0, color: '1B2A4A' }, right: { style: BorderStyle.NONE, size: 0, color: '1B2A4A' }, insideH: { style: BorderStyle.NONE, size: 0, color: '1B2A4A' }, insideV: { style: BorderStyle.NONE, size: 0, color: '1B2A4A' } },
  rows: [
    new TableRow({
      children: ['SEO','GEO','AEO'].map((label, i) => {
        const score = [SCORES.seo, SCORES.geo, SCORES.aeo][i];
        const fill = scoreColor(score);
        const status = statusLabel(score);
        return new TableCell({
          shading: { type: ShadingType.CLEAR, color: 'auto', fill },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 180, bottom: 180, left: 100, right: 100 },
          children: [
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: label, bold: true, size: 20, color: 'FFFFFF', font: 'Arial' })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${score}/10`, bold: true, size: 72, color: 'FFFFFF', font: 'Arial' })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: status, italics: true, size: 18, color: 'FFFFFF', font: 'Arial' })] }),
          ]
        });
      })
    })
  ]
});
coverChildren.push(coverScoreTable);

// bottom spacer + attribution
coverChildren.push(new Paragraph({ children: [new TextRun({ text: '', size: 22, color: '1B2A4A' })], spacing: { before: 1800, after: 0 }, shading: { type: ShadingType.CLEAR, color: 'auto', fill: '1B2A4A' } }));
coverChildren.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: `Audit date: ${AUDIT_DATE}`, size: 18, color: '94A3B8', font: 'Arial' })],
  shading: { type: ShadingType.CLEAR, color: 'auto', fill: '1B2A4A' }
}));
coverChildren.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: 'Claude Skill and Plugin by Alex Labat', size: 18, color: '94A3B8', font: 'Arial' })],
  shading: { type: ShadingType.CLEAR, color: 'auto', fill: '1B2A4A' }
}));

// Main content children
const mainChildren = [];

// Executive Summary
mainChildren.push(heading('Executive Summary', HeadingLevel.HEADING_1, '1B2A4A', 24));
const summaryBox = new Table({
  width: { size: 9360, type: WidthType.DXA },
  borders: { top: { style: BorderStyle.SINGLE, size: 6, color: 'BFDBFE' }, bottom: { style: BorderStyle.SINGLE, size: 6, color: 'BFDBFE' }, left: { style: BorderStyle.SINGLE, size: 6, color: 'BFDBFE' }, right: { style: BorderStyle.SINGLE, size: 6, color: 'BFDBFE' } },
  rows: [new TableRow({ children: [new TableCell({ shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'EFF6FF' }, children: [new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: 'ArchDraw (archdraw.app) presents as a strong, developer-focused product with excellent technical content and a clean, crawlable architecture. The homepage, docs, mcp, repo-diagram and 11 engineering blogs are substantial, well-structured, and already AI-friendly. The single most urgent issue is that your new AI-discovery surface — /llms-full.txt, /openapi.json, /docs/sitemap.md, /docs/taxonomy.json, /docs/graph.json, /humans.txt and /.well-known/security.txt — is built locally but returns 404 in production (only /llms.txt is live). This blocks the exact agents you want to attract (GPTBot, ClaudeBot, PerplexityBot) from loading your full corpus in one fetch. The biggest opportunity is to ship those files, add FAQ/HowTo/Speakable schema to your deep guides, and fix the canonical domain split (archdraw.app vs hiabhee.online) to consolidate entity signals for GEO.', size: 22, color: '1E293B', font: 'Arial' })] })] })] })],
});
mainChildren.push(summaryBox);
mainChildren.push(new Paragraph({ spacing: { after: 200 }, children: [] }));

// Scores table
const scoresTable = new Table({
  width: { size: 9360, type: WidthType.DXA },
  borders: { top: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' }, bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' }, left: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' }, right: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' }, insideH: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' }, insideV: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' } },
  rows: [
    new TableRow({
      children: [
        new TableCell({ shading: { type: ShadingType.CLEAR, color: 'auto', fill: '1B2A4A' }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Dimension', bold: true, size: 20, color: 'FFFFFF', font: 'Arial' })] })] }),
        new TableCell({ shading: { type: ShadingType.CLEAR, color: 'auto', fill: '1B2A4A' }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Score', bold: true, size: 20, color: 'FFFFFF', font: 'Arial' })] })] }),
        new TableCell({ shading: { type: ShadingType.CLEAR, color: 'auto', fill: '1B2A4A' }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Status', bold: true, size: 20, color: 'FFFFFF', font: 'Arial' })] })] }),
        new TableCell({ shading: { type: ShadingType.CLEAR, color: 'auto', fill: '1B2A4A' }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Key Takeaway', bold: true, size: 20, color: 'FFFFFF', font: 'Arial' })] })] }),
      ]
    }),
    ...[
      { dim: 'SEO', score: SCORES.seo, take: 'Strong technical foundation; fix canonical + sitemap 404s' },
      { dim: 'GEO', score: SCORES.geo, take: 'Good authority signals; missing llms-full/openapi blocks AI citations' },
      { dim: 'AEO', score: SCORES.aeo, take: 'FAQ schema exists on 2 pages; needs HowTo/Speakable + snippets' },
    ].map(r => new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: r.dim, bold: true, size: 22, color: '1E293B', font: 'Arial' })] })] }),
        new TableCell({ shading: { type: ShadingType.CLEAR, color: 'auto', fill: statusColor(r.score) }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${r.score}/10`, bold: true, size: 22, color: 'FFFFFF', font: 'Arial' })] })] }),
        new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: statusLabel(r.score), size: 20, color: statusColor(r.score), font: 'Arial' })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r.take, size: 18, color: '475569', font: 'Arial' })] })] }),
      ]
    })),
    new TableRow({
      children: [
        new TableCell({ shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F8F9FA' }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Combined', bold: true, size: 22, color: '1E293B', font: 'Arial' })] })] }),
        new TableCell({ shading: { type: ShadingType.CLEAR, color: 'auto', fill: '1B2A4A' }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${SCORES.seo+SCORES.geo+SCORES.aeo}/30`, bold: true, size: 22, color: 'FFFFFF', font: 'Arial' })] })] }),
        new TableCell({ columnSpan: 2, children: [new Paragraph({ children: [new TextRun({ text: 'Strong base; ship discovery files to reach 26+/30', size: 18, color: '475569', font: 'Arial' })] })] }),
      ]
    })
  ]
});
mainChildren.push(scoresTable);

// Pages audited
mainChildren.push(heading('Pages Audited', HeadingLevel.HEADING_1));
mainChildren.push(body('47 URLs in sitemap.xml + 6 discovery checks. Full crawl covered homepage + docs + mcp + repo-diagram + blogs index + 2 blog posts + tutorials + llms.txt + 4 missing discovery paths + humans/security. Sample below — full table in production crawl includes every tutorial and blog post.'));
const pagesData = [
  ['https://archdraw.app/', 'Homepage', '200 — canonical present, OG complete'],
  ['https://archdraw.app/docs', 'Docs hub', '200 — 8 sections, TechArticle schema (local)'],
  ['https://archdraw.app/mcp', 'Guide', '200 — Article+FAQPage schema, config snippet'],
  ['https://archdraw.app/repo-diagram', 'Guide', '200 — 5-stage pipeline, FAQ schema'],
  ['https://archdraw.app/blogs', 'Blog index', '200 — 11 posts, clean pagination'],
  ['https://archdraw.app/blogs/ai-generation-pipeline', 'Article', '200 — TechArticle schema (local), 4 sections'],
  ['https://archdraw.app/tutorials', 'Catalog', '200 — 24 tutorials (client fetch)'],
  ['https://archdraw.app/llms.txt', 'Discovery', '200 — compact index, live ✓'],
  ['https://archdraw.app/llms-full.txt', 'Discovery', '404 — built locally, not deployed ✗'],
  ['https://archdraw.app/openapi.json', 'Discovery', '404 — built locally, not deployed ✗'],
  ['https://archdraw.app/docs/sitemap.md', 'Discovery', '404 — not deployed ✗'],
  ['https://archdraw.app/docs/taxonomy.json', 'Discovery', '404 — not deployed ✗'],
  ['https://archdraw.app/docs/graph.json', 'Discovery', '404 — not deployed ✗'],
  ['https://archdraw.app/humans.txt', 'Discovery', '404 — not deployed ✗'],
  ['https://archdraw.app/.well-known/security.txt', 'Discovery', '404 — not deployed ✗'],
  ['https://archdraw.app/sitemap.xml', 'Sitemap', '200 — 47 URLs, valid XML'],
  ['https://archdraw.app/robots.txt', 'Robots', '200 — allows GPTBot/ClaudeBot, but no explicit discovery Allow'],
];
const pagesTable = new Table({
  width: { size: 9360, type: WidthType.DXA },
  borders: { top: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' }, bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' }, left: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' }, right: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' }, insideH: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' }, insideV: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' } },
  rows: [
    new TableRow({ children: [
      new TableCell({ shading: { type: ShadingType.CLEAR, color: 'auto', fill: '1B2A4A' }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'URL', bold: true, size: 18, color: 'FFFFFF', font: 'Arial' })] })] }),
      new TableCell({ shading: { type: ShadingType.CLEAR, color: 'auto', fill: '1B2A4A' }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Type', bold: true, size: 18, color: 'FFFFFF', font: 'Arial' })] })] }),
      new TableCell({ shading: { type: ShadingType.CLEAR, color: 'auto', fill: '1B2A4A' }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Notes', bold: true, size: 18, color: 'FFFFFF', font: 'Arial' })] })] }),
    ]}),
    ...pagesData.map((r, idx) => new TableRow({
      children: [
        new TableCell({ shading: idx%2===1 ? { type: ShadingType.CLEAR, color: 'auto', fill: 'F8F9FA' } : undefined, children: [new Paragraph({ children: [new TextRun({ text: r[0], size: 16, color: '2563EB', font: 'Arial' })] })] }),
        new TableCell({ shading: idx%2===1 ? { type: ShadingType.CLEAR, color: 'auto', fill: 'F8F9FA' } : undefined, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: r[1], size: 16, color: '475569', font: 'Arial' })] })] }),
        new TableCell({ shading: idx%2===1 ? { type: ShadingType.CLEAR, color: 'auto', fill: 'F8F9FA' } : undefined, children: [new Paragraph({ children: [new TextRun({ text: r[2], size: 16, color: '475569', font: 'Arial' })] })] }),
      ]
    }))
  ]
});
mainChildren.push(pagesTable);

// Helper for signal tables
function signalTable(rows) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    borders: { top: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' }, bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' }, left: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' }, right: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' }, insideH: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' }, insideV: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' } },
    rows: [
      new TableRow({ children: [
        new TableCell({ shading: { type: ShadingType.CLEAR, color: 'auto', fill: '1B2A4A' }, width: { size: 2800, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: 'Signal', bold: true, size: 18, color: 'FFFFFF', font: 'Arial' })] })] }),
        new TableCell({ shading: { type: ShadingType.CLEAR, color: 'auto', fill: '1B2A4A' }, children: [new Paragraph({ children: [new TextRun({ text: 'Finding', bold: true, size: 18, color: 'FFFFFF', font: 'Arial' })] })] }),
        new TableCell({ shading: { type: ShadingType.CLEAR, color: 'auto', fill: '1B2A4A' }, width: { size: 1800, type: WidthType.DXA }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Status', bold: true, size: 18, color: 'FFFFFF', font: 'Arial' })] })] }),
      ]}),
      ...rows.map(([sig, find, stat]) => {
        const color = stat==='Good' ? '16A34A' : stat==='Missing' ? 'DC2626' : 'D97706';
        return new TableRow({ children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: sig, bold: true, size: 18, color: '1E293B', font: 'Arial' })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: find, size: 18, color: '475569', font: 'Arial' })] })] }),
          new TableCell({ shading: { type: ShadingType.CLEAR, color: 'auto', fill: color }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: stat, bold: true, size: 18, color: 'FFFFFF', font: 'Arial' })] })] }),
        ]});
      })
    ]
  });
}

// SEO Analysis
mainChildren.push(heading('SEO Analysis — 8/10 Strong', HeadingLevel.HEADING_1));
mainChildren.push(heading('Technical On-Page', HeadingLevel.HEADING_2, '2563EB', 18));
mainChildren.push(signalTable([
  ['Title tag', 'Present on every page. Homepage: “ArchDraw — System Architecture Diagram & Design Tool” (~52 chars) contains primary keywords (architecture diagram, system design tool). Docs/MCP titles unique. No duplication.', 'Good'],
  ['Meta description', 'Homepage: “Design and map production system architecture…” (~102 chars). Engaging, has CTA (Share/export). Short of 150-160 — can extend with “AI-assisted, Mermaid, GitHub repo → diagram”. Blog meta present via summary.', 'Needs Attention'],
  ['Heading hierarchy', 'H1 singular on all pages (homepage: “Build accurate architecture diagrams in seconds — not hours.”). H2/H3 logical (ValueProps, HowItWorks). No stuffing.', 'Good'],
  ['URL structure', 'Clean: /docs, /blogs/:slug, /tutorials/:id, /mcp, /repo-diagram. Readable, keyword-relevant, no params.', 'Good'],
  ['Canonical tag', 'Present but points to https://archdraw.app while NEXT_PUBLIC_APP_URL still references hiabhee.online in code and sitemap uses archdraw.app — mixed signals. Make canonical self-referencing to single host and 301 redirect alternate.', 'Needs Attention'],
  ['Robots meta', 'index,follow + googleBot max-* — correct. No accidental noindex.', 'Good'],
  ['Viewport / Mobile', '<meta name="viewport" width=device-width, initial-scale=1, viewport-fit=cover> present. Mobile meta OK.', 'Good'],
  ['Image alt text', 'OG image has alt (“ArchDraw System Architecture Design Tool”). Landing demo SVGs use decorative images — add descriptive alt to hero floating nodes.', 'Needs Attention'],
  ['Internal links', 'Nav: Documentation, Engineering Blog, Go to Dashboard (descriptive). Docs page links to all sections via sidebar. Good anchor text.', 'Good'],
  ['Open Graph / Twitter', 'og:title/description/url/site_name/locale/image (1200x630) + twitter:card summary_large_image present on all pages. Correct.', 'Good'],
]));
mainChildren.push(heading('Content Quality', HeadingLevel.HEADING_2, '2563EB', 18));
mainChildren.push(signalTable([
  ['Word count', 'Docs: ~2,800 words across 8 sections. Blogs: 900-1,200 words with code blocks. Tutorials: 25 guides. Substantial.', 'Good'],
  ['Keyword signals', 'Primary: “system architecture diagram”, “MCP server for diagramming”, “GitHub repo → diagram”. Semantic: React Flow, Dagre, Groq, Mermaid. Well established.', 'Good'],
  ['Freshness signals', 'Sitemap lastmod = 2026-08-27 (weekly/monthly). llms.txt last-updated now 2026-09-02 after your local fix — deploy to make it live.', 'Needs Attention'],
  ['Readability', 'Docs uses cards, tables, callouts, code snippets. Blogs use numbered steps, bullets, code. Scannable.', 'Good'],
]));
mainChildren.push(heading('Structured Data', HeadingLevel.HEADING_2, '2563EB', 18));
mainChildren.push(signalTable([
  ['Schema markup', 'Global Organization + WebSite + SoftwareApplication JSON-LD on every page (via layout.tsx). MCP/repo-diagram have Article+FAQPage. Blog posts now get TechArticle+BreadcrumbList (local). Docs gets TechArticle+BreadcrumbList (local) — not yet live.', 'Needs Attention'],
  ['Schema validity', 'JSON-LD valid, uses @id publisher linkage. Offer price 0 USD “Free during beta” correct. Missing: BreadcrumbList on most pages, HowTo on tutorials.', 'Needs Attention'],
]));

// GEO Analysis
mainChildren.push(heading('GEO Analysis — 6/10 On Track', HeadingLevel.HEADING_1));
mainChildren.push(heading('E-E-A-T Assessment', HeadingLevel.HEADING_2, '2563EB', 18));
mainChildren.push(signalTable([
  ['Author information', 'No named authors/bylines on blogs — “ArchDraw” generic. Weak E-E-A-T for AI citation. Add author bios with credentials to blogs/tutorials.', 'Missing'],
  ['About page', 'Landing has FounderNote; no dedicated /about or Team page with bios/qualifications. AI engines prefer explicit author entity.', 'Needs Attention'],
  ['Contact information', 'Footer has GitHub link, no NAP (address/phone) needed for SaaS but email/contact form link not in nav. AI trusts accessible contact.', 'Needs Attention'],
  ['Trust signals', 'Testimonials/press not visible on homepage crawl. Blogs provide authority via technical depth but no awards/certs displayed.', 'Needs Attention'],
  ['Organization schema', 'Strong: name ArchDraw, url archdraw.app, logo /api/og/home, sameAs GitHub. Declares brand entity clearly.', 'Good'],
]));
mainChildren.push(heading('Content for AI Synthesis', HeadingLevel.HEADING_2, '2563EB', 18));
mainChildren.push(signalTable([
  ['Factual density', 'High: blogs cite pipeline stages, Dagre spacing (nodeSep 140/rankSep 220), component counts (150+). MCP page cites stdio JSON-RPC. Excellent for citations.', 'Good'],
  ['Clear claims', 'Homepage H1 states value prop plainly at top: “Build accurate architecture diagrams in seconds — not hours.”', 'Good'],
  ['Source citation', 'GitHub repo linked as source everywhere. Blogs cite ELK/Dagre, Groq, Prisma. External citations present but sparse — add authoritative links.', 'Needs Attention'],
  ['Comprehensiveness', 'Docs fully addresses 8 topics; MCP page answers what/why/how with FAQ; repo-diagram page details 5-stage pipeline. Leaves little unanswered.', 'Good'],
  ['Entity clarity', 'Brand “ArchDraw” named consistently 100+ times. No alias drift — but taxonomy.json (not yet live) would lock this for agents.', 'Needs Attention'],
  ['Originality signals', 'Strong: unique Dagre-via-Mermaid layout, floating edges ±16, tiered pipeline, MCP stdio bridge — not generic.', 'Good'],
]));
mainChildren.push(heading('Technical GEO', HeadingLevel.HEADING_2, '2563EB', 18));
mainChildren.push(signalTable([
  ['Structured data depth', 'Basic 3 types only. Missing rich types: Author, Dataset, TechArticle details, SpeakableSpecification. Taxonomy/graph would deepen entity graph — currently 404.', 'Missing'],
  ['HTTPS / security', 'HTTPS on archdraw.app, CSP, HSTS expected. Security headers present (X-Content-Type-Options, etc). Good.', 'Good'],
  ['Clean crawlability', 'robots.txt allows GPTBot/ClaudeBot/PerplexityBot for / and /docs but no explicit Allow for /llms.txt etc. Live blocks none, but checklist wants explicit Allow for discovery paths. WAF not tested.', 'Needs Attention'],
  ['Brand entity links', 'sameAs only GitHub. Add Twitter/LinkedIn/product hunt links to strengthen entity graph.', 'Needs Attention'],
]));

// AEO Analysis
mainChildren.push(heading('AEO Analysis — 7/10 On Track', HeadingLevel.HEADING_1));
mainChildren.push(heading('Featured Snippet Eligibility', HeadingLevel.HEADING_2, '2563EB', 18));
mainChildren.push(signalTable([
  ['Direct answer paragraphs', 'MCP page answers “What is an MCP server…” in 2 concise paragraphs (40-60 words) below H1 — snippet-ready. Repo-diagram similarly.', 'Good'],
  ['Definition patterns', 'MCP page: “An MCP server for diagramming is a local bridge that lets…” — perfect “X is…” definition.', 'Good'],
  ['List content', 'Homepage HowItWorks 4 steps, docs 3-step code blocks, MCP 4 FeatureCards with bullets — list snippet eligible.', 'Good'],
  ['Table content', 'Node Types table (Tier Category / Color / Example) present — table snippet eligible. More comparison tables would help.', 'Needs Attention'],
]));
mainChildren.push(heading('Structured Answer Formats', HeadingLevel.HEADING_2, '2563EB', 18));
mainChildren.push(signalTable([
  ['FAQ schema', 'MCP + repo-diagram have FAQPage schema (4 Qs each). Blogs lack FAQ — but /docs#faq not marked up as FAQPage. Extend.', 'Needs Attention'],
  ['HowTo schema', 'No HowTo schema despite “How to generate…” and “How to set up MCP” guides being step-based. Add HowTo with supply/tool/step.', 'Missing'],
  ['Question-phrased headings', 'Docs sidebar: “Getting Started” not phrased as question; FAQ items are questions but H2s elsewhere are assertive not question — add “How do I connect the MCP server?” style.', 'Needs Attention'],
  ['Speakable schema', 'No SpeakableSpecification — voice assistants can’t target concise answer paragraphs. Add to FAQ definitions.', 'Missing'],
]));
mainChildren.push(heading('Voice Search Readiness', HeadingLevel.HEADING_2, '2563EB', 18));
mainChildren.push(signalTable([
  ['Conversational language', 'Homepage “so you stop fighting draw.io” + docs callouts are conversational, but pipeline docs are technical — balance is OK.', 'Good'],
  ['Long-tail question coverage', 'FAQ covers “Is ArchDraw free?”, “Why are my edges overlapping?”, “Can I self-host MCP?” — covers who/what/why. Could add “How much does ArchDraw cost after beta?”', 'Needs Attention'],
  ['Local signals', 'N/A — SaaS devtool, not local biz. NAP not required.', 'Good'],
]));

// Priority Recommendations Matrix
mainChildren.push(heading('Priority Recommendations', HeadingLevel.HEADING_1));
const prioRows = [
  ['🔴 Critical', 'Deploy missing discovery files: /llms-full.txt, /openapi.json, /docs/sitemap.md, /docs/taxonomy.json, /docs/graph.json, /humans.txt, /.well-known/security.txt (currently 404; only /llms.txt is live)', 'GEO', 'Low', 'High'],
  ['🔴 Critical', 'Fix canonical/domain split: homepage canonical https://archdraw.app vs hiabhee.online references — choose one host, 301 other, update NEXT_PUBLIC_APP_URL + sitemap host', 'SEO', 'Low', 'High'],
  ['🟠 High', 'Add FAQPage + HowTo + Speakable schema to Docs (#faq), MCP guide steps (install → config → verify), and “How to generate from GitHub repo”', 'AEO', 'Medium', 'High'],
  ['🟠 High', 'Explicit robots.txt Allow for discovery paths for GPTBot/ClaudeBot/PerplexityBot/ Bytespider/Google-Extended — currently only Allow: / (implicit)', 'GEO', 'Low', 'Medium'],
  ['🟡 Medium', 'Author E-E-A-T: add bylines + author pages with credentials to 11 blogs; create /about team page linked from footer/nav', 'GEO', 'Medium', 'Medium'],
  ['🟡 Medium', 'Extend meta descriptions to 150-160 chars with CTA on homepage + docs; audit title lengths (homepage 52 ✓, docs pages check)', 'SEO', 'Low', 'Medium'],
  ['🟢 Quick Win', 'Add Organization sameAs social links (Twitter/X, LinkedIn) + brand entity graph in header JSON-LD', 'GEO', 'Low', 'Medium'],
  ['🟢 Quick Win', 'Alt text audit: add descriptive alt to hero floating nodes and blog illustrative images (currently decorative)', 'SEO', 'Low', 'Low'],
];
const prioTable = new Table({
  width: { size: 9360, type: WidthType.DXA },
  borders: { top: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' }, bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' }, left: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' }, right: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' }, insideH: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' }, insideV: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' } },
  rows: [
    new TableRow({ children: [
      new TableCell({ shading: { type: ShadingType.CLEAR, color: 'auto', fill: '1B2A4A' }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Priority', bold: true, size: 16, color: 'FFFFFF', font: 'Arial' })] })] }),
      new TableCell({ shading: { type: ShadingType.CLEAR, color: 'auto', fill: '1B2A4A' }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Issue', bold: true, size: 16, color: 'FFFFFF', font: 'Arial' })] })] }),
      new TableCell({ shading: { type: ShadingType.CLEAR, color: 'auto', fill: '1B2A4A' }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Dim', bold: true, size: 16, color: 'FFFFFF', font: 'Arial' })] })] }),
      new TableCell({ shading: { type: ShadingType.CLEAR, color: 'auto', fill: '1B2A4A' }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Effort', bold: true, size: 16, color: 'FFFFFF', font: 'Arial' })] })] }),
      new TableCell({ shading: { type: ShadingType.CLEAR, color: 'auto', fill: '1B2A4A' }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Impact', bold: true, size: 16, color: 'FFFFFF', font: 'Arial' })] })] }),
    ]}),
    ...prioRows.map(r => {
      const fill = r[0].includes('Critical') ? 'DC2626' : r[0].includes('High') ? 'EA580C' : r[0].includes('Medium') ? 'D97706' : '16A34A';
      return new TableRow({ children: [
        new TableCell({ shading: { type: ShadingType.CLEAR, color: 'auto', fill }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: r[0], bold: true, size: 16, color: 'FFFFFF', font: 'Arial' })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r[1], size: 16, color: '1E293B', font: 'Arial' })] })] }),
        new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: r[2], size: 16, color: '475569', font: 'Arial' })] })] }),
        new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: r[3], size: 16, color: '475569', font: 'Arial' })] })] }),
        new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: r[4], size: 16, color: '475569', font: 'Arial' })] })] }),
      ]});
    })
  ]
});
mainChildren.push(prioTable);

// What's working well
mainChildren.push(heading("What's Working Well", HeadingLevel.HEADING_1));
const goodRows = [
  'llms.txt live & well-formed — follows llmstxt.org spec with Docs/Guides/API/Discovery/Source sections, concise and token-efficient (~10.5k).',
  'Sitemap.xml valid with 47 URLs, lastmod, changefreq, priority — covers /mcp and /repo-diagram guides many devtools omit.',
  'Homepage value prop crystal-clear at top: “Build accurate architecture diagrams in seconds — not hours.” — GEO/featured snippet ready.',
  'MCP + repo-diagram guides are answer-engine gold: question-phrased FAQs, definition sentences, numbered steps, config JSON code blocks.',
  'Global Organization/WebSite/SoftwareApplication JSON-LD correct with @id publisher linkage and GitHub sameAs.',
  'Open Graph + Twitter Card complete on every page (title/description/url/image 1200x630) — social + AI crawler friendly.',
  'Engineering blogs (11) are factual-dense with Dagre spacing specs, pipeline stages, self-healing loops — ideal for AI citations.',
  'robots.txt allows GPTBot, ClaudeBot, PerplexityBot, Google-Extended — not blocking AI crawlers.',
];
const goodTable = new Table({
  width: { size: 9360, type: WidthType.DXA },
  borders: { top: { style: BorderStyle.SINGLE, size: 4, color: 'BBF7D0' }, bottom: { style: BorderStyle.SINGLE, size: 4, color: 'BBF7D0' }, left: { style: BorderStyle.SINGLE, size: 4, color: 'BBF7D0' }, right: { style: BorderStyle.SINGLE, size: 4, color: 'BBF7D0' }, insideH: { style: BorderStyle.SINGLE, size: 4, color: 'BBF7D0' }, insideV: { style: BorderStyle.SINGLE, size: 4, color: 'BBF7D0' } },
  rows: [
    new TableRow({ children: [new TableCell({ shading: { type: ShadingType.CLEAR, color: 'auto', fill: '1B2A4A' }, children: [new Paragraph({ children: [new TextRun({ text: "What's Working — Specific Evidence", bold: true, size: 18, color: 'FFFFFF', font: 'Arial' })] })] })] }),
    ...goodRows.map(t => new TableRow({ children: [new TableCell({ shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F0FDF4' }, children: [new Paragraph({ children: [new TextRun({ text: '✓  ' + t, size: 18, color: '166534', font: 'Arial' })] })] })] }))
  ]
});
mainChildren.push(goodTable);

// Glossary
mainChildren.push(heading('Glossary', HeadingLevel.HEADING_1));
mainChildren.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: 'SEO (Search Engine Optimization): Traditional ranking in Google/Bing via titles, metas, headings, links, performance, and schema.', bold: true, size: 20, color: '1E293B', font: 'Arial' })] }));
mainChildren.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: 'GEO (Generative Engine Optimization): Optimization for AI-powered search (ChatGPT Search, Perplexity, Gemini, Google AI Overviews) that synthesizes answers and cites sources — rewards E-E-A-T, factual density, and clean entity graphs.', bold: true, size: 20, color: '1E293B', font: 'Arial' })] }));
mainChildren.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: 'AEO (Answer Engine Optimization): Optimization for featured snippets, People Also Ask, and voice search — where engines extract a direct 40-60 word answer. Rewards question headings, definition patterns, lists/tables, and FAQ/HowTo/Speakable schema.', bold: true, size: 20, color: '1E293B', font: 'Arial' })] }));
mainChildren.push(body('For Core Web Vitals / page speed, run a Google PageSpeed Insights report at pagespeed.web.dev — HTML fetch can’t assess real paint metrics.', { color: '64748B' }));

// Build document with sections
const doc = new Document({
  numbering: { config: [{ reference: 'default', levels: [{ level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT }] }] },
  sections: [
    {
      properties: {
        page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
        titlePage: true,
      },
      children: coverChildren,
    },
    {
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.LEFT,
            border: { bottom: { color: '1B2A4A', size: 8, style: BorderStyle.SINGLE, space: 120 } },
            children: [
              new TextRun({ text: SITE_DOMAIN, size: 18, color: '475569', font: 'Arial' }),
              new TextRun({ text: '\tSEO / GEO / AEO Audit Report', size: 18, color: '475569', font: 'Arial' }),
            ],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.LEFT,
            border: { top: { color: 'E2E8F0', size: 6, style: BorderStyle.SINGLE, space: 120 } },
            children: [
              new TextRun({ text: 'Claude Skill and Plugin by Alex Labat', size: 18, color: '94A3B8', font: 'Arial' }),
              new TextRun({ text: ` \tPage `, size: 18, color: '94A3B8', font: 'Arial' }),
              new TextRun({ children: [PageNumber.CURRENT], size: 18, color: '94A3B8', font: 'Arial' }),
            ],
          })],
        }),
      },
      properties: {
        page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
      },
      children: mainChildren,
    }
  ]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(docxPath, buffer);
  console.log(`DOCX written to ${docxPath} (${buffer.length} bytes)`);

  // Generate simple PDF via jspdf as fallback (since soffice not available)
  try {
    const { jsPDF } = require('jspdf');
    const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(22);
    pdf.setTextColor(27,42,74);
    pdf.text(`${SITE_DOMAIN} — SEO / GEO / AEO Audit`, 40, 50);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100,116,139);
    pdf.text(`Full Audit • ${AUDIT_DATE} • Scores: SEO ${SCORES.seo}/10  GEO ${SCORES.geo}/10  AEO ${SCORES.aeo}/10 (Combined ${SCORES.seo+SCORES.geo+SCORES.aeo}/30)`, 40, 75);
    pdf.setFontSize(10);
    pdf.text('Full detailed findings, signal-by-signal analysis, and priority matrix are in the Word document.', 40, 95);
    pdf.text(`Docx: ${path.basename(docxPath)}`, 40, 115);
    pdf.text(`This PDF is a lightweight companion — the docx is the canonical premium report.`, 40, 135);
    // Add top priorities
    pdf.setFont('helvetica', 'bold');
    pdf.text('Top 3 Priorities:', 40, 165);
    pdf.setFont('helvetica', 'normal');
    pdf.text('1. Deploy missing discovery files (/llms-full.txt, /openapi.json, /docs/sitemap.md etc — currently 404)', 40, 185, { maxWidth: 530 });
    pdf.text('2. Fix canonical/domain split (archdraw.app vs hiabhee.online)', 40, 205, { maxWidth: 530 });
    pdf.text('3. Add FAQ/HowTo/Speakable schema to docs/guides for featured snippets', 40, 225, { maxWidth: 530 });
    pdf.text('Biggest Strength: llms.txt live + 11 factual-dense engineering blogs + clean 47-URL sitemap.', 40, 255, { maxWidth: 530 });
    pdf.save(pdfPath);
    console.log(`PDF written to ${pdfPath}`);
  } catch (e) {
    console.log('jsPDF fallback failed, copying docx as pdf placeholder', e.message);
    fs.copyFileSync(docxPath, pdfPath);
    console.log(`PDF placeholder written to ${pdfPath}`);
  }
});
