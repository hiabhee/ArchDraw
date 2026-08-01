import { defineTutorial, level, step } from '@/lib/tutorial/builder';

const doordashTutorial = defineTutorial({
  id: 'doordash-architecture',
  title: 'How to Design DoorDash Architecture',
  description: 'Build a food delivery platform completing 2 billion deliveries annually. Learn real-time order routing, dasher dispatch, ETA prediction, geofencing, and the three-sided marketplace problem.',
  difficulty: 'intermediate',
  estimatedMinutes: 30,
  tags: ['delivery', 'geospatial', 'marketplace'],
  icon: 'Car',
  color: '#FF3008',

  levels: [
    level({
      title: 'Food Delivery Platform',
      steps: [
        step({
          component: 'Web Client',
          nodeType: 'client_web',
          phases: {
            context: {
              heading: 'Welcome to DoorDash Architecture',
              body: "Let's build DoorDash from scratch. 2 billion deliveries annually, 27 countries, and a real-time system that must predict your delivery time accurately.",
            },
            intro: {
              heading: 'Do you know about Web Clients?',
              body: "DoorDash has three clients: the customer app, the Dasher app, and the merchant tablet.",
            },
            teaching: {
              heading: 'Deep dive: Web Client',
              body: "DoorDash's hardest problem: predicting delivery time accurately. The ETA model runs in real-time using ML, traffic data, restaurant prep times, and dasher location.",
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
              heading: 'Level 1: Step 2',
              body: 'Adding the API Gateway \u2014 handles requests from all three client types.',
            },
            intro: {
              heading: 'Do you know about API Gateways?',
              body: "DoorDash's API Gateway handles requests from customer app, Dasher app, and merchant tablet.",
            },
            teaching: {
              heading: 'Deep dive: API Gateway',
              body: "A customer app can browse restaurants and place orders. A Dasher app can accept deliveries and update location. A merchant tablet can accept/reject orders.",
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
              heading: 'Level 1: Step 3',
              body: 'Adding the Load Balancer \u2014 distributes traffic with pre-scaling for meal rush.',
            },
            intro: {
              heading: 'Do you know about Load Balancers?',
              body: "DoorDash's Load Balancer distributes traffic with pre-scaling for predictable meal rush spikes.",
            },
            teaching: {
              heading: 'Deep dive: Load Balancer',
              body: "DoorDash traffic spikes at lunch (12pm) and dinner (6pm) every day \u2014 completely predictable. DoorDash pre-scales before these rushes.",
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
              heading: 'Level 1: Step 4',
              body: 'Adding the Auth Service \u2014 handles three account types with dasher onboarding.',
            },
            intro: {
              heading: 'Do you know about Auth Services?',
              body: "DoorDash's Auth Service handles customer accounts, Dasher onboarding with background checks, and merchant authentication.",
            },
            teaching: {
              heading: 'Deep dive: Auth Service',
              body: "Customer signup is instant. Dasher onboarding takes days: identity verification, background check, vehicle registration, and insurance verification.",
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
              body: 'Auth Service added. Tutorial complete! You have built DoorDash.',
            },
          },
          hints: ['Search for "Auth Service"', 'Connect Load Balancer to it'],
        }),
      ],
    }),
  ],
});

export default doordashTutorial;
