import { defineTutorial, level, step } from '@/lib/tutorial/builder';

const doordashTutorial = defineTutorial({
  id: 'doordash-architecture',
  title: 'How to Design DoorDash Architecture',
  description: 'Build a food delivery platform completing 2 billion deliveries annually. Learn real-time order routing, dasher dispatch, ETA prediction, geofencing, and the three-sided marketplace problem.',
  difficulty: 'intermediate',
  estimatedMinutes: 40,
  tags: ['delivery', 'geospatial', 'marketplace'],
  icon: 'Car',
  color: '#FF3008',

  levels: [
    level({
      title: 'Food Delivery Platform',
      description: 'The request path: customer app, gateway, pre-scaled load balancing, and auth for all three account types.',
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
              whyItMatters: 'The customer app is the ordering surface \u2014 if browsing and checkout are slow, the whole marketplace starves.',
              tradeoff: 'Three client surfaces (customer, dasher, merchant) each have different needs. One shared API must serve all three without favoring any.',
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
              body: 'One gateway handles requests from the customer app, Dasher app, and merchant tablet.',
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
              heading: 'Adding the Load Balancer',
              body: 'Traffic spikes at lunch and dinner are predictable \u2014 DoorDash pre-scales before the rush.',
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
              heading: 'Adding the Auth Service',
              body: 'Three account types with very different onboarding \u2014 customers are instant, dashers take days.',
            },
            intro: {
              heading: 'Do you know about Auth Services?',
              body: "DoorDash's Auth Service handles customer accounts, Dasher onboarding with background checks, and merchant authentication.",
            },
            teaching: {
              heading: 'Deep dive: Auth Service',
              body: "Customer signup is instant. Dasher onboarding takes days: identity verification, background check, vehicle registration, and insurance verification.",
              whyItMatters: 'The marketplace only works if each actor is authenticated correctly \u2014 a fake dasher or compromised merchant account can break the delivery chain.',
              tradeoff: 'Strict dasher verification is safer but slows supply growth; frictionless signup grows supply but invites fraud. DoorDash accepts a longer onboarding pipeline for dashers.',
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
              body: 'Auth Service added. Level 1 complete \u2014 on to ordering and dispatch.',
            },
          },
          hints: ['Search for "Auth Service"', 'Connect Load Balancer to it'],
        }),
      ],
    }),
    level({
      title: 'Ordering & Dispatch',
      description: 'The core marketplace loop: take an order, find the best dasher, and track everyone in real time.',
      steps: [
        step({
          component: 'Order Service',
          nodeType: 'order_service',
          parent: 'API Gateway',
          phases: {
            context: {
              heading: 'Adding the Order Service',
              body: 'Every order goes through the Order Service \u2014 cart, checkout, and lifecycle tracking.',
            },
            intro: {
              heading: 'Do you know about Order Services?',
              body: 'The Order Service owns the order lifecycle: placed, confirmed, in transit, delivered, and the failure paths in between.',
            },
            teaching: {
              heading: 'Deep dive: Order Service',
              body: "The Order Service records every order, drives its state machine, and coordinates the other actors \u2014 restaurant confirmation, dasher assignment, and payment capture. It is the single source of truth for 'what is this order doing right now'.",
              whyItMatters: 'The order is the core entity of the marketplace. If the Order Service loses state, customers lose food and money simultaneously \u2014 the worst possible failure.',
              tradeoff: 'A strict state machine prevents contradictory transitions (delivered before accepted) but makes cancellation and refund edge cases painful to model.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Order Service', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect API Gateway \u2192 Order Service.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Order Service added. Now dispatch.',
            },
          },
          hints: ['Search for "Order Service"', 'Connect API Gateway to it'],
        }),
        step({
          component: 'Matching Service',
          nodeType: 'matching_service',
          parent: 'Order Service',
          phases: {
            context: {
              heading: 'Adding the Matching Service',
              body: 'The core optimization: assign each order to the best dasher in real time.',
            },
            intro: {
              heading: 'Do you know about Matching Services?',
              body: 'The Matching Service pairs incoming orders with nearby available dashers, optimizing for delivery time and dasher earnings.',
            },
            teaching: {
              heading: 'Deep dive: Matching Service',
              body: "When an order is confirmed, the Matching Service runs an assignment algorithm over nearby dashers, weighing distance, current load, restaurant prep time, and predicted pickup delay. It batches assignments every few seconds instead of one-by-one so dashers near the restaurant get chosen together.",
              whyItMatters: 'Assignment quality is the entire business: better matches mean faster deliveries, higher dasher utilization, and more orders completed per hour.',
              tradeoff: 'Optimizing per-order is fast but globally suboptimal \u2014 the near-optimal batch match takes more compute. There is a constant tradeoff between match latency and match quality.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Matching Service', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Order Service \u2192 Matching Service.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Matching Service added. Now the dasher side.',
            },
          },
          hints: ['Search for "Matching Service"', 'Connect Order Service to it'],
        }),
        step({
          component: 'Dasher Service',
          nodeType: 'dasher_service',
          parent: 'Matching Service',
          phases: {
            context: {
              heading: 'Adding the Dasher Service',
              body: 'Once a match is made, the Dasher Service manages the dasher through pickup and dropoff.',
            },
            intro: {
              heading: 'Do you know about Dasher Services?',
              body: 'The Dasher Service tracks dasher availability, assignments, earnings, and status transitions.',
            },
            teaching: {
              heading: 'Deep dive: Dasher Service',
              body: "The Dasher Service is the supply-side counterpart to the Order Service. It tracks every dasher's status \u2014 online, on an order, delivering \u2014 plus earnings, ratings, and zone availability. When a dasher accepts a match, this service drives them through pickup, in-transit, and dropoff.",
              whyItMatters: 'Supply visibility is what makes matching possible. A dasher service that loses a dasher\u2019s status strands orders mid-delivery.',
              tradeoff: 'Dasher state changes come from a mobile app on flaky cellular networks \u2014 every status update needs idempotency and retry, or a missed "delivered" update breaks the next assignment.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Dasher Service', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Matching Service \u2192 Dasher Service.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Dasher Service added. Now location tracking.',
            },
          },
          hints: ['Search for "Dasher Service"', 'Connect Matching Service to it'],
        }),
        step({
          component: 'Location Service',
          nodeType: 'location_service',
          parent: 'Dasher Service',
          phases: {
            context: {
              heading: 'Adding the Location Service',
              body: 'Every active dasher streams location updates. The Location Service ingests millions of them per minute.',
            },
            intro: {
              heading: 'Do you know about Location Services?',
              body: 'Location services ingest high-frequency GPS updates and expose live positions for tracking and dispatch.',
            },
            teaching: {
              heading: 'Deep dive: Location Service',
              body: "Dasher apps push GPS coordinates every few seconds. The Location Service absorbs this high write volume and serves live positions for the customer's tracking map, ETA calculation, and dispatch. It uses spatial indexing so 'which dashers are near this restaurant?' is a fast geospatial query.",
              whyItMatters: 'Live location is what lets customers watch their food approach and lets dispatch find nearby dashers. Without it, ETAs and tracking are guesswork.',
              tradeoff: 'Every-second GPS from every dasher is enormous write volume. Throttle updates by movement and speed, or storage and network costs explode.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Location Service', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Dasher Service \u2192 Location Service.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Location Service added. Level 2 complete \u2014 on to geo, payments, and scale.',
            },
          },
          hints: ['Search for "Location Service"', 'Connect Dasher Service to it'],
        }),
      ],
    }),
    level({
      title: 'Geo, Payments & Scale',
      description: 'Navigation, ETA prediction, payments, and the async plumbing that keeps the marketplace humming.',
      steps: [
        step({
          component: 'Maps API',
          nodeType: 'maps_api',
          parent: 'Location Service',
          phases: {
            context: {
              heading: 'Adding the Maps API',
              body: 'Routing, geocoding, and turn-by-turn navigation come from a maps provider.',
            },
            intro: {
              heading: 'Do you know about Maps APIs?',
              body: 'Maps APIs provide geocoding, routing, and navigation \u2014 the roads between the restaurant and the customer.',
            },
            teaching: {
              heading: 'Deep dive: Maps API',
              body: "The Maps API gives the dasher app turn-by-turn navigation and gives the system the actual road distance between pickup and dropoff \u2014 which is what ETAs are built on, not straight-line distance.",
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Maps API', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Location Service \u2192 Maps API.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Maps API added. Now the ETA service.',
            },
          },
          hints: ['Search for "Maps API"', 'Connect Location Service to it'],
        }),
        step({
          component: 'ETA Service',
          nodeType: 'eta_service',
          parent: 'Matching Service',
          phases: {
            context: {
              heading: 'Adding the ETA Service',
              body: 'The promise you make to customers \u2014 "arrives by 6:42" \u2014 comes from the ETA Service.',
            },
            intro: {
              heading: 'Do you know about ETA Services?',
              body: 'ETA services combine restaurant prep time, route distance, traffic, and dasher location into a live prediction.',
            },
            teaching: {
              heading: 'Deep dive: ETA Service',
              body: "The ETA Service predicts each leg of the journey \u2014 prep time, dasher arrival at restaurant, travel time \u2014 using ML over historical data and live conditions. It updates continuously as conditions change, and the customer sees 'your order is running late' when the model drifts.",
              whyItMatters: 'The ETA is the promise the brand is built on. Missed ETAs erode trust and drive refunds \u2014 this is the single most customer-visible number.',
              tradeoff: 'Accurate ETAs need live signals that cost compute and API calls; a simpler model is cheaper but misses less predictable delays (traffic, prep).',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'ETA Service', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Matching Service \u2192 ETA Service.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'ETA Service added. Now payments.',
            },
          },
          hints: ['Search for "ETA Service"', 'Connect Matching Service to it'],
        }),
        step({
          component: 'Payment Gateway',
          nodeType: 'payment_gateway',
          parent: 'Order Service',
          phases: {
            context: {
              heading: 'Adding the Payment Gateway',
              body: 'Charging customers, paying dashers, and splitting with merchants \u2014 all through the payment gateway.',
            },
            intro: {
              heading: 'Do you know about Payment Gateways?',
              body: 'Payment gateways authorize and settle card payments while abstracting PCI compliance.',
            },
            teaching: {
              heading: 'Deep dive: Payment Gateway',
              body: "When an order is placed, the Payment Gateway authorizes the card. When it is delivered, it captures the funds. It also powers dasher payouts and merchant settlement \u2014 the marketplace's three-way money flow.",
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Payment Gateway', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Order Service \u2192 Payment Gateway.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Payment Gateway added. Final step \u2014 async plumbing.',
            },
          },
          hints: ['Search for "Payment Gateway"', 'Connect Order Service to it'],
        }),
        step({
          component: 'Message Queue',
          nodeType: 'message_queue',
          parent: 'Order Service',
          phases: {
            context: {
              heading: 'Adding the Message Queue',
              body: 'Order events \u2014 placed, accepted, in transit \u2014 fan out to many consumers without slowing the order path.',
            },
            intro: {
              heading: 'Do you know about Message Queues?',
              body: 'Message queues decouple event producers from consumers so each service scales independently.',
            },
            teaching: {
              heading: 'Deep dive: Message Queue',
              body: "Every order transition publishes an event to the queue. Consumers update analytics, notify the customer app, trigger dasher payouts, and refresh tracking. The Order Service publishes once and never waits for consumers.",
              whyItMatters: 'Order transitions happen under real-time pressure. Blocking on notifications and analytics would add latency to every order event \u2014 the queue keeps the critical path fast.',
              tradeoff: 'Queue consumers lag under spikes and events may duplicate. Idempotent consumers and lag monitoring are required or order events double-process.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Message Queue', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Order Service \u2192 Message Queue.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Message Queue added. You have built DoorDash \u2014 the complete food delivery marketplace.',
            },
          },
          hints: ['Search for "Message Queue"', 'Connect Order Service to it'],
        }),
      ],
    }),
  ],
});

export default doordashTutorial;
