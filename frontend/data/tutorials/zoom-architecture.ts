import { defineTutorial, level, step } from '@/lib/tutorial/builder';

const zoomTutorial = defineTutorial({
  id: 'zoom-architecture',
  title: 'How to Design Zoom Architecture',
  description: 'Build the video conferencing platform. Learn about WebRTC, SFU, and real-time communication at scale.',
  difficulty: 'intermediate',
  estimatedMinutes: 40,
  tags: ['video-conferencing', 'webrtc', 'real-time'],
  icon: 'Video',
  color: '#2D8CFF',

  levels: [
    level({
      title: 'Video Foundation',
      description: 'Capture audio and video on the client, coordinate connections over signaling, and route media through WebRTC gateways.',
      steps: [
        step({
          component: 'Mobile Client',
          nodeType: 'client_mobile',
          phases: {
            context: {
              heading: 'Welcome to Zoom Architecture',
              body: 'Zoom serves 300 million daily meeting participants. We will build the real-time video infrastructure that makes this possible.',
            },
            intro: {
              heading: 'About the Mobile Client',
              body: 'The Zoom client runs on desktop (Electron), mobile (native), and web (browser). Each platform must handle camera/microphone capture, video encoding, and network adaptation.',
            },
            teaching: {
              heading: 'Deep dive: Mobile Client',
              body: 'Zoom clients capture audio and video from local devices, encode them in real-time, and adapt quality based on available bandwidth. The client implements simulcast \u2014 encoding three quality layers (low, medium, high) simultaneously so the server can choose the best quality each receiver can handle. Without a well-built client, even the best server infrastructure cannot deliver smooth video.',
              whyItMatters: 'Every bit of audio and video enters through the client. A client that encodes poorly or fails to adapt to bandwidth ruins every meeting, no matter how good the servers are.',
              tradeoff: 'Simulcasting three quality layers triples encoding CPU and battery drain on the client. Without it, the server cannot mix qualities per-receiver, so meetings degrade for everyone at once.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Mobile Client', and add the Mobile Client to the canvas.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'This is the first step, so no connections needed yet.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Mobile Client added. This is where all video capture begins.',
            },
          },
          hints: ['Press \u2318K to open component search', 'Search for "Mobile Client"'],
        }),
        step({
          component: 'Signaling Server',
          nodeType: 'signaling_server',
          parent: 'Mobile Client',
          phases: {
            context: {
              heading: 'Adding the Signaling Server',
              body: 'Before any video flows, the clients must discover each other and agree on how to connect. That handshake is signaling.',
            },
            intro: {
              heading: 'About Signaling Servers',
              body: 'Signaling servers exchange session descriptions (SDP) and connection candidates (ICE) between participants \u2014 they never carry media itself.',
            },
            teaching: {
              heading: 'Deep dive: Signaling Server',
              body: "When you start a call, the client sends its SDP offer and ICE candidates to the signaling server, which relays them to the other participants. Signaling establishes the call, manages join/leave, and coordinates quality changes \u2014 but it carries no audio or video. Signaling must be reliable and low-latency, but it is lightweight traffic.",
              whyItMatters: 'Without signaling, peers cannot find each other or exchange the SDP/ICE handshake needed to start any media session. It is the connective tissue of every WebRTC call.',
              tradeoff: 'Signaling is often centralized (WebSocket) while media is peer-to-peer or through an SFU. A signaling outage blocks new calls even though existing media streams keep flowing.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Signaling Server', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Mobile Client \u2192 Signaling Server.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Signaling Server added. Now the media entry point.',
            },
          },
          hints: ['Search for "Signaling Server"', 'Connect Mobile Client to it'],
        }),
        step({
          component: 'WebRTC Server',
          nodeType: 'webrtc_server',
          parent: 'Signaling Server',
          phases: {
            context: {
              heading: 'Adding the WebRTC Server',
              body: 'Once signaling agrees on the handshake, real media needs a server to terminate WebRTC connections.',
            },
            intro: {
              heading: 'About WebRTC Servers',
              body: 'WebRTC servers terminate the media connections, handle NAT traversal and encryption, and route streams toward the SFU.',
            },
            teaching: {
              heading: 'Deep dive: WebRTC Server',
              body: 'Unlike HTTP request-response, WebRTC media travels over UDP with sub-200ms latency targets. The WebRTC server completes the SDP/ICE negotiation, sets up DTLS-SRTP encryption, and forwards media packets to the media servers. Zoom processes 100+ million WebRTC connections daily through these gateways.',
              whyItMatters: 'The WebRTC server is where raw UDP media becomes routable infrastructure \u2014 without it, clients cannot punch through NATs and firewalls to reach the SFU.',
              tradeoff: 'Terminating WebRTC at a gateway adds a network hop. The gateway must forward media fast enough that the added hop does not push latency over the real-time budget.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'WebRTC Server', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Signaling Server \u2192 WebRTC Server.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'WebRTC Server added. Now the media routing core.',
            },
          },
          hints: ['Search for "WebRTC Server"', 'Connect Signaling Server to it'],
        }),
        step({
          component: 'Media Server',
          nodeType: 'media_server',
          parent: 'WebRTC Server',
          phases: {
            context: {
              heading: 'Adding the Media Server',
              body: 'Group calls need each participant to see everyone else. The SFU routes the right streams to the right people.',
            },
            intro: {
              heading: 'About Media Servers (SFU)',
              body: 'A Selective Forwarding Unit receives everyone\u2019s streams and forwards a personalized subset to each participant \u2014 it routes, it does not transcode.',
            },
            teaching: {
              heading: 'Deep dive: Media Server (SFU)',
              body: "In a 50-person call, each participant uploads one stream and receives a handful. The SFU decides which simulcast layer to forward based on each receiver's screen size and bandwidth \u2014 a phone on 3G gets low quality, a TV gets full resolution. Because it only forwards, it scales far better than a mixer (MCU) that would need to decode and re-encode everything.",
              whyItMatters: 'The SFU is the heart of scale: it keeps bandwidth O(participants) instead of O(participants²) and adapts quality per receiver.',
              tradeoff: 'SFU forwards rather than mixes, so each receiver still decodes multiple streams \u2014 a phone renders several videos at once. MCU mixing reduces receiver load but burns server CPU on transcoding.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Media Server', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect WebRTC Server \u2192 Media Server.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Media Server added. Level 1 complete \u2014 the media path is alive.',
            },
          },
          hints: ['Search for "Media Server"', 'Connect WebRTC Server to it'],
        }),
      ],
    }),
    level({
      title: 'Production Ready',
      description: 'Make calls work everywhere: TURN relay for hostile networks, meeting orchestration, and the state behind every call.',
      steps: [
        step({
          component: 'TURN Server',
          nodeType: 'turn_server',
          parent: 'Media Server',
          phases: {
            context: {
              heading: 'Adding the TURN Server',
              body: 'Some networks \u2014 strict corporate firewalls, symmetric NATs \u2014 make direct media impossible. TURN relays it.',
            },
            intro: {
              heading: 'About TURN Servers',
              body: 'TURN relays media through a server when direct peer connections are blocked by NATs or firewalls.',
            },
            teaching: {
              heading: 'Deep dive: TURN Server',
              body: "When ICE cannot establish a direct path, the client sends media through the TURN server, which relays it to the other side. TURN is the fallback that makes calls work from locked-down enterprise networks and countries with restrictive NATs. Zoom and Twilio route a significant share of enterprise traffic through TURN relays.",
              whyItMatters: 'A call that fails to connect is a failed product moment. TURN guarantees connectivity even where direct UDP is blocked \u2014 it is the last line of defense for the connection.',
              tradeoff: 'TURN relays every byte of media, so bandwidth and egress costs multiply \u2014 typically 2-3x a P2P call. Use it only when direct connection fails.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'TURN Server', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Media Server \u2192 TURN Server.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'TURN Server added. Now meeting orchestration.',
            },
          },
          hints: ['Search for "TURN Server"', 'Connect Media Server to it'],
        }),
        step({
          component: 'Meeting Service',
          nodeType: 'meeting_service',
          parent: 'Media Server',
          phases: {
            context: {
              heading: 'Adding the Meeting Service',
              body: 'Who is in which meeting, with which permissions, and routed to which media server \u2014 that is the Meeting Service.',
            },
            intro: {
              heading: 'About Meeting Services',
              body: 'Meeting services handle room creation, participant join/leave, mute/unmute, screen sharing, and meeting recording triggers.',
            },
            teaching: {
              heading: 'Deep dive: Meeting Service',
              body: 'When a user clicks "Join Meeting", the Meeting Service creates a session, assigns a meeting ID, validates the user\'s permissions, and directs them to the optimal SFU (Selective Forwarding Unit) based on geographic proximity. It maintains a real-time roster of all participants and their media states. Without centralized meeting management, participants would have no way to discover each other or coordinate media routing.',
              whyItMatters: 'Every participant action \u2014 join, mute, share \u2014 is mediated by the Meeting Service. If it is down, no one can start or join a meeting at all.',
              tradeoff: 'A single meeting service is a single point of failure for millions of concurrent calls. It must be stateless (state in DB/cache) and horizontally scaled, or one bad deploy takes down every call.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Meeting Service', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Media Server \u2192 Meeting Service.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Meeting Service added. Now the meeting state store.',
            },
          },
          hints: ['Search for "Meeting Service"', 'Connect Media Server to it'],
        }),
        step({
          component: 'SQL Database',
          nodeType: 'sql_db',
          parent: 'Meeting Service',
          phases: {
            context: {
              heading: 'Adding the SQL Database',
              body: 'Meeting records, rosters, and scheduling data need durable storage.',
            },
            intro: {
              heading: 'About the Meeting Database',
              body: 'The SQL Database stores meetings, participants, recordings metadata, and scheduling.',
            },
            teaching: {
              heading: 'Deep dive: SQL Database',
              body: "The database persists meeting metadata: scheduled meetings, past-meeting records, participant lists, and links. Live roster state is kept in memory and cache for speed, while the database is the durable record that survives server restarts. When a meeting ends, the transcript and recording references are written here.",
              whyItMatters: 'Without durable state, a server restart mid-meeting would lose the meeting\u2019s entire history. The database is the record of what happened.',
              tradeoff: 'Durability costs latency \u2014 a synchronous DB write on every roster change would slow join/leave. Keep hot state in memory and persist asynchronously.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'SQL Database', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Meeting Service \u2192 SQL Database.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'SQL Database added. Now the cache.',
            },
          },
          hints: ['Search for "SQL Database"', 'Connect Meeting Service to it'],
        }),
        step({
          component: 'In-Memory Cache',
          nodeType: 'in_memory_cache',
          parent: 'Meeting Service',
          phases: {
            context: {
              heading: 'Adding the Cache',
              body: 'Live rosters are read by every participant action \u2014 they must be served from memory, not disk.',
            },
            intro: {
              heading: 'About the Meeting Cache',
              body: 'The cache holds live meeting state \u2014 rosters, media routes, and participant status \u2014 for sub-millisecond reads.',
            },
            teaching: {
              heading: 'Deep dive: In-Memory Cache',
              body: "The Meeting Service keeps live rosters and media-server routing in the cache. When a participant joins, the roster read and update happen in memory, not the database. This keeps join latency near-instant even when the database is busy with recording metadata and history.",
              whyItMatters: 'Live state is read far more often than it is written, and every join/mute/raise-hand depends on it. Disk reads on this hot path would add noticeable delay to every action.',
              tradeoff: 'Cached rosters can go stale \u2014 a client that crashes without leaving gracefully leaves a ghost in the roster until the cache expires it.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'In-Memory Cache', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Meeting Service \u2192 In-Memory Cache.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Cache added. Level 2 complete \u2014 on to the expert layer.',
            },
          },
          hints: ['Search for "In-Memory Cache"', 'Connect Meeting Service to it'],
        }),
      ],
    }),
    level({
      title: 'Expert Architecture',
      description: 'Recordings, background processing, media storage, and the async pipeline around meetings.',
      steps: [
        step({
          component: 'Recording Service',
          nodeType: 'microservice',
          parent: 'Meeting Service',
          phases: {
            context: {
              heading: 'Adding the Recording Service',
              body: 'Zoom cloud recording processes millions of recordings daily. This service captures meeting audio, video, chat, and transcripts.',
            },
            intro: {
              heading: 'About Recording Services',
              body: 'Recording services capture media streams, transcode them into portable formats, generate transcripts, and store them securely.',
            },
            teaching: {
              heading: 'Deep dive: Recording Service',
              body: 'The Recording Service taps into the media stream at the SFU level, captures all participant audio/video tracks, and writes them to distributed storage. It runs real-time transcription using speech-to-text models, generates chapter markers, and produces shareable links. Recordings must be encrypted at rest and comply with data retention policies across 190 countries.',
              whyItMatters: 'Recording turns a transient meeting into a durable asset \u2014 absentees, training, and compliance all depend on it. Losing a recording is a product trust failure.',
              tradeoff: 'Recording every meeting triples the media cost of the call. Storage retention, encryption, and privacy consent rules vary by region and add heavy compliance complexity.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Recording Service', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Meeting Service \u2192 Recording Service.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Recording Service added. Now processing.',
            },
          },
          hints: ['Search for "Recording Service"', 'Connect Meeting Service to it'],
        }),
        step({
          component: 'Worker',
          nodeType: 'worker_job',
          parent: 'Recording Service',
          phases: {
            context: {
              heading: 'Adding the Worker',
              body: 'Transcoding and transcription are heavy \u2014 they must run in the background, not during the call.',
            },
            intro: {
              heading: 'About Workers',
              body: 'Workers run heavy asynchronous jobs \u2014 transcoding, transcription, chapter detection \u2014 off the live path.',
            },
            teaching: {
              heading: 'Deep dive: Worker',
              body: "When a meeting ends, the Recording Service hands the raw stream to the worker pool. Workers transcode into distributable formats, run transcription, detect chapters, and write the finished recording. A 60-minute recording can take minutes of processing \u2014 none of it blocks the live meeting.",
              whyItMatters: 'Transcoding is CPU-heavy and slow. Running it inline would strain the recording pipeline and delay availability of recordings.',
              tradeoff: 'Workers mean recordings are not instantly available \u2014 there is always a processing delay. Faster clusters shorten it but cost more to idle.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Worker', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Recording Service \u2192 Worker.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Worker added. Now media storage.',
            },
          },
          hints: ['Search for "Worker"', 'Connect Recording Service to it'],
        }),
        step({
          component: 'Object Storage',
          nodeType: 'object_storage',
          parent: 'Worker',
          phases: {
            context: {
              heading: 'Adding Object Storage',
              body: 'Finished recordings are large binary files \u2014 hours of video, transcripts, and chat logs.',
            },
            intro: {
              heading: 'About Object Storage',
              body: 'Object storage holds the finished recordings and transcripts with high durability and infinite scale.',
            },
            teaching: {
              heading: 'Deep dive: Object Storage',
              body: "The worker writes finished recordings and transcripts to object storage, addressed by meeting ID. Playback streams from object storage through a CDN. Cold recordings move to cheaper tiers after a retention window, balancing compliance requirements against storage cost.",
              whyItMatters: 'Recordings accumulate fast \u2014 petabytes per year at Zoom scale. Only object storage can hold that volume durably and cheaply.',
              tradeoff: 'Object storage has slower first-byte latency than hot storage, and lifecycle tiering means recall can take minutes for very old recordings.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Object Storage', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Worker \u2192 Object Storage.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Object Storage added. Final step \u2014 async events.',
            },
          },
          hints: ['Search for "Object Storage"', 'Connect Worker to it'],
        }),
        step({
          component: 'Message Queue',
          nodeType: 'message_queue',
          parent: 'Recording Service',
          phases: {
            context: {
              heading: 'Adding the Message Queue',
              body: 'Recording-complete events must reach many consumers \u2014 notifications, analytics, compliance \u2014 without blocking the pipeline.',
            },
            intro: {
              heading: 'About Message Queues',
              body: 'Message queues decouple event producers from consumers so each step of the pipeline scales independently.',
            },
            teaching: {
              heading: 'Deep dive: Message Queue',
              body: "When a recording is ready, the Recording Service publishes an event \u2014 recording_complete, transcript_ready. Consumers send the 'recording available' email, update analytics, and trigger compliance checks. The recording pipeline never waits for consumers.",
              whyItMatters: 'Recording completion triggers many downstream effects. A queue lets them all happen asynchronously and retry independently.',
              tradeoff: 'Events are delivered at-least-once \u2014 a duplicate notification email is annoying but a duplicate compliance archive is a real problem. Consumers need idempotency.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Message Queue', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Recording Service \u2192 Message Queue.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Message Queue added. You have built Zoom \u2014 the complete real-time video platform.',
            },
          },
          hints: ['Search for "Message Queue"', 'Connect Recording Service to it'],
        }),
      ],
    }),
  ],
});

export default zoomTutorial;
