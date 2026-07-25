import { defineTutorial, level, step } from '@/lib/tutorial/builder';

const whatsappTutorial = defineTutorial({
  id: 'whatsapp-architecture',
  title: 'How to Design WhatsApp Architecture',
  description: 'Build the messaging platform that powers 2 billion users. Learn about end-to-end encryption, message delivery, and voice calls at global scale.',
  difficulty: 'intermediate',
  estimatedMinutes: 55,
  tags: ['messaging', 'encryption', 'voice'],
  icon: 'MessageCircle',
  color: '#25D366',

  levels: [
    level({
      title: 'Messaging Foundation',
      steps: [
        step({
          component: 'Mobile Client',
          nodeType: 'client_mobile',
          noConnect: true,
          phases: {
            context: { heading: 'Welcome to WhatsApp Architecture', body: 'WhatsApp sends 100 billion messages daily to 2 billion users. Every message is end-to-end encrypted — WhatsApp servers never see plaintext content. The architecture must deliver messages reliably across unreliable networks worldwide.' },
            intro: { heading: 'About the Mobile Client', body: 'The WhatsApp client is a native mobile app that handles message composition, encryption, delivery receipts, and offline message queuing.' },
            teaching: { heading: 'Deep dive: Mobile Client', body: 'The WhatsApp client implements the Signal Protocol for end-to-end encryption — every message is encrypted on the sender\'s device and only decrypted on the recipient\'s device. The client also handles offline-first messaging: if you send a message while the recipient is offline, it is stored on the device and delivered when they reconnect. The client manages "presence" (online/offline status), read receipts (blue ticks), and typing indicators — all encrypted end-to-end. Without client-side encryption, servers could read message content, breaking WhatsApp\'s core privacy guarantee.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Mobile', and add the Mobile Client." },
            connecting: { heading: 'Connect it up', body: 'First step — no connections yet.' },
            celebration: { heading: 'Great job!', body: 'Mobile Client added.' },
          },
          hints: ['Search for "Mobile"'],
        }),
        step({
          component: 'API Gateway',
          nodeType: 'api_gateway',
          parent: 'Mobile Client',
          phases: {
            context: { heading: 'Step 2: API Gateway', body: 'Every message, voice call request, and presence update routes through the API Gateway, which manages persistent connections for 2 billion simultaneous users.' },
            intro: { heading: 'About API Gateways', body: 'API gateways manage connections, authenticate users, and route messages to the correct backend service.' },
            teaching: { heading: 'Deep dive: API Gateway', body: 'WhatsApp\'s API Gateway maintains persistent XMPP connections to all online users. When you send a message, it arrives at the gateway, which looks up the recipient\'s connection and forwards the encrypted message. If the recipient is offline, the gateway queues the message for later delivery. The gateway must handle 2 billion connections — each requiring heartbeats, encryption handshakes, and message routing. WhatsApp uses Erlang (the telecom language) because it handles millions of lightweight processes efficiently.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'API Gateway', and add it." },
            connecting: { heading: 'Connect it up', body: 'Connect Mobile Client \u2192 API Gateway.' },
            celebration: { heading: 'Great job!', body: 'API Gateway added.' },
          },
          hints: ['Search for "API Gateway"', 'Connect Mobile Client to it'],
        }),
        step({
          component: 'Message Service',
          nodeType: 'message_service',
          parent: 'API Gateway',
          phases: {
            context: { heading: 'Step 3: Message Service', body: 'The Message Service is WhatsApp\'s core engine — it stores, routes, and delivers 100 billion messages daily with exactly-once delivery semantics.' },
            intro: { heading: 'About Message Services', body: 'Message services handle the full message lifecycle: receipt, storage, routing, delivery, and delivery confirmation.' },
            teaching: { heading: 'Deep dive: Message Service', body: 'The Message Service implements a store-and-forward model: messages are encrypted on the sender\'s device, stored on WhatsApp\'s servers, and forwarded to the recipient when they come online. Each message gets a unique ID and a delivery status (sent \u2192 delivered \u2192 read). The service must handle group messages — a message to a 256-person group generates 256 individual deliveries. Without store-and-forward, messages would be lost if the recipient is offline, breaking the reliability guarantee.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Microservice', and add the Message Service." },
            connecting: { heading: 'Connect it up', body: 'Connect API Gateway \u2192 Message Service.' },
            celebration: { heading: 'Great job!', body: 'Message Service added.' },
          },
          hints: ['Search for "Microservice"', 'Connect API Gateway to it'],
        }),
        step({
          component: 'Database',
          nodeType: 'sql_db',
          parent: 'Message Service',
          phases: {
            context: { heading: 'Step 4: Database', body: 'WhatsApp stores message metadata (sender, timestamp, delivery status) but NOT message content — content is end-to-end encrypted and only exists on devices.' },
            intro: { heading: 'About Databases', body: 'Databases store message metadata, user accounts, and group information while maintaining strict privacy guarantees.' },
            teaching: { heading: 'Deep dive: Database', body: 'WhatsApp\'s database stores message metadata (who sent what to whom and when) but never stores message content — that is encrypted end-to-end and only exists on sender/recipient devices. The database also stores user accounts, group membership, and block lists. WhatsApp uses a custom Mnesia database (Erlang\'s built-in distributed database) for message storage, optimized for the access pattern: write-once, read-once, delete-after-delivery. Messages are deleted from servers after delivery, reducing storage costs and privacy risk.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'NoSQL Database', and add the Database." },
            connecting: { heading: 'Connect it up', body: 'Connect Message Service \u2192 Database.' },
            celebration: { heading: 'Great job!', body: 'Database added. Messages can now be stored.' },
          },
          hints: ['Search for "NoSQL Database"', 'Connect Message Service to it'],
        }),
      ],
    }),
    level({
      title: 'Production Layer',
      steps: [
        step({
          component: 'Auth Service',
          nodeType: 'auth_service',
          parent: 'API Gateway',
          phases: {
            context: { heading: 'Level 2: Auth Service', body: 'WhatsApp authenticates users via phone number verification (SMS code) and manages end-to-end encryption keys (Signal Protocol identity keys).' },
            intro: { heading: 'About Auth Services', body: 'Auth services verify user identity, manage encryption keys, and enforce access control.' },
            teaching: { heading: 'Deep dive: Auth Service', body: 'The Auth Service verifies phone numbers via SMS codes, manages Signal Protocol identity keys (each device has a unique key pair), and handles key rotation (keys are updated periodically for forward secrecy). When you install WhatsApp on a new device, the Auth Service verifies your phone number and re-establishes your encryption keys. Without proper key management, end-to-end encryption would be broken — the server could substitute its own keys and read messages (a man-in-the-middle attack).' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Auth Service', and add it." },
            connecting: { heading: 'Connect it up', body: 'Connect API Gateway \u2192 Auth Service.' },
            celebration: { heading: 'Great job!', body: 'Auth Service added.' },
          },
          hints: ['Search for "Auth Service"', 'Connect API Gateway to it'],
        }),
      ],
    }),
    level({
      title: 'Expert Architecture',
      steps: [
        step({
          component: 'Voice Service',
          nodeType: 'media_server',
          parent: 'Mobile Client',
          phases: {
            context: { heading: 'Level 3: Voice Service', body: 'WhatsApp voice and video calls use WebRTC for peer-to-peer connections, with TURN relay servers as fallback when direct connections fail.' },
            intro: { heading: 'About Voice Services', body: 'Voice services manage real-time audio/video calls using WebRTC, with TURN relay servers for NAT traversal.' },
            teaching: { heading: 'Deep dive: Voice Service', body: 'WhatsApp voice calls use WebRTC for end-to-end encrypted peer-to-peer audio. When a call is initiated, the Voice Service coordinates ICE (Interactive Connectivity Establishment) to find the best connection path between caller and callee. If direct P2P fails (due to symmetric NATs or firewalls), TURN relay servers forward encrypted media packets. WhatsApp handles 2+ billion minutes of voice calls daily, and the Voice Service must maintain call quality across varying network conditions (WiFi to cellular handoff during a walk).' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Message Queue', and add the Voice Service." },
            connecting: { heading: 'Connect it up', body: 'Connect Mobile Client \u2192 Voice Service.' },
            celebration: { heading: 'Great job!', body: 'Voice Service added. Your WhatsApp architecture is complete!' },
          },
          hints: ['Search for "Message Queue"', 'Connect Mobile Client to it'],
        }),
      ],
    }),
  ],
});

export default whatsappTutorial;
