import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { BookOpen } from 'lucide-react';
import { LandingNav } from '@/components/landing/LandingNav';
import { Footer } from '@/components/landing/Footer';
import { CopyButton } from '@/components/agent-skill/CopyButton';

// Written in ASD-STE100 Simplified Technical English: short sentences, active voice,
// one instruction per step. Keep new copy on this page in the same style.

const PAGE_URL = 'https://archdraw.hiabhee.online/docs/connect-agents';
const REMOTE_URL = 'https://archdraw.hiabhee.online/api/mcp';
const API_BASE = 'https://archdraw.hiabhee.online';
// Keep in sync with the pin in plugins/archdraw/mcp.json.
const NPM_PACKAGE = '@hiabhee/archdraw-mcp-server@1.0.6';

export const metadata: Metadata = {
  title: 'Connect a Coding Agent | ArchDraw Docs',
  description:
    'Connect ArchDraw to Claude Code, the Claude apps, Codex, Cursor, VS Code, Gemini CLI, OpenCode, or another MCP client.',
  alternates: { canonical: PAGE_URL },
  openGraph: {
    type: 'article',
    url: PAGE_URL,
    title: 'Connect ArchDraw to a coding agent',
    description: 'Setup steps and verification for each MCP client.',
    images: [{ url: '/api/og/home', width: 1200, height: 630, alt: 'ArchDraw Documentation' }],
  },
};

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'TechArticle',
  headline: 'Connect ArchDraw to a coding agent',
  description: 'Setup steps and verification for each MCP client that can use ArchDraw.',
  url: PAGE_URL,
  inLanguage: 'en-US',
  articleSection: 'Documentation',
};

type Step = { text: ReactNode; code?: string };
type Notice = { kind: 'NOTE' | 'CAUTION' | 'WARNING'; text: ReactNode };
type Method = { title: string; steps: Step[]; after?: ReactNode; notice?: Notice };
type Client = { id: string; name: string; method: string; intro?: ReactNode; methods: Method[]; verify: Step[] };

const json = (value: unknown) => JSON.stringify(value, null, 2);

const LOCAL_ENTRY = { command: 'npx', args: ['-y', NPM_PACKAGE], env: { API_BASE_URL: API_BASE } };

const CLIENTS: Client[] = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    method: 'Plugin',
    methods: [
      {
        title: 'Install the plugin (recommended)',
        steps: [
          { text: 'Start Claude Code.' },
          { text: 'Type this command to add the marketplace:', code: '/plugin marketplace add hiabhee/ArchDraw' },
          { text: 'Type this command to install the plugin:', code: '/plugin install archdraw@archdraw' },
          { text: 'Restart Claude Code.' },
        ],
        after: (
          <>
            The plugin gives the MCP tools and the <code>archdraw</code> skill. It connects to the remote server. It does not
            install software on your computer.
          </>
        ),
      },
      {
        title: 'Add only the MCP server (alternative)',
        steps: [
          { text: 'Type this command in your shell:', code: `claude mcp add --transport http archdraw ${REMOTE_URL}` },
          { text: 'Restart Claude Code.' },
        ],
        after: (
          <>
            To make the server available in all projects, add <code>--scope user</code> before <code>archdraw</code>.
          </>
        ),
      },
    ],
    verify: [
      { text: 'Type this command in your shell:', code: 'claude mcp list' },
      { text: <>Make sure that <code>archdraw</code> shows as connected.</> },
      { text: <>In Claude Code, type <code>/mcp</code> to see the ArchDraw tools.</> },
    ],
  },
  {
    id: 'claude-apps',
    name: 'Claude apps',
    method: 'Custom connector',
    intro: 'This section applies to claude.ai, Claude Desktop, and Claude mobile. These apps connect to remote MCP servers through custom connectors.',
    methods: [
      {
        title: 'Add the custom connector (recommended)',
        steps: [
          { text: 'Open Claude on the web or in Claude Desktop.' },
          { text: <>Go to <strong>Settings → Connectors</strong>.</> },
          { text: <>Select <strong>Add custom connector</strong>.</> },
          { text: <>In the name field, type <code>ArchDraw</code>.</> },
          { text: 'In the URL field, type this address:', code: REMOTE_URL },
          { text: <>Select <strong>Add</strong>.</> },
        ],
        after: 'The connector is then available in Claude Desktop and Claude mobile with the same account.',
        notice: {
          kind: 'NOTE',
          text: 'The availability of custom connectors depends on your Claude plan. On Team and Enterprise plans, it is possible that an owner must add the connector for the organization first.',
        },
      },
      {
        title: 'Claude Desktop with a local server (alternative)',
        steps: [
          {
            text: (
              <>
                Open the configuration file. On macOS, the file is <code>~/Library/Application Support/Claude/claude_desktop_config.json</code>. On Windows, the file is <code>%APPDATA%\Claude\claude_desktop_config.json</code>.
              </>
            ),
          },
          { text: <>Add the <code>archdraw</code> entry to <code>mcpServers</code>:</>, code: json({ mcpServers: { archdraw: LOCAL_ENTRY } }) },
          { text: 'Save the file.' },
          { text: <>Fully quit Claude Desktop. On macOS, press <strong>Cmd+Q</strong>. Closing the window is not sufficient.</> },
          { text: 'Start Claude Desktop again.' },
        ],
        after: 'Use this procedure only if you cannot use a custom connector. You do not need to clone the ArchDraw repository or build the server.',
      },
    ],
    verify: [
      { text: 'Start a new chat.' },
      { text: <>Open the tools menu and make sure that <strong>ArchDraw</strong> is on.</> },
      { text: 'Type a request, for example: "Draw a checkout service with Stripe, Postgres, and a Kafka event bus."' },
    ],
  },
  {
    id: 'codex',
    name: 'Codex',
    method: 'Plugin',
    intro: 'This section applies to the Codex CLI, the IDE extension, and the desktop app.',
    methods: [
      {
        title: 'Install the plugin (recommended)',
        steps: [
          { text: 'Type these commands in your shell:', code: 'codex plugin marketplace add hiabhee/ArchDraw\ncodex plugin add archdraw@archdraw' },
          { text: 'Restart Codex.' },
        ],
        after: 'After you add the marketplace, you can also install the plugin from the Plugins Directory in the ChatGPT desktop app.',
        notice: {
          kind: 'NOTE',
          text: <>The Codex plugin uses the local connection. It runs <code>npx -y {NPM_PACKAGE}</code> on your computer. You must have Node.js 18 or later.</>,
        },
      },
      {
        title: 'Add only the MCP server (alternative)',
        steps: [
          { text: 'Type this command in your shell:', code: `codex mcp add archdraw --env API_BASE_URL=${API_BASE} -- npx -y ${NPM_PACKAGE}` },
          { text: 'Restart Codex.' },
        ],
        after: (
          <>
            This command writes the entry to <code>~/.codex/config.toml</code>. You can also write the entry yourself:
            <CodeBlock
              value={`[mcp_servers.archdraw]\ncommand = "npx"\nargs = ["-y", "${NPM_PACKAGE}"]\n\n[mcp_servers.archdraw.env]\nAPI_BASE_URL = "${API_BASE}"`}
            />
          </>
        ),
      },
    ],
    verify: [
      { text: 'Type this command in your shell:', code: 'codex mcp list' },
      { text: <>Make sure that <code>archdraw</code> is in the list.</> },
      { text: <>In the Codex TUI, type <code>/mcp</code> to see the ArchDraw tools.</> },
    ],
  },
  {
    id: 'cursor',
    name: 'Cursor',
    method: 'Remote (HTTP)',
    methods: [
      {
        title: 'Add the server',
        steps: [
          { text: <>Open <code>~/.cursor/mcp.json</code> for all projects, or <code>.cursor/mcp.json</code> in the project root for one project.</> },
          { text: <>Add the <code>archdraw</code> entry:</>, code: json({ mcpServers: { archdraw: { url: REMOTE_URL } } }) },
          { text: 'Save the file.' },
        ],
      },
    ],
    verify: [
      { text: <>Go to <strong>Cursor Settings → Tools &amp; MCP</strong>.</> },
      { text: <>Make sure that <strong>archdraw</strong> shows as connected and that it shows 12 tools.</> },
      { text: 'If you use the Cursor Agent CLI, type this command:', code: 'cursor-agent mcp list' },
    ],
  },
  {
    id: 'vscode',
    name: 'VS Code (GitHub Copilot)',
    method: 'Remote (HTTP)',
    methods: [
      {
        title: 'Add the server',
        steps: [
          { text: <>In the project root, open or make the file <code>.vscode/mcp.json</code>.</> },
          { text: <>Add the <code>archdraw</code> entry:</>, code: json({ servers: { archdraw: { type: 'http', url: REMOTE_URL } } }) },
          { text: 'Save the file.' },
          { text: <>In the editor, select <strong>Start</strong> above the <code>archdraw</code> entry.</> },
        ],
        notice: { kind: 'NOTE', text: <>VS Code uses the key <code>servers</code>, not <code>mcpServers</code>.</> },
      },
    ],
    verify: [
      { text: 'Open the Copilot Chat view.' },
      { text: <>Set the chat mode to <strong>Agent</strong>.</> },
      { text: 'Select the tools icon.' },
      { text: 'Make sure that the ArchDraw tools are in the list.' },
    ],
  },
  {
    id: 'gemini-cli',
    name: 'Gemini CLI',
    method: 'Remote (HTTP)',
    methods: [
      {
        title: 'Add the server',
        steps: [
          { text: <>Open <code>~/.gemini/settings.json</code> for all projects, or <code>.gemini/settings.json</code> in the project root for one project.</> },
          { text: <>Add the <code>archdraw</code> entry:</>, code: json({ mcpServers: { archdraw: { httpUrl: REMOTE_URL } } }) },
          { text: 'Save the file.' },
          { text: 'Restart Gemini CLI.' },
        ],
        notice: {
          kind: 'NOTE',
          text: <>Gemini CLI uses the key <code>httpUrl</code> for Streamable HTTP servers. The key <code>url</code> is for SSE servers. Do not use <code>url</code> for ArchDraw.</>,
        },
      },
    ],
    verify: [
      { text: <>In Gemini CLI, type <code>/mcp</code>.</> },
      { text: <>Make sure that <strong>archdraw</strong> shows as ready and shows its tools.</> },
    ],
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    method: 'Remote (HTTP)',
    methods: [
      {
        title: 'OpenCode v1',
        steps: [
          { text: <>Open <code>~/.config/opencode/opencode.json</code> for all projects, or <code>opencode.json</code> in the project root for one project.</> },
          {
            text: <>Add the <code>archdraw</code> entry under <code>mcp</code>:</>,
            code: json({ $schema: 'https://opencode.ai/config.json', mcp: { archdraw: { type: 'remote', url: REMOTE_URL, enabled: true } } }),
          },
          { text: 'Save the file.' },
          { text: 'Restart OpenCode.' },
        ],
        notice: {
          kind: 'NOTE',
          text: <>This format is for OpenCode v1. OpenCode v2 does not put server names directly under <code>mcp</code>. If you use v2, use the procedure that follows.</>,
        },
      },
      {
        title: 'OpenCode v2',
        steps: [
          { text: <>Open <code>opencode.jsonc</code> in the project root. To make the server available in all projects, use the global configuration.</> },
          {
            text: <>Add the <code>archdraw</code> entry under <code>mcp.servers</code>:</>,
            code: json({ mcp: { servers: { archdraw: { type: 'remote', url: REMOTE_URL } } } }),
          },
          { text: 'Save the file.' },
          { text: 'Restart OpenCode.' },
        ],
        after: (
          <>
            In v2, a server is on by default. To stop it, set <code>&quot;disabled&quot;: true</code>. The v1 key <code>enabled</code> does not apply.
          </>
        ),
      },
    ],
    verify: [
      { text: 'Type this command in your shell:', code: 'opencode mcp list' },
      { text: <>Make sure that <code>archdraw</code> shows as connected.</> },
    ],
  },
];

const TOOLS = [
  { name: 'read_me', desc: 'Gives the reference guide for the agent. The agent calls it first.' },
  { name: 'generate_diagram', desc: 'Makes a diagram from Mermaid text or from nodes and edges.' },
  { name: 'update_diagram', desc: 'Adds, removes, or changes nodes and edges in the current diagram.' },
  { name: 'get_diagram_state', desc: 'Gives the nodes and edges of the current diagram.' },
  { name: 'validate_diagram', desc: 'Finds structural problems and gives recommendations.' },
  { name: 'fix_layout', desc: 'Calculates the layout again with the ArchDraw editor pipeline (Mermaid → Dagre).' },
  { name: 'apply_template', desc: 'Loads an architecture template.' },
  { name: 'list_templates', desc: 'Gives the list of templates.' },
  { name: 'list_node_types', desc: 'Gives the list of component types in the ArchDraw library.' },
  { name: 'save_checkpoint', desc: 'Saves the current diagram with a name.' },
  { name: 'load_checkpoint', desc: 'Restores a saved diagram.' },
  { name: 'export_diagram', desc: 'Exports the diagram as JSON, PNG, or SVG.' },
];

const LIMITS = [
  ['Requests to /api/mcp', '120 for each minute, for each IP address'],
  ['Request body size', '1 MB'],
  ['New published diagrams', '30 for each hour (anonymous)'],
  ['Preview link life', '7 days'],
  ['Working session life (remote)', '24 hours'],
];

const TROUBLESHOOTING: Array<[ReactNode, ReactNode, ReactNode]> = [
  ['The agent does not show the ArchDraw tools.', 'The agent did not load the new configuration.', 'Fully stop the agent and start it again.'],
  ['The agent does not show the ArchDraw tools.', 'The configuration has a JSON or TOML syntax error.', 'Examine the file for missing commas, brackets, or quotes.'],
  [
    'The agent does not show the ArchDraw tools.',
    'The configuration uses the wrong key for the client.',
    <>Use the key that this page gives for your client: <code>url</code>, <code>httpUrl</code>, or <code>servers</code>.</>,
  ],
  ['The local server does not start.', 'Node.js is not installed, or the version is older than 18.', <>Install Node.js 18 or later. Type <code>node --version</code> to examine the version.</>],
  ['The local server does not start.', <>The client cannot find <code>npx</code>.</>, <>Replace <code>npx</code> with its full path. Type <code>which npx</code> (macOS, Linux) or <code>where npx</code> (Windows) to find the path.</>],
  [
    <>The tools show, but <code>generate_diagram</code> fails with &quot;requires API_BASE_URL&quot;.</>,
    <>The local configuration does not set <code>API_BASE_URL</code>.</>,
    <>Add <code>API_BASE_URL={API_BASE}</code> to the environment of the server.</>,
  ],
  [
    'The tools show, but there is no preview link.',
    <>The agent set <code>publish: false</code>, or the publish operation failed.</>,
    <>Tell the agent to publish the diagram. If the response has <code>linkError</code>, read the error and try again later.</>,
  ],
  ['The server gives HTTP 429.', 'You are above a rate limit.', 'Wait some minutes. Then try again.'],
  ['The connection fails with HTTP 405.', 'The client uses SSE or GET.', 'Set the transport to Streamable HTTP.'],
  ['The agent has the tools, but it does not use them.', 'The agent does not have the skill.', <>Install the skill (<a href="#skill">Install the skill</a>). Or tell the agent: &quot;Use the ArchDraw tools to draw this system.&quot;</>],
];

const NAV_GROUPS = [
  { label: 'Before you start', links: [{ href: '#connection-type', label: 'Connection type' }, { href: '#requirements', label: 'Requirements' }] },
  { label: 'Clients', links: [...CLIENTS.map((c) => ({ href: `#${c.id}`, label: c.name })), { href: '#other-clients', label: 'Other MCP clients' }] },
  { label: 'Use ArchDraw', links: [{ href: '#skill', label: 'Install the skill' }, { href: '#first-diagram', label: 'First diagram' }, { href: '#tools', label: 'Tools' }] },
  {
    label: 'Reference',
    links: [
      { href: '#privacy', label: 'Data and privacy' },
      { href: '#limits', label: 'Limits' },
      { href: '#troubleshooting', label: 'Troubleshooting' },
      { href: '#self-hosted', label: 'Self-hosted ArchDraw' },
    ],
  },
];

// Inline code only — `pre > code` blocks keep their own styling.
const CODE_INLINE = '[&_:not(pre)>code]:rounded [&_:not(pre)>code]:bg-[#eef1ec] [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:font-mono [&_:not(pre)>code]:text-[0.85em] [&_:not(pre)>code]:text-[#16211f]';

function CodeBlock({ value }: { value: string }) {
  return (
    <div className="relative mt-3 rounded-xl border border-[#dfe4df] bg-[#f6f7f3]">
      <div className="absolute right-2 top-2">
        <CopyButton value={value} className="border-[#dfe4df] bg-white text-[#51605a] hover:bg-[#eef1ec]" />
      </div>
      <pre className="overflow-x-auto py-3.5 pl-4 pr-24 font-mono text-xs leading-6 text-[#283731]"><code>{value}</code></pre>
    </div>
  );
}

function NoticeBox({ kind, text }: Notice) {
  const tone =
    kind === 'WARNING'
      ? 'border-[#f2c9c4] bg-[#fdf2f1] text-[#7a2e26]'
      : kind === 'CAUTION'
        ? 'border-[#f0dcb0] bg-[#fdf8ec] text-[#6b4f12]'
        : 'border-[#cfe5f7] bg-[#f1f8ff] text-[#38617d]';
  return (
    <div className={`mt-5 rounded-xl border p-4 text-sm leading-6 ${tone}`}>
      <strong>{kind}:</strong> {text}
    </div>
  );
}

function Steps({ steps }: { steps: Step[] }) {
  return (
    <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 text-[#51605a] marker:font-semibold marker:text-[#16211f]">
      {steps.map((step, i) => (
        <li key={i} className="pl-1">
          {step.text}
          {step.code && <CodeBlock value={step.code} />}
        </li>
      ))}
    </ol>
  );
}

function Section({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="mt-16 scroll-mt-24 border-t border-[#dfe4df] pt-12">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[.12em] text-[#4786bf]">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-[-.04em]">{title}</h2>
      {children}
    </section>
  );
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="mt-6 overflow-x-auto rounded-xl border border-[#dfe4df] bg-white">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-[#dfe4df] bg-[#f6f7f3] font-mono text-[10px] uppercase tracking-[.1em] text-[#65706c]">
          <tr>{head.map((h) => <th key={h} className="px-4 py-3 font-bold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-[#dfe4df] text-[#51605a]">
          {rows.map((row, i) => (
            <tr key={i}>{row.map((cell, j) => <td key={j} className={`px-4 py-3 align-top leading-5 ${j === 0 ? 'font-semibold text-[#16211f]' : ''}`}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const P = 'mt-4 text-[15px] leading-7 text-[#51605a]';

export default function ConnectAgentsPage() {
  return (
    <div className="min-h-screen bg-[#fbfcfa] text-[#16211f]">
      <LandingNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />

      <main className="mx-auto w-full max-w-[1400px] px-5 pb-20 pt-20 sm:px-8">
        <div className="grid gap-10 py-10 lg:grid-cols-[220px_minmax(0,720px)_180px] lg:gap-14">
          <aside className="hidden lg:block">
            <nav className="sticky top-20 max-h-[calc(100vh-6rem)] space-y-7 overflow-y-auto pb-6" aria-label="Documentation navigation">
              <Link href="/docs" className="mb-6 flex items-center gap-2 text-sm font-bold tracking-tight text-[#16211f]"><BookOpen size={16} className="text-[#1686f5]" /> Docs home</Link>
              {NAV_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="mb-2 px-3 font-mono text-[10px] font-bold uppercase tracking-[.13em] text-[#8b9691]">{group.label}</p>
                  <div className="space-y-0.5">
                    {group.links.map((link) => <a key={link.href} href={link.href} className="block rounded-md px-3 py-1.5 text-sm text-[#65706c] transition-colors hover:bg-white hover:text-[#16211f]">{link.label}</a>)}
                  </div>
                </div>
              ))}
            </nav>
          </aside>

          <article className={`min-w-0 ${CODE_INLINE}`}>
            <p className="font-mono text-[11px] font-bold uppercase tracking-[.12em] text-[#4786bf]">
              <Link href="/docs" className="hover:underline">Docs</Link> / Connect a coding agent
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-.04em]">Connect ArchDraw to a coding agent.</h1>
            <p className={P}>
              This page tells you how to connect ArchDraw to an AI coding agent or a chat client. When the connection is complete, the agent can make, change, validate, and export architecture diagrams.
            </p>

            <Table
              head={['Client', 'Recommended method']}
              rows={[...CLIENTS.map((c) => [<a key={c.id} href={`#${c.id}`} className="text-[#075aaf] underline underline-offset-2">{c.name}</a>, c.method]), [<a key="other" href="#other-clients" className="text-[#075aaf] underline underline-offset-2">Other MCP clients</a>, 'Remote or local']]}
            />

            <Section id="connection-type" eyebrow="Before you start" title="Select a connection type.">
              <p className={P}>ArchDraw has two connection types. Both types give the same 12 tools. Use the remote connection if your client supports it. Use the local connection only if the client cannot connect to a remote server.</p>
              <Table
                head={['Connection type', 'Address or command', 'Use it when']}
                rows={[
                  ['Remote (HTTP)', <code key="r">{REMOTE_URL}</code>, 'The client can connect to a remote MCP server. This is the recommended type. You do not install software.'],
                  ['Local (stdio)', <code key="l">npx -y {NPM_PACKAGE}</code>, 'The client can only start a local process.'],
                ]}
              />
            </Section>

            <section id="requirements" className="mt-12 scroll-mt-24">
              <h3 className="text-xl font-semibold tracking-[-.02em]">Requirements</h3>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-[#51605a]">
                <li>Network access to <code>archdraw.hiabhee.online</code>. This is necessary for the two connection types.</li>
                <li>For the local connection only: Node.js 18 or later. To examine your version, type <code>node --version</code>.</li>
                <li>You do not need an ArchDraw account or an API key.</li>
              </ul>
              <NoticeBox
                kind="CAUTION"
                text={<>For the local connection, you must set <code>API_BASE_URL={API_BASE}</code>. If you do not set it, the server starts and shows its tools, but <code>generate_diagram</code>, <code>fix_layout</code>, and preview links do not operate.</>}
              />
              <NoticeBox kind="NOTE" text={<>Each local procedure on this page pins version <code>{NPM_PACKAGE.split('@').pop()}</code>. A pinned version does not change without your action. To update, change the version number in your configuration.</>} />
            </section>

            {CLIENTS.map((client) => (
              <Section key={client.id} id={client.id} eyebrow={client.method} title={client.name}>
                {client.intro && <p className={P}>{client.intro}</p>}
                {client.methods.map((method) => (
                  <div key={method.title} className="mt-8">
                    <h3 className="text-lg font-semibold tracking-[-.02em]">{method.title}</h3>
                    <Steps steps={method.steps} />
                    {method.after && <div className="mt-4 text-sm leading-6 text-[#51605a]">{method.after}</div>}
                    {method.notice && <NoticeBox {...method.notice} />}
                  </div>
                ))}
                <div className="mt-8 rounded-xl border border-[#dfe4df] bg-white p-5">
                  <h3 className="text-sm font-bold">Verify the connection</h3>
                  <Steps steps={client.verify} />
                </div>
              </Section>
            ))}

            <Section id="other-clients" eyebrow="Other MCP clients" title="Use the generic values.">
              <p className={P}>Many other clients support MCP, for example Zed, Cline, and Antigravity. Each client has a different configuration format. Refer to the documentation of your client. Use the values in this section.</p>
              <h3 className="mt-8 text-lg font-semibold tracking-[-.02em]">Remote (HTTP) values</h3>
              <Table head={['Field', 'Value']} rows={[['Name', <code key="n">archdraw</code>], ['Transport', 'Streamable HTTP'], ['URL', <code key="u">{REMOTE_URL}</code>], ['Authentication', 'None']]} />
              <NoticeBox kind="NOTE" text="The remote server does not support SSE or GET requests. If your client asks for a transport, select Streamable HTTP." />
              <h3 className="mt-8 text-lg font-semibold tracking-[-.02em]">Local (stdio) values</h3>
              <Table
                head={['Field', 'Value']}
                rows={[['Name', <code key="n">archdraw</code>], ['Command', <code key="c">npx</code>], ['Arguments', <><code>-y</code>, <code>{NPM_PACKAGE}</code></>], ['Environment variable', <code key="e">API_BASE_URL={API_BASE}</code>]]}
              />
            </Section>

            <Section id="skill" eyebrow="Use ArchDraw" title="Install the ArchDraw skill (optional).">
              <p className={P}>The Claude Code and Codex plugins include the skill. For other agents, you can install the skill separately. The skill tells the agent when to use ArchDraw, to send Mermaid input, and to show the preview link.</p>
              <Steps
                steps={[
                  { text: 'Go to the root of your project.' },
                  { text: 'Type this command:', code: 'npx skills add hiabhee/archdraw-skill --skill archdraw-diagram' },
                  { text: 'When the CLI asks, select your agent.' },
                ]}
              />
              <p className="mt-4 text-sm leading-6 text-[#51605a]">To install the skill for all projects, add <code>-g</code> to the command. To update the skill, type <code>npx skills update archdraw-diagram</code>.</p>
            </Section>

            <section id="first-diagram" className="mt-12 scroll-mt-24">
              <h3 className="text-xl font-semibold tracking-[-.02em]">Make your first diagram</h3>
              <p className="mt-4 text-sm leading-6 text-[#51605a]">Type a request to your agent. For example:</p>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-[#51605a]">
                <li>&quot;Inspect this repository and draw its architecture. Use evidence from the code. Mark the parts that are not certain.&quot;</li>
                <li>&quot;Draw a web client, an API gateway, a Node API, and a Postgres database.&quot;</li>
                <li>&quot;Add a Redis cache between the API and Postgres.&quot;</li>
                <li>&quot;Change the layout to top-down.&quot;</li>
              </ul>
              <p className="mt-4 text-sm leading-6 text-[#51605a]">The agent replies with two links. <strong>shareUrl</strong> is a read-only preview. Anyone with the link can see it. <strong>diagramUrl</strong> opens the diagram in the ArchDraw editor.</p>
            </section>

            <section id="tools" className="mt-12 scroll-mt-24">
              <h3 className="text-xl font-semibold tracking-[-.02em]">Tools</h3>
              <Table head={['Tool', 'Function']} rows={TOOLS.map((t) => [<code key={t.name}>{t.name}</code>, t.desc])} />
            </section>

            <Section id="privacy" eyebrow="Reference" title="Data and privacy.">
              <p className={P}>Read this section before you connect ArchDraw.</p>
              <ul className="mt-4 list-disc space-y-3 pl-5 text-sm leading-6 text-[#51605a]">
                <li><strong className="text-[#16211f]">Data that the tools send:</strong> The tools send the diagram content that the agent gives them. This includes component names, labels, connections, and Mermaid text. The tools do not read your source files. Your agent reads your files and decides what to put in the diagram.</li>
                <li><strong className="text-[#16211f]">Preview links:</strong> Each new diagram gets a preview link by default. Anyone with the link can see the diagram. The link expires after 7 days. To prevent a link, tell the agent to keep the diagram private. The agent then sets <code>publish: false</code>.</li>
                <li><strong className="text-[#16211f]">Working sessions:</strong> The remote server keeps the current diagram and its checkpoints for 24 hours. Then it deletes them. The local server keeps them in memory until the process stops.</li>
                <li><strong className="text-[#16211f]">IP address:</strong> The server uses your IP address only for rate limits.</li>
              </ul>
              <NoticeBox kind="WARNING" text="Do not put passwords, API keys, or other secrets in diagram labels. Anyone with the preview link can see the labels." />
              <p className="mt-4 text-sm leading-6 text-[#51605a]">Refer to the <Link href="/privacy" className="font-semibold text-[#075aaf] underline underline-offset-2">privacy policy</Link> and the <Link href="/terms" className="font-semibold text-[#075aaf] underline underline-offset-2">terms</Link>.</p>
            </Section>

            <section id="limits" className="mt-12 scroll-mt-24">
              <h3 className="text-xl font-semibold tracking-[-.02em]">Limits</h3>
              <Table head={['Limit', 'Value']} rows={LIMITS} />
            </section>

            <Section id="troubleshooting" eyebrow="Reference" title="Troubleshooting.">
              <Table head={['Problem', 'Possible cause', 'Corrective action']} rows={TROUBLESHOOTING} />
              <p className="mt-4 text-sm leading-6 text-[#51605a]">To report a problem, open an issue on <a href="https://github.com/hiabhee/ArchDraw/issues" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#075aaf] underline underline-offset-2">GitHub</a>.</p>
            </Section>

            <Section id="self-hosted" eyebrow="Reference" title="Self-hosted ArchDraw.">
              <p className={P}>You can connect the tools to your own ArchDraw deployment.</p>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-[#51605a]">
                <li><strong className="text-[#16211f]">Remote connection:</strong> Use <code>https://&lt;your-domain&gt;/api/mcp</code> as the URL.</li>
                <li><strong className="text-[#16211f]">Local connection:</strong> Set <code>API_BASE_URL</code> to <code>https://&lt;your-domain&gt;</code>.</li>
                <li><strong className="text-[#16211f]">Claude Code plugin:</strong> Change the <code>url</code> in <code>plugins/archdraw/.mcp.json</code>.</li>
                <li><strong className="text-[#16211f]">Codex plugin:</strong> Change <code>API_BASE_URL</code> in <code>plugins/archdraw/mcp.json</code>.</li>
              </ul>
            </Section>
          </article>

          <aside className="hidden xl:block">
            <div className="sticky top-20 border-l border-[#dfe4df] pl-5">
              <p className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[.13em] text-[#8b9691]">On this page</p>
              <div className="space-y-2 text-xs">
                {[['#connection-type', 'Connection type'], ['#claude-code', 'Clients'], ['#skill', 'Skill'], ['#tools', 'Tools'], ['#privacy', 'Privacy'], ['#troubleshooting', 'Troubleshooting']].map(([href, label]) => (
                  <a key={href} className="block text-[#65706c] hover:text-[#075aaf]" href={href}>{label}</a>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}
