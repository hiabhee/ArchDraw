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
      steps: [
        step({
          component: 'Client',
          nodeType: 'client_mobile',
          noConnect: true,
          phases: {
            context: { heading: 'Welcome to Zoom Architecture', body: 'Zoom serves 300 million daily meeting participants. We will build the real-time video infrastructure that makes this possible.' },
            intro: { heading: 'About the Client', body: 'The Zoom client runs on desktop (Electron), mobile (native), and web (browser). Each platform must handle camera/microphone capture, video encoding, and network adaptation.' },
            teaching: { heading: 'Deep dive: Client', body: 'Zoom clients capture audio and video from local devices, encode them in real-time, and adapt quality based on available bandwidth. The client implements simulcast — encoding three quality layers (low, medium, high) simultaneously so the server can choose the best quality each receiver can handle. Without a well-built client, even the best server infrastructure cannot deliver smooth video.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Mobile', and add the Client to the canvas." },
            connecting: { heading: 'Connect it up', body: 'First step — no connections needed yet.' },
            celebration: { heading: 'Great job!', body: 'Client added. This is where all video capture begins.' },
          },
          hints: ['Search for "Mobile"'],
        }),
        step({
          component: 'WebRTC Gateway',
          nodeType: 'webrtc_server',
          parent: 'Client',
          phases: {
            context: { heading: 'Step 2: WebRTC Gateway', body: 'WebRTC (Web Real-Time Communication) is the protocol that enables sub-200ms latency video calls directly between browsers and servers.' },
            intro: { heading: 'About WebRTC Gateways', body: 'WebRTC gateways terminate WebRTC connections from clients and route media streams. They handle NAT traversal (STUN/TURN), ICE connectivity checks, and DTLS encryption.' },
            teaching: { heading: 'Deep dive: WebRTC Gateway', body: 'Unlike HTTP which uses request-response, WebRTC uses UDP for real-time media. The WebRTC Gateway manages the signaling handshake (SDP offer/answer), ICE candidate exchange, and DTLS-SRTP key negotiation. Without it, clients behind firewalls and NATs cannot connect. Zoom processes 100+ million WebRTC connections daily through these gateways.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'WebRTC', and add the WebRTC Gateway." },
            connecting: { heading: 'Connect it up', body: 'Connect Client \u2192 WebRTC Gateway. This is how video packets flow from the user to the server.' },
            celebration: { heading: 'Great job!', body: 'WebRTC Gateway added and connected.' },
          },
          hints: ['Search for "WebRTC"', 'Connect Client to it'],
        }),
      ],
    }),
    level({
      title: 'Production Ready',
      steps: [
        step({
          component: 'Meeting Service',
          nodeType: 'meeting_service',
          parent: 'WebRTC Gateway',
          phases: {
            context: { heading: 'Level 2: Meeting Service', body: 'The Meeting Service manages meeting state — who is in which meeting, who has which permissions, and which media server each participant connects to.' },
            intro: { heading: 'About Meeting Services', body: 'Meeting services handle room creation, participant join/leave, mute/unmute, screen sharing, and meeting recording triggers.' },
            teaching: { heading: 'Deep dive: Meeting Service', body: 'When a user clicks "Join Meeting", the Meeting Service creates a session, assigns a meeting ID, validates the user\'s permissions, and directs them to the optimal SFU (Selective Forwarding Unit) based on geographic proximity. It maintains a real-time roster of all participants and their media states. Without centralized meeting management, participants would have no way to discover each other or coordinate media routing.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Microservice', and add the Meeting Service." },
            connecting: { heading: 'Connect it up', body: 'Connect WebRTC Gateway \u2192 Meeting Service.' },
            celebration: { heading: 'Great job!', body: 'Meeting Service added.' },
          },
          hints: ['Search for "Microservice"', 'Connect WebRTC Gateway to it'],
        }),
      ],
    }),
    level({
      title: 'Expert Architecture',
      steps: [
        step({
          component: 'Recording Service',
          nodeType: 'microservice',
          parent: 'Meeting Service',
          phases: {
            context: { heading: 'Level 3: Recording Service', body: 'Zoom cloud recording processes 50+ million recordings daily. This service captures meeting audio, video, chat, and transcripts.' },
            intro: { heading: 'About Recording Services', body: 'Recording services capture media streams, transcode them into portable formats, generate transcripts, and store them securely.' },
            teaching: { heading: 'Deep dive: Recording Service', body: 'The Recording Service taps into the media stream at the SFU level, captures all participant audio/video tracks, and writes them to distributed storage. It runs real-time transcription using speech-to-text models, generates chapter markers, and produces shareable links. Recordings must be encrypted at rest and comply with data retention policies across 190 countries.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Microservice', and add the Recording Service." },
            connecting: { heading: 'Connect it up', body: 'Connect Meeting Service \u2192 Recording Service.' },
            celebration: { heading: 'Great job!', body: 'Recording Service added. Your Zoom architecture is complete!' },
          },
          hints: ['Search for "Microservice"', 'Connect Meeting Service to it'],
        }),
      ],
    }),
  ],
});

export default zoomTutorial;
