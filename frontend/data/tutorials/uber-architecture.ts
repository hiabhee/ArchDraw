import { defineTutorial, level, step } from '@/lib/tutorial/builder';

const uberTutorial = defineTutorial({
  id: 'uber-architecture',
  title: 'How to Design Uber Architecture',
  description: 'Build the two-sided ride-hailing platform that matches 25 million trips daily. Learn real-time geospatial matching, surge pricing, and distributed systems at global scale.',
  difficulty: 'advanced',
  estimatedMinutes: 65,
  tags: ['ride-hailing', 'geospatial', 'marketplace'],
  icon: 'Car',
  color: '#000000',

  levels: [
    level({
      title: 'The Foundation',
      steps: [
        step({
          component: 'Rider App',
          nodeType: 'client_mobile',
          noConnect: true,
          title: 'Add the Rider App',
          phases: {
            context: { heading: 'Welcome to Uber Architecture', body: 'Uber handles 25 million trips daily across 70 countries. The architecture must match riders to drivers in under 5 seconds while handling millions of location updates per second.' },
            intro: { heading: 'About the Rider App', body: 'The rider app is the primary entry point — riders open it to request a ride, track the driver, and pay.' },
            teaching: { heading: 'Deep dive: Rider App', body: 'The Rider App is a native iOS/Android app that captures GPS coordinates 4x per second, sends pickup requests with destination, and displays real-time driver positions. It handles offline-first patterns (showing cached map tiles when network drops) and must work seamlessly across cellular handoffs during a ride. Without a reliable rider app, the entire marketplace collapses — no requests means no trips.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Mobile', and add the Rider App." },
            connecting: { heading: 'Connect it up', body: 'First step — no connections yet.' },
            celebration: { heading: 'Great job!', body: 'Rider App added. Now the Driver App.' },
          },
          hints: ['Search for "Mobile"'],
        }),
        step({
          component: 'Driver App',
          nodeType: 'driver_app',
          noConnect: true,
          title: 'Add the Driver App',
          phases: {
            context: { heading: 'Step 2: Driver App', body: 'Uber has 5.4 million active drivers. Each driver runs a separate app that manages their availability, trip accept/decline, navigation, and earnings.' },
            intro: { heading: 'About the Driver App', body: 'The driver app lets drivers go online, accept trip requests, navigate to pickups, and track earnings in real-time.' },
            teaching: { heading: 'Deep dive: Driver App', body: 'The Driver App broadcasts the driver\'s GPS position every 4 seconds when online. It must handle poor cellular connectivity (drivers in tunnels, parking garages) with offline-first queuing — location updates are batched and sent when connectivity returns. The app also manages the critical trip state machine: idle \u2192 trip request \u2192 en route \u2192 arrived \u2192 in progress \u2192 completed.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Driver', and add the Driver App." },
            connecting: { heading: 'Connect it up', body: 'First step — no connections yet. This is the second entry point into the system.' },
            celebration: { heading: 'Great job!', body: 'Driver App added. Both sides of the marketplace are ready.' },
          },
          hints: ['Search for "Driver"'],
        }),
        step({
          component: 'API Gateway',
          nodeType: 'api_gateway',
          parents: ['Rider App', 'Driver App'],
          phases: {
            context: { heading: 'Step 3: API Gateway', body: 'Every request from both apps — ride requests, location pings, payment confirmations — flows through the API Gateway.' },
            intro: { heading: 'About API Gateways', body: 'API gateways route requests, enforce rate limits, authenticate tokens, and load-balance across microservices.' },
            teaching: { heading: 'Deep dive: API Gateway', body: 'Uber\'s API Gateway handles 2 million requests per second. It authenticates driver/rider tokens, routes location updates to the Location Service, trip requests to the Matching Service, and payment flows to the Payment Service. It enforces per-user rate limits and applies circuit breakers to prevent cascading failures when downstream services degrade.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'API Gateway', and add it." },
            connecting: { heading: 'Connect it up', body: 'Connect Rider App \u2192 API Gateway and Driver App \u2192 API Gateway. Both apps route through the same gateway.' },
            celebration: { heading: 'Great job!', body: 'API Gateway added and connected to both apps.' },
          },
          hints: ['Search for "API Gateway"', 'Connect both apps to it'],
        }),
        step({
          component: 'Matching Service',
          nodeType: 'matching_service',
          parent: 'API Gateway',
          phases: {
            context: { heading: 'Step 4: Matching Service', body: 'The Matching Service is Uber\'s core brain — it finds the best driver for each rider request in under 5 seconds.' },
            intro: { heading: 'About Matching Services', body: 'Matching services implement algorithms that pair supply (drivers) with demand (riders) based on proximity, direction, and predicted wait time.' },
            teaching: { heading: 'Deep dive: Matching Service', body: 'When a rider requests a trip, the Matching Service queries a geospatial index (H3 hexagonal grid) to find nearby available drivers within a configurable radius. It scores each candidate by straight-line distance, current heading (moving toward pickup vs away), and predicted arrival time. The best match is offered the trip with a 15-second accept window. If declined, the next candidate is offered. This entire loop must complete in <5 seconds or the rider abandons the request.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Microservice', and add the Matching Service." },
            connecting: { heading: 'Connect it up', body: 'Connect API Gateway \u2192 Matching Service.' },
            celebration: { heading: 'Great job!', body: 'Matching Service added.' },
          },
          hints: ['Search for "Microservice"', 'Connect API Gateway to it'],
        }),
        step({
          component: 'Location Service',
          nodeType: 'microservice',
          parent: 'Matching Service',
          phases: {
            context: { heading: 'Step 5: Location Service', body: 'Uber processes 100 million location updates per second. The Location Service stores and indexes every driver position in real-time.' },
            intro: { heading: 'About Location Services', body: 'Location services manage geospatial data — storing positions, querying nearby points, and computing routes.' },
            teaching: { heading: 'Deep dive: Location Service', body: 'The Location Service uses an H3 hexagonal spatial index (developed by Uber) to partition the world into hierarchical cells. Each driver\'s GPS position is mapped to an H3 cell at resolution 9 (hexagon area ~250m\u00B2). This enables O(1) lookups of "all drivers within 5km of coordinates (x,y)" instead of scanning millions of records. Without this geospatial index, matching would take seconds instead of milliseconds.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Microservice', and add the Location Service." },
            connecting: { heading: 'Connect it up', body: 'Connect Matching Service \u2192 Location Service.' },
            celebration: { heading: 'Great job!', body: 'Location Service added.' },
          },
          hints: ['Search for "Microservice"', 'Connect Matching Service to it'],
        }),
        step({
          component: 'Maps API',
          nodeType: 'external_service',
          parent: 'Location Service',
          phases: {
            context: { heading: 'Step 6: Maps API', body: 'The Maps API provides routing, ETA estimation, and map tile rendering for both rider and driver apps.' },
            intro: { heading: 'About Maps APIs', body: 'Maps APIs provide geocoding, routing, ETA calculation, and map tile rendering services.' },
            teaching: { heading: 'Deep dive: Maps API', body: 'Uber\'s Maps API pre-computes road network graphs for every city, enabling sub-50ms route calculations. It provides real-time ETAs by combining static road data with live traffic conditions. When a rider sees "Driver arriving in 4 minutes", that ETA is computed by the Maps API using current traffic on every road segment between the driver and pickup point. Uber also uses its own road data (not Google Maps) in many markets to avoid dependency on a single provider.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'External', and add the Maps API." },
            connecting: { heading: 'Connect it up', body: 'Connect Location Service \u2192 Maps API.' },
            celebration: { heading: 'Great job!', body: 'Maps API added.' },
          },
          hints: ['Search for "External"', 'Connect Location Service to it'],
        }),
        step({
          component: 'SQL Database',
          nodeType: 'sql_db',
          parent: 'Matching Service',
          phases: {
            context: { heading: 'Step 7: SQL Database', body: 'Trip records, driver earnings, and payment transactions need ACID guarantees — a SQL database is required for financial consistency.' },
            intro: { heading: 'About SQL Databases', body: 'SQL databases provide ACID transactions for critical data like financial records, user accounts, and trip histories.' },
            teaching: { heading: 'Deep dive: SQL Database', body: 'The SQL Database stores trip records (pickup/dropoff, fare, driver/rider IDs), driver earnings, and payment transactions. Every completed trip must be recorded atomically — the fare deduction from rider, commission deduction, and driver payout must all succeed or all fail. NoSQL cannot guarantee this level of financial consistency, which is why Uber uses PostgreSQL for its trip and payment datastores.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'SQL Database', and add it." },
            connecting: { heading: 'Connect it up', body: 'Connect Matching Service \u2192 SQL Database.' },
            celebration: { heading: 'Level 1 Complete!', body: 'You have a working ride-hailing foundation!' },
          },
          hints: ['Search for "SQL Database"', 'Connect Matching Service to it'],
        }),
      ],
    }),
    level({
      title: 'Production Ready',
      steps: [
        step({
          component: 'Load Balancer',
          nodeType: 'load_balancer',
          parent: 'API Gateway',
          phases: {
            context: { heading: 'Level 2: Load Balancer', body: 'During Friday evening rush, Uber traffic spikes 5x. The Load Balancer distributes requests across multiple API Gateway instances to prevent overload.' },
            intro: { heading: 'About Load Balancers', body: 'Load balancers distribute incoming requests across multiple server instances to ensure no single server is overwhelmed.' },
            teaching: { heading: 'Deep dive: Load Balancer', body: 'The Load Balancer uses consistent hashing to route driver location updates to the same server (maintaining affinity) while distributing trip requests across all available servers. During peak hours (Friday 5-7pm), Uber processes 10x normal traffic — without load balancing, the API Gateway would fail under the load. Uber uses Envoy as its load balancer, which supports advanced features like locality-aware routing and automatic retry with circuit breaking.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Load Balancer', and add it." },
            connecting: { heading: 'Connect it up', body: 'Connect API Gateway \u2192 Load Balancer.' },
            celebration: { heading: 'Great job!', body: 'Load Balancer added.' },
          },
          hints: ['Search for "Load Balancer"', 'Connect API Gateway to it'],
        }),
      ],
    }),
    level({
      title: 'Expert Architecture',
      steps: [
        step({
          component: 'Surge Pricing',
          nodeType: 'surge_pricing',
          parent: 'Matching Service',
          phases: {
            context: { heading: 'Level 3: Surge Pricing', body: 'Surge pricing is Uber\'s real-time supply-demand balancing mechanism. When demand exceeds supply, prices increase to attract more drivers and reduce demand.' },
            intro: { heading: 'About Surge Pricing', body: 'Surge pricing dynamically adjusts fares based on real-time supply and demand in each geographic area.' },
            teaching: { heading: 'Deep dive: Surge Pricing', body: 'The Surge Pricing engine continuously analyzes the supply-demand ratio in each H3 hexagonal cell. When rider requests exceed available drivers in a cell, prices increase by a multiplier (1.2x to 5x+). This serves two purposes: it reduces demand (some riders choose to wait or take alternatives) and increases supply (drivers are incentivized to move to high-surge areas). The pricing model uses machine learning to predict optimal surge multipliers based on historical patterns, current weather, and local events.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Serverless Function', and add Surge Pricing." },
            connecting: { heading: 'Connect it up', body: 'Connect Matching Service \u2192 Surge Pricing.' },
            celebration: { heading: 'Great job!', body: 'Surge Pricing added. Your Uber architecture is complete!' },
          },
          hints: ['Search for "Serverless Function"', 'Connect Matching Service to it'],
        }),
      ],
    }),
  ],
});

export default uberTutorial;
