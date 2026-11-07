/**
 * Comparison pages (`/alternatives`, `/alternatives/<slug>`). Claims about other products
 * stay to stable, public facts (open source or not, focus, free tier exists, AI features
 * exist); prices and quotas change often and are left out, with a link to their pricing.
 * Keep `checkedOn` current when an entry is reviewed, and each page says when it was.
 */

export interface ComparisonRow {
  feature: string;
  archdraw: string;
  them: string;
}

export interface Alternative {
  slug: string;
  /** The product compared, as its makers write it. */
  name: string;
  pricingUrl: string;
  /** Meta description (≤ 160 characters). */
  summary: string;
  about: string[];
  theirStrengths: string[];
  archdrawDifferences: string[];
  chooseThem: string[];
  chooseArchDraw: string[];
  rows: ComparisonRow[];
  faq: Array<{ question: string; answer: string }>;
  checkedOn: string;
}

export const ALTERNATIVES: Alternative[] = [
  {
    slug: 'eraser',
    name: 'Eraser',
    pricingUrl: 'https://www.eraser.io/pricing',
    summary: 'ArchDraw vs Eraser for architecture diagrams: AI generation, diagrams from GitHub repos, Mermaid, and live maps of Claude Code sessions. An honest comparison.',
    about: [
      'Eraser is a workspace for engineering teams that combines docs, a whiteboard and diagrams. It has its own diagram-as-code syntax and an AI feature, DiagramGPT, that turns a description into a diagram.',
      'ArchDraw is built only for software architecture diagrams. It generates them from a prompt or a GitHub repository, edits them on a canvas or as Mermaid, and can show a live map of the Claude Code sessions working on your codebase.',
    ],
    theirStrengths: [
      'Docs and diagrams in one place, useful for design documents and RFCs.',
      'A mature diagram-as-code language and editor.',
      'Integrations with tools engineering teams already use.',
    ],
    archdrawDifferences: [
      'Diagrams from a GitHub repository: ArchDraw reads the repo\'s architecture files and code and draws the system.',
      'Mermaid in and out: paste Mermaid or edit the diagram as Mermaid next to the canvas.',
      'An MCP server, so Claude and other AI agents can draw and update diagrams for you.',
      'Live projects: one command maps your repository and shows each Claude Code session on it as it works.',
      'Open source, with free system design tutorials and architecture diagram templates.',
    ],
    chooseThem: [
      'You want design docs and diagrams in one shared workspace.',
      'Your team already writes diagrams in Eraser\'s syntax.',
    ],
    chooseArchDraw: [
      'You want an architecture diagram of an existing codebase without drawing it.',
      'You work with Mermaid, or want AI agents such as Claude to draw diagrams for you.',
      'You run several Claude Code sessions and want to see where each one is working.',
    ],
    rows: [
      { feature: 'Main focus', archdraw: 'Software architecture diagrams', them: 'Engineering docs, whiteboard and diagrams' },
      { feature: 'AI from a text prompt', archdraw: 'Yes', them: 'Yes (DiagramGPT)' },
      { feature: 'Diagrams as code', archdraw: 'Mermaid (import, export, live code panel)', them: 'Eraser\'s own diagram-as-code syntax' },
      { feature: 'Open source', archdraw: 'Yes', them: 'No' },
      { feature: 'Free to start', archdraw: 'Yes, free during the beta', them: 'Free plan with limits' },
    ],
    faq: [
      { question: 'Is ArchDraw a free alternative to Eraser?', answer: 'ArchDraw is free during its public beta. You can generate diagrams without an account and sign in with Google or GitHub to save, share and export SVG.' },
      { question: 'Can ArchDraw import Eraser diagrams?', answer: 'Not directly. ArchDraw imports Mermaid and its own JSON, so a diagram can be moved by exporting it from Eraser in a format you can convert to Mermaid, or by describing it to ArchDraw\'s AI.' },
    ],
    checkedOn: '2026-11-07',
  },
  {
    slug: 'drawio',
    name: 'draw.io',
    pricingUrl: 'https://www.drawio.com/',
    summary: 'ArchDraw vs draw.io (diagrams.net) for software architecture diagrams: AI generation, GitHub repos to diagrams, Mermaid and automatic layout compared.',
    about: [
      'draw.io (also known as diagrams.net) is a free, open-source, general-purpose diagramming tool with large shape libraries, a desktop app and integrations with Confluence, Jira and cloud drives. It has added AI generation (the Generate tool) and an MCP server.',
      'ArchDraw is focused on software architecture. It generates diagrams from a prompt, a GitHub repository or Mermaid, lays them out automatically, and keeps them editable on a canvas.',
    ],
    theirStrengths: [
      'Free and open source, with no account required and files stored where you choose.',
      'Huge shape libraries for every kind of diagram: network, UML, BPMN, floor plans and more.',
      'Precise manual control over every shape and connector.',
      'Deep Confluence and Jira integration.',
    ],
    archdrawDifferences: [
      'Automatic, consistent layout: diagrams are laid out for you, so a generated or edited diagram stays tidy.',
      'Diagrams from a GitHub repository, built from the repo\'s architecture files and code.',
      'Purpose-built architecture components and styles instead of a general shape library.',
      'Live maps of Claude Code sessions on your codebase.',
    ],
    chooseThem: [
      'You need many diagram types beyond software architecture.',
      'You want full manual control over every shape and pixel.',
      'Your team lives in Confluence and Jira.',
    ],
    chooseArchDraw: [
      'You want a clean architecture diagram quickly, from a prompt or a repository.',
      'You prefer automatic layout to placing every box by hand.',
      'You work with Mermaid or with AI coding agents.',
    ],
    rows: [
      { feature: 'Main focus', archdraw: 'Software architecture diagrams', them: 'General-purpose diagramming' },
      { feature: 'AI from a text prompt', archdraw: 'Yes', them: 'Yes (Generate tool)' },
      { feature: 'Layout', archdraw: 'Automatic', them: 'Mostly manual, with layout helpers' },
      { feature: 'Mermaid', archdraw: 'Import, export and live code panel', them: 'Mermaid import' },
      { feature: 'Open source', archdraw: 'Yes', them: 'Yes' },
      { feature: 'Free', archdraw: 'Yes, free during the beta', them: 'Yes' },
    ],
    faq: [
      { question: 'Is ArchDraw better than draw.io?', answer: 'For software architecture diagrams generated from a description or a codebase, ArchDraw is faster because it creates and lays out the diagram for you. For other diagram types or pixel-level manual control, draw.io is the more general tool.' },
      { question: 'Can I use draw.io and ArchDraw together?', answer: 'Yes. Generate the architecture in ArchDraw and export it as SVG or PNG to place in draw.io, Confluence or your docs.' },
    ],
    checkedOn: '2026-11-07',
  },
  {
    slug: 'lucidchart',
    name: 'Lucidchart',
    pricingUrl: 'https://www.lucidchart.com/pages/pricing',
    summary: 'ArchDraw vs Lucidchart for software architecture diagrams: AI generation, diagrams from GitHub repos, Mermaid and pricing approach compared.',
    about: [
      'Lucidchart is a commercial, collaborative diagramming platform used across many teams for flowcharts, org charts, process maps, UML and cloud architecture. It includes AI features (Lucid AI) and enterprise administration.',
      'ArchDraw is a focused, open-source tool for software architecture diagrams: it generates them from a prompt or a GitHub repository and keeps them editable as a canvas or as Mermaid.',
    ],
    theirStrengths: [
      'One tool for every team and diagram type across a company.',
      'Real-time collaboration with comments and enterprise controls.',
      'Cloud architecture shape libraries for AWS, Azure and Google Cloud.',
    ],
    archdrawDifferences: [
      'Built for software engineers: diagrams from a prompt, a GitHub repository or Mermaid.',
      'An MCP server so Claude and other AI agents can draw diagrams for you.',
      'Live maps of Claude Code sessions on your codebase.',
      'Open source and free during the beta.',
    ],
    chooseThem: [
      'Your whole company standardises on one diagramming tool for many diagram types.',
      'You need enterprise administration, SSO and compliance features.',
    ],
    chooseArchDraw: [
      'You are a developer who wants an architecture diagram without drawing it.',
      'You want diagrams from code and Mermaid, or drawn by AI agents.',
      'You want an open-source tool you can try for free right now.',
    ],
    rows: [
      { feature: 'Main focus', archdraw: 'Software architecture diagrams', them: 'Diagramming for every team' },
      { feature: 'AI from a text prompt', archdraw: 'Yes', them: 'Yes (Lucid AI)' },
      { feature: 'Open source', archdraw: 'Yes', them: 'No' },
      { feature: 'Free to start', archdraw: 'Yes, free during the beta', them: 'Free plan with a small number of documents' },
    ],
    faq: [
      { question: 'Is there a free Lucidchart alternative for architecture diagrams?', answer: 'Yes. ArchDraw is free during its beta and focused on software architecture: describe a system or paste a GitHub repository and it draws an editable diagram.' },
      { question: 'Can I export ArchDraw diagrams to use elsewhere?', answer: 'Yes. Export PNG and JSON without an account and SVG when signed in, or copy the diagram as Mermaid from the code panel, to use in docs, slides or other tools.' },
    ],
    checkedOn: '2026-11-07',
  },
];

export function getAlternative(slug: string): Alternative | undefined {
  return ALTERNATIVES.find((a) => a.slug === slug);
}
