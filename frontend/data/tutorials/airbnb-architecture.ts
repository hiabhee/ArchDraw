import { defineTutorial, level, step } from '@/lib/tutorial/builder';

const airbnbTutorial = defineTutorial({
  id: 'airbnb-architecture',
  title: 'How to Design Airbnb Architecture',
  description: 'Build the global rental marketplace. Learn about geo-search, dynamic pricing, and two-sided trust systems.',
  difficulty: 'intermediate',
  estimatedMinutes: 45,
  tags: ['marketplace', 'geo-search', 'booking'],
  icon: 'Home',
  color: '#FF5A5F',

  levels: [
    level({
      title: 'Marketplace Foundation',
      steps: [
        step({
          component: 'Web Client',
          nodeType: 'client_web',
          noConnect: true,
          phases: {
            context: { heading: 'Welcome to Airbnb Architecture', body: 'Airbnb connects 4 million hosts with 150 million guests across 220 countries. The architecture must handle geo-search across millions of listings, dynamic pricing, and a two-sided trust system.' },
            intro: { heading: 'About the Web Client', body: 'The Airbnb web client is a search-first interface — guests search by location, dates, and filters to find listings from millions of options.' },
            teaching: { heading: 'Deep dive: Web Client', body: 'The Airbnb client renders a map-based search interface where guests see listings as pins on a map. As you pan/zoom, the client sends new boundary coordinates to the server and receives listings within the visible area. The client also handles the booking flow: date selection, price calculation (with cleaning fees, service fees, occupancy taxes), and payment. Without a performant geo-search client, guests would wait seconds for results to load while browsing a city.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Web Client', and add the Web Client." },
            connecting: { heading: 'Connect it up', body: 'First step — no connections yet.' },
            celebration: { heading: 'Great job!', body: 'Web Client added.' },
          },
          hints: ['Search for "Web"'],
        }),
        step({
          component: 'API Gateway',
          nodeType: 'api_gateway',
          parent: 'Web Client',
          phases: {
            context: { heading: 'Step 2: API Gateway', body: 'Search queries, booking requests, messaging, and reviews all route through the API Gateway.' },
            intro: { heading: 'About API Gateways', body: 'API gateways route requests, authenticate users, and provide a unified interface to multiple backend services.' },
            teaching: { heading: 'Deep dive: API Gateway', body: 'Airbnb\'s API Gateway handles 100 million API calls per day. It authenticates user sessions, routes geo-search queries to the Search Service, booking requests to the Booking Service, and message operations to the Messaging Service. The gateway implements request coalescing — if 50 users search "Paris" simultaneously, only one request hits the backend, and the cached response is shared. Without this coalescing, a trending destination could overwhelm the search infrastructure.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'API Gateway', and add it." },
            connecting: { heading: 'Connect it up', body: 'Connect Web Client \u2192 API Gateway.' },
            celebration: { heading: 'Great job!', body: 'API Gateway added.' },
          },
          hints: ['Search for "API Gateway"', 'Connect Web Client to it'],
        }),
        step({
          component: 'Search Service',
          nodeType: 'search_service',
          parent: 'API Gateway',
          phases: {
            context: { heading: 'Step 3: Search Service', body: 'The Search Service is Airbnb\'s most complex component — it must return relevant listings from 4 million options in under 200ms based on location, dates, price, and guest preferences.' },
            intro: { heading: 'About Search Services', body: 'Search services combine geo-spatial queries, text search, and machine learning ranking to return the most relevant results.' },
            teaching: { heading: 'Deep dive: Search Service', body: 'When you search "Paris, Dec 25-28, 2 guests", the Search Service: (1) filters by geo-bounds (listings within the visible map area), (2) filters by availability (dates not blocked), (3) filters by capacity (2+ guests), (4) ranks by a machine learning model trained on booking probability, review scores, and response rates. The ranking model uses a technique called "learning to rank" — it learns that listings with professional photos get 3x more bookings, and boosts them accordingly. Without ML ranking, search results would be chronological (newest first) instead of relevance-ranked.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Search Service', and add the Search Service." },
            connecting: { heading: 'Connect it up', body: 'Connect API Gateway \u2192 Search Service.' },
            celebration: { heading: 'Great job!', body: 'Search Service added.' },
          },
          hints: ['Search for "Search Service"', 'Connect API Gateway to it'],
        }),
      ],
    }),
    level({
      title: 'Production Ready',
      steps: [
        step({
          component: 'Database',
          nodeType: 'sql_db',
          parent: 'Search Service',
          phases: {
            context: { heading: 'Level 2: Database', body: 'Airbnb\'s database stores 4 million listings with properties (location, price, amenities, photos), availability calendars, and booking records.' },
            intro: { heading: 'About Databases', body: 'Databases store structured data with support for complex queries, filtering, and transactional integrity.' },
            teaching: { heading: 'Deep dive: Database', body: 'The Database stores listings with 200+ properties (location coordinates, price, amenities, house rules, cancellation policy), availability calendars (which dates are blocked), and booking records (guest, dates, payment status). It must support geo-spatial queries (find listings within 5km of Eiffel Tower) and date-range queries (find available listings Dec 25-28). Airbnb uses a combination of Elasticsearch for geo-search and MySQL for transactional booking data — each optimized for its access pattern.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Database', and add the Database." },
            connecting: { heading: 'Connect it up', body: 'Connect Search Service \u2192 Database.' },
            celebration: { heading: 'Great job!', body: 'Database added.' },
          },
          hints: ['Search for "Database"', 'Connect Search Service to it'],
        }),
      ],
    }),
    level({
      title: 'Expert Architecture',
      steps: [
        step({
          component: 'Payment Service',
          nodeType: 'payment_service',
          parent: 'API Gateway',
          phases: {
            context: { heading: 'Level 3: Payment Service', body: 'Airbnb\'s Payment Service handles split payments — guests pay the total, but funds are split between the host (minus Airbnb\'s 3% service fee) and held in escrow until 24 hours after check-in.' },
            intro: { heading: 'About Payment Services', body: 'Payment services manage the full payment lifecycle: collection, escrow, split disbursement, and refund processing.' },
            teaching: { heading: 'Deep dive: Payment Service', body: 'When a guest books, the Payment Service charges the full amount but holds it in escrow. 24 hours after check-in, funds are released to the host minus Airbnb\'s 3% commission. If the guest cancels, the refund policy determines the amount (flexible: full refund, strict: 50% refund). The service handles 135+ currencies, automatic conversion at booking time, and local payment methods (Alipay in China, UPI in India). Without escrow, hosts would not be paid until after the stay, creating trust issues.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Payment Service', and add the Payment Service." },
            connecting: { heading: 'Connect it up', body: 'Connect API Gateway \u2192 Payment Service.' },
            celebration: { heading: 'Great job!', body: 'Payment Service added. Your Airbnb architecture is complete!' },
          },
          hints: ['Search for "Payment Service"', 'Connect API Gateway to it'],
        }),
      ],
    }),
  ],
});

export default airbnbTutorial;
