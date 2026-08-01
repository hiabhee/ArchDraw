import { defineTutorial, level, step } from '@/lib/tutorial/builder';

const netflixTutorial = defineTutorial({
  id: 'netflix-architecture',
  title: 'How to Design Netflix Architecture',
  description: 'Build the streaming platform that serves 270M subscribers. Learn CDN-first design, distributed encoding, and ML-powered recommendations.',
  difficulty: 'advanced',
  estimatedMinutes: 60,
  tags: ['streaming', 'cdn', 'recommendations'],
  icon: 'Play',
  color: '#E50914',

  levels: [
    level({
      title: 'The Foundation',
      steps: [
        step({
          component: 'Web Client',
          nodeType: 'client_web',
          phases: {
            context: { heading: 'Welcome to Netflix Architecture', body: 'Level 1: The foundation. What does a system need to stream video to 270 million subscribers?' },
            intro: { heading: 'Do you know about Web Clients?', body: "Netflix's client runs on 2,000+ device types." },
            teaching: { heading: 'Deep dive: Web Client', body: "Netflix's client runs on 2,000+ device types \u2014 Smart TVs, phones, tablets, browsers, and game consoles. Each implements adaptive bitrate streaming." },
            action: { heading: 'Your turn!', body: "Press \u2318K and search for 'Web Client' to add the client." },
            connecting: { heading: 'Connect it up', body: 'This is the first step, no connections needed yet.' },
            celebration: { heading: 'Great job!', body: 'Client added. Now the routing layer.' },
          },
          hints: ['Search for "Web Client"', 'Add Web Client to canvas'],
        }),
        step({
          component: 'DNS',
          nodeType: 'dns',
          parent: 'Web Client',
          phases: {
            context: { heading: 'Level 1: Step 2', body: 'Adding DNS and CDN for global content delivery.' },
            intro: { heading: 'Do you know about DNS and CDN?', body: 'DNS routes requests, CDN delivers content from edge servers.' },
            teaching: { heading: 'Deep dive: DNS and CDN', body: "Netflix's Open Connect CDN has 15,000+ servers embedded inside ISPs worldwide. 94% of Netflix traffic is served from these edge nodes." },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'DNS', and add it." },
            connecting: { heading: 'Connect it up', body: 'Connect Web Client \u2192 DNS.' },
            celebration: { heading: 'Great job!', body: 'DNS and CDN added. Now the API layer.' },
          },
          hints: ['Search for "DNS"', 'Connect Web Client to DNS'],
        }),
        step({
          component: 'API Gateway',
          nodeType: 'api_gateway',
          parent: 'DNS',
          phases: {
            context: { heading: 'Level 1: Step 3', body: 'Adding the API Gateway for handling non-video requests.' },
            intro: { heading: 'Do you know about API Gateways?', body: 'API Gateways route, authenticate, and rate-limit API calls.' },
            teaching: { heading: 'Deep dive: API Gateway', body: "Netflix's Zuul API Gateway handles all non-video requests \u2014 login, search, watchlist, recommendations. It routes, authenticates, and rate-limits billions of API calls per day." },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'API Gateway', and add it." },
            connecting: { heading: 'Connect it up', body: 'Connect DNS \u2192 API Gateway.' },
            celebration: { heading: 'Great job!', body: 'API Gateway added. Now the auth layer.' },
          },
          hints: ['Search for "API Gateway"', 'Connect DNS to it'],
        }),
        step({
          component: 'Auth Service',
          nodeType: 'auth_service',
          parent: 'API Gateway',
          phases: {
            context: { heading: 'Level 1: Step 4', body: 'Adding the Auth Service for token validation.' },
            intro: { heading: 'Do you know about Auth Services?', body: 'Auth Services validate tokens and check subscription status.' },
            teaching: { heading: 'Deep dive: Auth Service', body: "Netflix's Auth Service validates OAuth tokens, checks subscription plans, and counts active streams in real time. It enforces concurrent stream limits." },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Auth Service', and add it." },
            connecting: { heading: 'Connect it up', body: 'Connect API Gateway \u2192 Auth Service.' },
            celebration: { heading: 'Great job!', body: 'Auth Service added. Now the user data layer.' },
          },
          hints: ['Search for "Auth Service"', 'Connect API Gateway to it'],
        }),
        step({
          component: 'Load Balancer',
          nodeType: 'load_balancer',
          parent: 'API Gateway',
          phases: {
            context: { heading: 'Level 1: Step 5', body: 'Adding Load Balancer for distributing traffic.' },
            intro: { heading: 'Do you know about Load Balancers?', body: 'Load balancers distribute traffic across multiple servers.' },
            teaching: { heading: 'Deep dive: Load Balancer', body: "Netflix's Load Balancer distributes API requests across thousands of application servers, enabling horizontal scaling." },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Load Balancer', and add it." },
            connecting: { heading: 'Connect it up', body: 'Connect API Gateway \u2192 Load Balancer.' },
            celebration: { heading: 'Great job!', body: 'Load Balancer added. Now the streaming layer.' },
          },
          hints: ['Search for "Load Balancer"', 'Connect API Gateway to it'],
        }),
        step({
          component: 'Streaming Service',
          nodeType: 'microservice',
          parent: 'Load Balancer',
          phases: {
            context: { heading: 'Level 1: Step 6', body: 'Adding the Streaming Service for video delivery.' },
            intro: { heading: 'Do you know about Streaming Services?', body: 'Streaming services generate pre-signed URLs for video segments.' },
            teaching: { heading: 'Deep dive: Streaming Service', body: 'The Streaming Service generates time-limited pre-signed URLs for video segments \u2014 a URL that grants access for only 60 seconds.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Streaming Service', and add it." },
            connecting: { heading: 'Connect it up', body: 'Connect Load Balancer \u2192 Streaming Service.' },
            celebration: { heading: 'Great job!', body: 'Streaming Service added. Now the storage layer.' },
          },
          hints: ['Search for "Streaming Service"', 'Connect Load Balancer to it'],
        }),
        step({
          component: 'Object Storage',
          nodeType: 'object_storage',
          parent: 'Streaming Service',
          phases: {
            context: { heading: 'Level 1: Step 7', body: 'Adding Object Storage for video files.' },
            intro: { heading: 'Do you know about Object Storage?', body: 'Object storage holds large amounts of unstructured data.' },
            teaching: { heading: 'Deep dive: Object Storage', body: 'Object Storage holds petabytes of encoded video files. Netflix stores every title in 120+ different formats.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Object Storage', and add it." },
            connecting: { heading: 'Connect it up', body: 'Connect Streaming Service \u2192 Object Storage.' },
            celebration: { heading: 'Level 1 Complete!', body: 'You have a working Netflix streaming foundation!' },
          },
          hints: ['Search for "Object Storage"', 'Connect Streaming Service to it'],
        }),
      ],
    }),
    level({
      title: 'Production Ready',
      steps: [
        step({ component: 'User Service', nodeType: 'user_service', parent: 'Auth Service' }),
        step({ component: 'SQL Database', nodeType: 'sql_db', parent: 'User Service' }),
        step({ component: 'Recommendation Engine',           nodeType: 'recommendation_service', parent: 'User Service' }),
      ],
    }),
    level({
      title: 'Expert Architecture',
      steps: [
        step({ component: 'Worker', nodeType: 'worker_job', parent: 'Object Storage' }),
        step({ component: 'Content Catalog', nodeType: 'data_catalog', parent: 'API Gateway' }),
      ],
    }),
  ],
});

export default netflixTutorial;
