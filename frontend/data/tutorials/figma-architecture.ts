import { defineTutorial, level, step } from '@/lib/tutorial/builder';

const figmaTutorial = defineTutorial({
  id: 'figma-architecture',
  title: 'How to Design Figma Architecture',
  description: 'Build a collaborative design tool for 4 million teams. Learn CRDTs for conflict-free simultaneous editing, presence awareness, canvas rendering, and version history at scale.',
  difficulty: 'intermediate',
  estimatedMinutes: 40,
  tags: ['design', 'collaboration', 'crdt'],
  icon: 'PenTool',
  color: '#F24E1E',

  levels: [
    level({
      title: 'Collaborative Design Tool',
      description: 'Build the request path: the browser client, the API gateway, sticky-session load balancing, and the auth layer that gates file permissions.',
      steps: [
        step({
          component: 'Web Client',
          nodeType: 'client_web',
          phases: {
            context: {
              heading: 'Welcome to Figma Architecture',
              body: "Let's build Figma from scratch. 4 million design teams, simultaneous editing, and a CRDT implementation so good that two designers can move the same element at the same time without conflict.",
            },
            intro: {
              heading: 'Do you know about Web Clients?',
              body: 'Figma runs entirely in the browser using WebAssembly and WebGL for GPU-accelerated rendering.',
            },
            teaching: {
              heading: 'Deep dive: Web Client',
              body: "Figma's biggest technical achievement: solving the simultaneous edit problem using CRDTs \u2014 Conflict-free Replicated Data Types.",
              whyItMatters: 'Without a capable client, the best server is useless. Figma renders on the GPU in the browser and applies edits locally before they are ever acknowledged by a server.',
              tradeoff: 'Doing heavy rendering and CRDT logic in the browser means shipping megabytes of WASM. Loading time and memory use must be kept low enough that design teams stay productive.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Web Client', and add the client to the canvas.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'This is the first step, so no connections needed yet.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Web Client added. Now the API Gateway.',
            },
          },
          hints: ['Press \u2318K to open component search', 'Search for "Web Client"'],
        }),
        step({
          component: 'API Gateway',
          nodeType: 'api_gateway',
          parent: 'Web Client',
          phases: {
            context: {
              heading: 'Adding the API Gateway',
              body: 'The gateway handles file loading, asset uploads, plugin API calls, and the REST surface around the real-time collaboration layer.',
            },
            intro: {
              heading: 'Do you know about API Gateways?',
              body: "Figma's API Gateway handles file loading, asset uploads, and plugin API calls.",
            },
            teaching: {
              heading: 'Deep dive: API Gateway',
              body: "Real-time edit operations bypass the gateway and go directly to the collaboration server via WebSocket. The gateway is for everything else: file open, save, plugins, permissions, and asset management.",
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'API Gateway', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Web Client \u2192 API Gateway.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'API Gateway added. Now the Load Balancer.',
            },
          },
          hints: ['Search for "API Gateway"', 'Connect Web Client to it'],
        }),
        step({
          component: 'Load Balancer',
          nodeType: 'load_balancer',
          parent: 'API Gateway',
          phases: {
            context: {
              heading: 'Adding the Load Balancer',
              body: 'Collaboration sessions need sticky routing by file ID so all editors of a file reach the same server.',
            },
            intro: {
              heading: 'Do you know about Load Balancers?',
              body: "Figma's Load Balancer routes collaboration sessions using sticky routing by file ID.",
            },
            teaching: {
              heading: 'Deep dive: Load Balancer',
              body: "If Alice and Bob are both editing 'Homepage Design', they must connect to the same collaboration server. This ensures the CRDT engine sees all edits in one place.",
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Load Balancer', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect API Gateway \u2192 Load Balancer.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Load Balancer added. Now the Auth Service.',
            },
          },
          hints: ['Search for "Load Balancer"', 'Connect API Gateway to it'],
        }),
        step({
          component: 'Auth Service',
          nodeType: 'auth_service',
          parent: 'Load Balancer',
          phases: {
            context: {
              heading: 'Adding the Auth Service',
              body: 'File permissions are enforced at the connection level: viewers get read-only connections, editors get read-write.',
            },
            intro: {
              heading: 'Do you know about Auth Services?',
              body: "Figma's Auth Service handles user authentication and file permissions.",
            },
            teaching: {
              heading: 'Deep dive: Auth Service',
              body: "When you connect to a Figma file via WebSocket, the Auth Service checks your permission level. Viewers get a read-only connection; editors get a read-write connection. Enterprise SSO and team roles all resolve to this same permission check.",
              whyItMatters: 'Design files contain unreleased product work. A single permission bug that leaks a private file is a catastrophic trust failure for a design tool.',
              tradeoff: 'Permissions checked at connect time can go stale mid-session \u2014 someone removed from the team stays connected until the next check. Balance real-time revocation against the cost of re-validating every WebSocket message.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Auth Service', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Load Balancer \u2192 Auth Service.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Auth Service added. Level 1 complete \u2014 on to real-time collaboration.',
            },
          },
          hints: ['Search for "Auth Service"', 'Connect Load Balancer to it'],
        }),
      ],
    }),
    level({
      title: 'Real-Time Collaboration',
      description: 'The heart of Figma: CRDT conflict resolution, presence, event propagation, and version history.',
      steps: [
        step({
          component: 'CRDT Engine',
          nodeType: 'crdt_engine',
          parent: 'Load Balancer',
          phases: {
            context: {
              heading: 'Adding the CRDT Engine',
              body: 'Level 2 is the hard part \u2014 making two designers edit the same document without conflict.',
            },
            intro: {
              heading: 'Do you know about CRDT Engines?',
              body: 'CRDTs (Conflict-free Replicated Data Types) let replicas converge to the same state after concurrent edits, without a central lock.',
            },
            teaching: {
              heading: 'Deep dive: CRDT Engine',
              body: "The CRDT engine stores the document as an operation log. Every edit \u2014 move an element, type in a text layer \u2014 becomes an operation with a unique ID and a causal position. When operations arrive out of order, the CRDT merges them deterministically so every replica converges to the same document. No user ever sees 'conflict detected'.",
              whyItMatters: 'Without a CRDT, concurrent edits either overwrite each other or force a merge step that breaks the collaboration illusion. The CRDT is the reason Figma feels like magic.',
              tradeoff: 'CRDTs grow the operation log forever \u2014 unbounded metadata. Compression and periodic snapshotting are required or every open of a big file gets slower.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'CRDT Engine', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Load Balancer \u2192 CRDT Engine.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'CRDT Engine added. Now presence.',
            },
          },
          hints: ['Search for "CRDT Engine"', 'Connect Load Balancer to it'],
        }),
        step({
          component: 'Presence Service',
          nodeType: 'presence_service',
          parent: 'Web Client',
          phases: {
            context: {
              heading: 'Adding the Presence Service',
              body: 'Designers need to see who else is in the file, where their cursors are, and whether they are currently viewing.',
            },
            intro: {
              heading: 'Do you know about Presence Services?',
              body: 'Presence tracks who is online and what they are doing \u2014 cursors, selections, and active collaborators.',
            },
            teaching: {
              heading: 'Deep dive: Presence Service',
              body: "Presence is a separate WebSocket channel from the CRDT sync. It broadcasts lightweight state \u2014 cursor position, selected layer, active view \u2014 at a throttled rate so a room of designers sees each other without overwhelming the connection. Presence traffic is ephemeral: if it is dropped, nothing is lost.",
              whyItMatters: 'Live cursors are the social signal that makes collaboration feel real. Presence is what turns a shared document into a shared room.',
              tradeoff: 'Presence updates are high-frequency and low-value if sent too often. Throttle updates or the WebSocket floods and starves the real edit traffic.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Presence Service', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Web Client \u2192 Presence Service.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Presence Service added. Now the event bus.',
            },
          },
          hints: ['Search for "Presence Service"', 'Connect Web Client to it'],
        }),
        step({
          component: 'Event Bus / Pub-Sub',
          nodeType: 'event_bus',
          parent: 'CRDT Engine',
          phases: {
            context: {
              heading: 'Adding the Event Bus',
              body: 'Every applied edit should notify the rest of the system \u2014 thumbnails, plugins, integrations, and other sessions.',
            },
            intro: {
              heading: 'Do you know about Event Buses?',
              body: 'An event bus broadcasts domain events to many subscribers so services react independently.',
            },
            teaching: {
              heading: 'Deep dive: Event Bus / Pub-Sub',
              body: "When the CRDT engine applies an operation, it publishes an event \u2014 layer_created, style_changed, comment_added. The event bus fans these out to subscribers: the thumbnail renderer, the plugin runtime, webhooks for integrations, and analytics. Subscribers never block the editing path.",
              whyItMatters: 'Edits are the source of truth; everything else \u2014 thumbnails, plugins, notifications \u2014 is a reaction. The event bus wires reactions to edits without coupling the CRDT engine to every feature.',
              tradeoff: 'Pub/sub is at-least-once delivery \u2014 subscribers see duplicate or reordered events. Handlers must be idempotent or the side effects double.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Event Bus / Pub-Sub', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect CRDT Engine \u2192 Event Bus / Pub-Sub.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Event Bus added. Now version history.',
            },
          },
          hints: ['Search for "Event Bus / Pub-Sub"', 'Connect CRDT Engine to it'],
        }),
        step({
          component: 'Version History',
          nodeType: 'version_history',
          parent: 'CRDT Engine',
          phases: {
            context: {
              heading: 'Adding Version History',
              body: 'Designers undo mistakes that happened hours ago. Version history lets any file be restored to any point in time.',
            },
            intro: {
              heading: 'Do you know about Version History?',
              body: 'Version history snapshots document state so teams can diff, restore, and roll back.',
            },
            teaching: {
              heading: 'Deep dive: Version History',
              body: "Because the CRDT keeps every operation, version history is almost free: the system records snapshot markers over the operation log. Restoring a file means replaying operations up to the marker. Snapshots are compressed and stored durably, giving teams 'the file as it was last Tuesday'.",
              whyItMatters: 'Design work is expensive and precious. Losing a week of work to a bad merge or an errant delete is unacceptable \u2014 version history is the safety net.',
              tradeoff: 'Every snapshot costs storage, and unbounded history grows forever. Balance retention window and snapshot frequency against cost, or storage bills explode.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Version History', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect CRDT Engine \u2192 Version History.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Version History added. Level 2 complete \u2014 on to assets and scale.',
            },
          },
          hints: ['Search for "Version History"', 'Connect CRDT Engine to it'],
        }),
      ],
    }),
    level({
      title: 'Assets & Scale',
      description: 'Handle the heavy stuff: image and asset storage, background processing, metadata, and caching.',
      steps: [
        step({
          component: 'Object Storage',
          nodeType: 'object_storage',
          parent: 'API Gateway',
          phases: {
            context: {
              heading: 'Adding Object Storage',
              body: 'Images, fonts, and exported assets are large binary objects that must live outside the document store.',
            },
            intro: {
              heading: 'Do you know about Object Storage?',
              body: 'Object storage holds large binary assets \u2014 images, exports, fonts \u2014 with infinite scale and high durability.',
            },
            teaching: {
              heading: 'Deep dive: Object Storage',
              body: "Figma stores every uploaded image, every exported PNG/PDF, and every font file in object storage. Designers drag in gigabytes of images; the store must absorb them without ever filling up or slowing down.",
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Object Storage', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect API Gateway \u2192 Object Storage.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Object Storage added. Now background processing.',
            },
          },
          hints: ['Search for "Object Storage"', 'Connect API Gateway to it'],
        }),
        step({
          component: 'Worker',
          nodeType: 'worker_job',
          parent: 'Object Storage',
          phases: {
            context: {
              heading: 'Adding the Worker',
              body: 'Exports, thumbnail generation, and image processing are too slow to run inline.',
            },
            intro: {
              heading: 'Do you know about Workers?',
              body: 'Workers run long, asynchronous jobs like rendering exports and resizing images in the background.',
            },
            teaching: {
              heading: 'Deep dive: Worker',
              body: "When a designer exports a frame, the request goes to a queue and a worker renders it \u2014 sometimes for minutes on huge files. Workers also generate preview thumbnails and process uploaded images into the sizes the client needs. The designer sees a spinner, not a frozen tab.",
              whyItMatters: 'Exports and image processing can take minutes. Blocking the request thread would make Figma unusable for large files \u2014 async processing is non-negotiable.',
              tradeoff: 'Queued work adds latency between click and result. Use progress updates and cache results, or users think exports are broken.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Worker', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Object Storage \u2192 Worker.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Worker added. Now the metadata store.',
            },
          },
          hints: ['Search for "Worker"', 'Connect Object Storage to it'],
        }),
        step({
          component: 'SQL Database',
          nodeType: 'sql_db',
          parent: 'API Gateway',
          phases: {
            context: {
              heading: 'Adding the SQL Database',
              body: 'File metadata, team membership, comments, and permissions live in a relational database.',
            },
            intro: {
              heading: 'Do you know about SQL Databases?',
              body: 'The SQL Database stores structured metadata \u2014 files, folders, teams, permissions, comments.',
            },
            teaching: {
              heading: 'Deep dive: SQL Database',
              body: "The database holds file records, project trees, team memberships, and comment threads. It is the system of record for 'what exists', while the CRDT engine is the system of record for 'what the document contains'. Listing a team's files is a simple indexed query.",
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'SQL Database', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect API Gateway \u2192 SQL Database.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'SQL Database added. Last step \u2014 caching.',
            },
          },
          hints: ['Search for "SQL Database"', 'Connect API Gateway to it'],
        }),
        step({
          component: 'In-Memory Cache',
          nodeType: 'in_memory_cache',
          parent: 'Load Balancer',
          phases: {
            context: {
              heading: 'Adding the Cache',
              body: 'File open is a hot path \u2014 the metadata and document head should not hit the database every time.',
            },
            intro: {
              heading: 'Do you know about In-Memory Caches?',
              body: 'Caches store hot data in memory so repeated reads skip the database entirely.',
            },
            teaching: {
              heading: 'Deep dive: In-Memory Cache',
              body: "Opening a file fetches the document head and permission metadata. The cache serves these hot reads in sub-millisecond time, and because the load balancer pins a file to one server, the cache for that file stays warm in a single place.",
              whyItMatters: 'File open is the first impression of the product. A cold database read on every open would add noticeable latency to the most common action in Figma.',
              tradeoff: 'Cache invalidation is the eternal risk \u2014 permission changes must bust the cached entry. TTL-based invalidation is simple but can briefly serve stale permissions.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'In-Memory Cache', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Load Balancer \u2192 In-Memory Cache.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'In-Memory Cache added. You have built Figma \u2014 a complete collaborative design platform.',
            },
          },
          hints: ['Search for "In-Memory Cache"', 'Connect Load Balancer to it'],
        }),
      ],
    }),
  ],
});

export default figmaTutorial;
