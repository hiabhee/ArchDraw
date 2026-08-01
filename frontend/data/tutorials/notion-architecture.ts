import { defineTutorial, level, step } from '@/lib/tutorial/builder';

const notionTutorial = defineTutorial({
  id: 'notion-architecture',
  title: 'How to Design Notion Architecture',
  description: 'Build the all-in-one workspace used by millions. Learn about block-based storage, real-time collaboration, and rich text editing.',
  difficulty: 'intermediate',
  estimatedMinutes: 50,
  tags: ['collaboration', 'productivity', 'real-time'],
  icon: 'FileText',
  color: '#000000',

  levels: [
    level({
      title: 'Workspace Foundation',
      steps: [
        step({
          component: 'Web Client',
          nodeType: 'client_web',
          noConnect: true,
          phases: {
            context: { heading: 'Welcome to Notion Architecture', body: 'Notion is a block-based workspace where every paragraph, heading, image, and database is an atomic "block." This architecture must handle real-time collaboration where 10+ users edit the same page simultaneously.' },
            intro: { heading: 'About the Web Client', body: 'The Notion web client is a rich text editor that renders blocks, handles drag-and-drop, and maintains real-time sync via WebSocket.' },
            teaching: { heading: 'Deep dive: Web Client', body: 'Notion\'s client uses a block-based editor where every piece of content (paragraph, heading, image, toggle, database) is a separate block with a unique ID. When you type, the client sends incremental diffs (not full page snapshots) to the server, reducing bandwidth by 90%. The client also handles offline mode — changes are queued locally and synced when connectivity returns. Without block-based editing, collaborative editing would require locking entire pages, preventing parallel work.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Web Client', and add the Web Client." },
            connecting: { heading: 'Connect it up', body: 'First step — no connections yet.' },
            celebration: { heading: 'Great job!', body: 'Web Client added.' },
          },
            hints: ['Search for "Web Client"'],
        }),
        step({
          component: 'API Gateway',
          nodeType: 'api_gateway',
          parent: 'Web Client',
          phases: {
            context: { heading: 'Step 2: API Gateway', body: 'Every Notion operation — create block, move block, edit text, add comment — routes through the API Gateway.' },
            intro: { heading: 'About API Gateways', body: 'API gateways provide a unified entry point for all client operations, handling authentication and request routing.' },
            teaching: { heading: 'Deep dive: API Gateway', body: 'Notion\'s API Gateway authenticates user sessions, routes block operations to the Block Service, and manages WebSocket connections for real-time sync. It must handle burst traffic — when a user pastes 100 blocks at once, the gateway batches them into a single API call instead of sending 100 separate requests. Without this batching, pasting large content would create a thundering herd of requests that overwhelms the backend.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'API Gateway', and add it." },
            connecting: { heading: 'Connect it up', body: 'Connect Web Client \u2192 API Gateway.' },
            celebration: { heading: 'Great job!', body: 'API Gateway added.' },
          },
          hints: ['Search for "API Gateway"', 'Connect Web Client to it'],
        }),
        step({
          component: 'Block Service',
          nodeType: 'block_service',
          parent: 'API Gateway',
          phases: {
            context: { heading: 'Step 3: Block Service', body: 'The Block Service is Notion\'s core engine — it manages the creation, editing, deletion, and movement of every block in the system.' },
            intro: { heading: 'About Block Services', body: 'Block services manage individual content units (paragraphs, headings, images, databases) with operations like create, update, move, and delete.' },
            teaching: { heading: 'Deep dive: Block Service', body: 'In Notion, a page is a tree of blocks. When you type a paragraph, you are editing a block with type "paragraph" and content "Hello world." The Block Service stores each block as an independent entity with a parent block ID, position index, and type-specific data. This enables powerful operations: drag a block from one page to another (just change its parent ID), convert a paragraph to a heading (just change its type), or nest toggles infinitely. Without independent blocks, these operations would require rewriting entire page documents.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Block Service', and add the Block Service." },
            connecting: { heading: 'Connect it up', body: 'Connect API Gateway \u2192 Block Service.' },
            celebration: { heading: 'Great job!', body: 'Block Service added.' },
          },
          hints: ['Search for "Block Service"', 'Connect API Gateway to it'],
        }),
      ],
    }),
    level({
      title: 'Production Ready',
      steps: [
        step({
          component: 'Database',
          nodeType: 'sql_db',
          parent: 'Block Service',
          phases: {
            context: { heading: 'Level 2: Database', body: 'Notion databases are tables where each row is a page and each column is a block property. They support filtering, sorting, and multiple views (table, board, timeline, calendar).' },
            intro: { heading: 'About Databases', body: 'Databases store structured block data with properties, enabling filtering, sorting, and relational queries across pages.' },
            teaching: { heading: 'Deep dive: Database', body: 'Notion\'s Database stores blocks organized as pages with typed properties (text, number, date, select, multi-select, person). Each database supports unlimited views — the same data displayed as a table, Kanban board, timeline, or calendar. The database must handle relations between pages (linking a task to a project), rollups (aggregating task counts per project), and formula properties. Without a dedicated database layer, Notion could not support its most popular feature: databases that function like Airtable.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Database', and add the Database." },
            connecting: { heading: 'Connect it up', body: 'Connect Block Service \u2192 Database.' },
            celebration: { heading: 'Great job!', body: 'Database added.' },
          },
          hints: ['Search for "Database"', 'Connect Block Service to it'],
        }),
      ],
    }),
    level({
      title: 'Expert Architecture',
      steps: [
        step({
          component: 'Real-time Service',
          nodeType: 'crdt_engine',
          parent: 'API Gateway',
          phases: {
            context: { heading: 'Level 3: Real-time Service', body: 'Notion\'s Real-time Service enables 10+ users to edit the same page simultaneously using Operational Transformation (OT) to merge concurrent edits.' },
            intro: { heading: 'About Real-time Services', body: 'Real-time services synchronize concurrent edits across multiple users using OT or CRDT algorithms.' },
            teaching: { heading: 'Deep dive: Real-time Service', body: 'Notion uses Operational Transformation (OT) to merge concurrent edits. When two users type in the same paragraph simultaneously, OT transforms both operations so they can be applied in any order and produce the same result. The Real-time Service manages WebSocket connections for each active page, broadcasts cursor positions (so you can see where collaborators are typing), and handles conflict resolution when two users try to delete the same block. Without OT, collaborative editing would require "locking" the page — only one person could edit at a time.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Real-time Service', and add the Real-time Service." },
            connecting: { heading: 'Connect it up', body: 'Connect API Gateway \u2192 Real-time Service.' },
            celebration: { heading: 'Great job!', body: 'Real-time Service added. Your Notion architecture is complete!' },
          },
          hints: ['Search for "Real-time Service"', 'Connect API Gateway to it'],
        }),
      ],
    }),
  ],
});

export default notionTutorial;
