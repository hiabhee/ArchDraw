import { defineTutorial, level, step } from '@/lib/tutorial/builder';

const spotifyTutorial = defineTutorial({
  id: 'spotify-architecture',
  title: 'How to Design Spotify Architecture',
  description: 'Build a music streaming platform for 600 million users. Learn audio transcoding, CDN delivery, offline sync, recommendation algorithms, and real-time listening sessions.',
  difficulty: 'intermediate',
  estimatedMinutes: 30,
  tags: ['streaming', 'cdn', 'music'],
  icon: 'Music',
  color: '#1DB954',

  levels: [
    level({
      title: 'Music Streaming Platform',
      steps: [
        step({
          component: 'Audio CDN',
          nodeType: 'audio_cdn',
          noConnect: true,
          phases: {
            context: {
              heading: 'Welcome to Spotify Architecture',
              body: "Spotify streams billions of hours monthly — playback starts at the Audio CDN edge closest to each listener.",
            },
            intro: {
              heading: 'Do you know about Audio CDNs?',
              body: "Spotify's Audio CDN delivers audio files from edge locations close to listeners.",
            },
            teaching: {
              heading: 'Deep dive: Audio CDN',
              body: "Spotify uses multiple CDN providers simultaneously. A song request goes to whichever CDN has the lowest latency for your location. The top 10,000 songs account for 80% of streams — pre-cached everywhere.",
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Audio CDN', and add it to the canvas.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'This is the first step, so no connections needed yet.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Audio CDN added. Now the Web Client.',
            },
          },
          hints: ['Search for "Audio CDN"'],
        }),
        step({
          component: 'Web Client',
          nodeType: 'client_web',
          parent: 'Audio CDN',
          phases: {
            context: {
              heading: 'Level 1: Step 2',
              body: 'Clients request manifests and audio segments from the CDN while managing queues, offline downloads, and social features.',
            },
            intro: {
              heading: 'Do you know about Web Clients?',
              body: "Spotify's client is the web app, desktop app, and mobile app that handles audio quality selection, local playback queue, and offline downloads.",
            },
            teaching: {
              heading: 'Deep dive: Web Client',
              body: "Spotify's client selects audio quality automatically: 24kbps on 2G, 96kbps on 3G, 160kbps on WiFi, 320kbps for Premium users. The client also manages the local playback queue and offline downloads.",
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Web Client', and add the client to the canvas.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Audio CDN \u2192 Web Client.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Web Client added. Now the API Gateway.',
            },
          },
          hints: ['Search for "Web Client"', 'Connect Audio CDN to Web Client'],
        }),
        step({
          component: 'API Gateway',
          nodeType: 'api_gateway',
          parent: 'Web Client',
          phases: {
            context: {
              heading: 'Level 1: Step 3',
              body: 'Adding the API Gateway — handles non-audio requests.',
            },
            intro: {
              heading: 'Do you know about API Gateways?',
              body: 'All non-audio requests \u2014 search, playlist management, social features \u2014 flow through the API Gateway.',
            },
            teaching: {
              heading: 'Deep dive: API Gateway',
              body: "The API Gateway routes requests to the right microservice: search queries go to the search service, playlist updates go to the playlist service, recommendation requests go to the ML inference service.",
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
              heading: 'Level 1: Step 4',
              body: 'Adding the Load Balancer \u2014 distributes traffic across 800+ services.',
            },
            intro: {
              heading: 'Do you know about Load Balancers?',
              body: "Spotify's Load Balancer distributes API requests across thousands of microservice instances.",
            },
            teaching: {
              heading: 'Deep dive: Load Balancer',
              body: "When Taylor Swift drops a new album, millions of users search simultaneously. The load balancer auto-scales the search service cluster while other services remain unaffected.",
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
              heading: 'Level 1: Step 5',
              body: 'Adding the Auth Service \u2014 handles authentication and Spotify Connect.',
            },
            intro: {
              heading: 'Do you know about Auth Services?',
              body: "Spotify authenticates users via email/password or OAuth (Facebook, Google, Apple).",
            },
            teaching: {
              heading: 'Deep dive: Auth Service',
              body: "Spotify Connect lets you control your TV's Spotify from your phone. The Auth Service issues device tokens so your phone can send commands to your TV's session.",
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
              body: 'Auth Service added. Now the Recommendation Service.',
            },
          },
          hints: ['Search for "Auth Service"', 'Connect Load Balancer to it'],
        }),
        step({
          component: 'Recommendation Service',
          nodeType: 'recommendation_service',
          parent: 'Load Balancer',
          phases: {
            context: {
              heading: 'Level 1: Step 6',
              body: 'Adding the Recommendation Service — powers Discover Weekly and personalized playlists.',
            },
            intro: {
              heading: 'Do you know about Recommendation Services?',
              body: "Spotify's recommendation engine analyzes listening history, skips, and playlist adds to surface new music.",
            },
            teaching: {
              heading: 'Deep dive: Recommendation Service',
              body: "Collaborative filtering compares your taste to similar listeners. The service runs batch jobs overnight and serves pre-computed candidates in milliseconds at request time.",
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Recommendation Service', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Load Balancer \u2192 Recommendation Service.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Recommendation Service added. Now the Database.',
            },
          },
          hints: ['Search for "Recommendation Service"', 'Connect Load Balancer to it'],
        }),
        step({
          component: 'Database',
          nodeType: 'sql_db',
          parent: 'Auth Service',
          phases: {
            context: {
              heading: 'Level 1: Step 7',
              body: 'Adding the Database — stores user profiles, playlists, and listening history.',
            },
            intro: {
              heading: 'Do you know about Databases?',
              body: "Spotify's metadata database tracks songs, artists, albums, and user library state.",
            },
            teaching: {
              heading: 'Deep dive: Database',
              body: "Playlist edits and follow actions need ACID guarantees. Audio files stay in object storage/CDN — the database only stores pointers and social graph edges.",
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Database', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Auth Service \u2192 Database.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Database added. Now transcoding workers.',
            },
          },
          hints: ['Search for "Database"', 'Connect Auth Service to it'],
        }),
        step({
          component: 'Transcoding Worker',
          nodeType: 'transcoding_worker',
          parent: 'Audio CDN',
          phases: {
            context: {
              heading: 'Level 1: Step 8',
              body: 'Adding the Transcoding Worker — converts master audio into Ogg Vorbis and AAC bitrates.',
            },
            intro: {
              heading: 'Do you know about Transcoding Workers?',
              body: 'Workers transform uploaded masters into every bitrate the client might request.',
            },
            teaching: {
              heading: 'Deep dive: Transcoding Worker',
              body: "New podcast episodes and user uploads enter a GPU/CPU farm that produces 96kbps through 320kbps streams. Without transcoding, playback would fail on cellular networks.",
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Transcoding', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Audio CDN \u2192 Transcoding Worker.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Transcoding Worker added. Your Spotify architecture is complete!',
            },
          },
          hints: ['Search for "Transcoding"', 'Connect Audio CDN to it'],
        }),
      ],
    }),
  ],
});

export default spotifyTutorial;
