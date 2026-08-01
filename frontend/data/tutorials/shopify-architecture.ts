import { defineTutorial, level, step } from '@/lib/tutorial/builder';

const shopifyTutorial = defineTutorial({
  id: 'shopify-architecture',
  title: 'How to Design Shopify Architecture',
  description: 'Build an e-commerce platform for 2 million merchants processing $235B in annual sales. Learn cart management, inventory locking, checkout flows, payment processing, and Black Friday traffic spikes.',
  difficulty: 'intermediate',
  estimatedMinutes: 30,
  tags: ['e-commerce', 'payments', 'inventory'],
  icon: 'ShoppingCart',
  color: '#96BF48',

  levels: [
    level({
      title: 'E-Commerce Platform',
      steps: [
        step({
          component: 'Web Client',
          nodeType: 'client_web',
          phases: {
            context: {
              heading: 'Welcome to Shopify Architecture',
              body: "Let's build Shopify from scratch. 2 million merchants, $235 billion in annual sales, and a Black Friday peak of 4.2 million orders per hour.",
            },
            intro: {
              heading: 'Do you know about Web Clients?',
              body: "Shopify's web client is the storefront \u2014 the customer-facing shop handling product browsing, cart management, and checkout.",
            },
            teaching: {
              heading: 'Deep dive: Web Client',
              body: "Shopify powers 2 million storefronts, each with a unique domain and theme. A 1-second delay in page load reduces conversions by 7%.",
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
              body: 'Web Client added. Now the CDN.',
            },
          },
          hints: ['Press \u2318K to open component search', 'Search for "Web Client"'],
        }),
        step({
          component: 'CDN',
          nodeType: 'cdn',
          parent: 'Web Client',
          phases: {
            context: {
              heading: 'Level 1: Step 2',
              body: 'Adding the CDN \u2014 serves storefront assets from edge locations.',
            },
            intro: {
              heading: 'Do you know about CDNs?',
              body: "Shopify's CDN serves storefront assets \u2014 product images, CSS, JavaScript \u2014 from edge locations worldwide.",
            },
            teaching: {
              heading: 'Deep dive: CDN',
              body: "When a merchant uploads a 5MB product photo, Shopify stores the original and generates thumbnails lazily. The CDN serves the right size for each device.",
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'CDN', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Web Client \u2192 CDN.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'CDN added. Now the API Gateway.',
            },
          },
          hints: ['Search for "CDN"', 'Connect Web Client to it'],
        }),
        step({
          component: 'API Gateway',
          nodeType: 'api_gateway',
          parent: 'Web Client',
          phases: {
            context: {
              heading: 'Level 1: Step 3',
              body: 'Adding the API Gateway \u2014 handles storefront API requests with per-merchant rate limiting.',
            },
            intro: {
              heading: 'Do you know about API Gateways?',
              body: "Shopify's API Gateway enforces API rate limits per merchant \u2014 a merchant's app can't hammer the API and affect other merchants.",
            },
            teaching: {
              heading: 'Deep dive: API Gateway',
              body: "Shopify uses a leaky bucket rate limiter: each merchant gets 40 API calls per second. The gateway tracks usage per merchant, not per IP.",
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
              body: 'Adding the Load Balancer \u2014 distributes traffic with pre-scaling for Black Friday.',
            },
            intro: {
              heading: 'Do you know about Load Balancers?',
              body: "Shopify's Load Balancer distributes requests across service instances with pre-scaling for traffic spikes.",
            },
            teaching: {
              heading: 'Deep dive: Load Balancer',
              body: "Shopify pre-scales for Black Friday \u2014 they don't wait for traffic to spike before adding capacity. Flash sale drills run throughout the year.",
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
              body: 'Load Balancer added. Now the Cart Service.',
            },
          },
          hints: ['Search for "Load Balancer"', 'Connect API Gateway to it'],
        }),
        step({
          component: 'Cart Service',
          nodeType: 'cart_service',
          parent: 'Load Balancer',
          phases: {
            context: {
              heading: 'Level 1: Step 5',
              body: 'Adding the Cart Service \u2014 manages shopping carts in Redis.',
            },
            intro: {
              heading: 'Do you know about Cart Services?',
              body: 'The Cart Service manages shopping carts stored in Redis for sub-millisecond reads.',
            },
            teaching: {
              heading: 'Deep dive: Cart Service',
              body: "Every time you add an item, change quantity, or apply a discount code, the Cart Service updates Redis. Carts expire after 30 days of inactivity.",
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Cart Service', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Load Balancer \u2192 Cart Service.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Cart Service added. Tutorial complete! You have built Shopify.',
            },
          },
          hints: ['Search for "Cart Service"', 'Connect Load Balancer to it'],
        }),
      ],
    }),
  ],
});

export default shopifyTutorial;
