import { defineTutorial, level, step } from '@/lib/tutorial/builder';

const openclawTutorial = defineTutorial({
  id: 'openclaw-architecture',
  title: 'How to Design OpenClaw Architecture',
  description: 'Build a subscription analytics platform. Learn event ingestion, Kafka streaming, analytics computation, cohort retention, and metrics visualization at scale.',
  difficulty: 'intermediate',
  estimatedMinutes: 15,
  tags: ['analytics', 'subscription', 'metrics'],
  icon: 'BarChart',
  color: '#6366F1',

  levels: [
    level({
      title: 'The Foundation',
      steps: [
        step({
          component: 'Mobile Client',
          nodeType: 'client_mobile',
          phases: {
            context: {
              heading: 'Welcome to OpenClaw Architecture',
              body: "Let's build OpenClaw from scratch. Level 1 is the foundation \u2014 a system that ingests subscription events, stores them durably, and streams them for downstream processing.",
            },
            intro: {
              heading: 'Do you know about Mobile Clients?',
              body: 'The Mobile Client is the iOS or Android app where analysts check subscription metrics on the go.',
            },
            teaching: {
              heading: 'Deep dive: Mobile Client',
              body: "OpenClaw's mobile app lets executives check MRR, churn rates, and retention metrics from anywhere without being tied to a desktop.",
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Mobile', and add the mobile client.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'This is the first step, so no connections needed yet.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Mobile Client added. Now the Web Client.',
            },
          },
          hints: ['Press \u2318K to open component search', 'Search for "Mobile"'],
        }),
        step({
          component: 'Web Client',
          nodeType: 'client_web',
          phases: {
            context: {
              heading: 'Level 1: Step 2',
              body: 'Adding the Web Client \u2014 the browser-based dashboard.',
            },
            intro: {
              heading: 'Do you know about Web Clients?',
              body: "The Web Client is the browser-based dashboard where analysts build custom reports and set up alerts.",
            },
            teaching: {
              heading: 'Deep dive: Web Client',
              body: "OpenClaw's web dashboard is where analysts build reports, filter by cohort, and export CSVs. Mobile is the executive summary view.",
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Web', and add the web client.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'This is the second client, so no connections needed yet.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Web Client added. Now the API Gateway.',
            },
          },
          hints: ['Search for "Web"'],
        }),
        step({
          component: 'API Gateway',
          nodeType: 'api_gateway',
          parents: ['Mobile Client', 'Web Client'],
          phases: {
            context: {
              heading: 'Level 1: Step 3',
              body: 'Adding the API Gateway \u2014 the single entry point.',
            },
            intro: {
              heading: 'Do you know about API Gateways?',
              body: "The API Gateway is the single entry point for all dashboard queries and SDK event ingestion from payment processors.",
            },
            teaching: {
              heading: 'Deep dive: API Gateway',
              body: "It is the front door for both data coming in from payment processors (Stripe, Chargebee) and queries coming from the dashboard.",
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'API Gateway', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Mobile Client \u2192 API Gateway, then Web Client \u2192 API Gateway.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'API Gateway added. Tutorial complete! You have built OpenClaw.',
            },
          },
          hints: ['Search for "API Gateway"', 'Connect both clients to it'],
        }),
      ],
    }),
  ],
});

export default openclawTutorial;
