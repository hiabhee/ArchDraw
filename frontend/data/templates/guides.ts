/**
 * Written guides for the public template pages (`/templates/<slug>`): what the diagram
 * shows, how a request moves through it, the design decisions behind it and how it
 * scales. Each guide is written against that template's own components and connections
 * (`data/templates/*`), so keep them in step when a template changes. Real products are
 * described from public information only; the page says the design is representative.
 *
 * Keyed by template id. Templates without a guide still get the diagram, component and
 * connection lists.
 */

export interface TemplateGuide {
  /** Two or three paragraphs: what the system does and how the diagram is organised. */
  overview: string[];
  /** One or more walkthroughs, each a numbered list of steps through the diagram. */
  flows: Array<{ title: string; steps: string[] }>;
  /** The choices that shape the design, each with its reason and cost. */
  decisions: Array<{ title: string; body: string }>;
  /** How the design grows with load. */
  scaling: string[];
  /** Questions people search for, answered from the diagram. */
  faq: Array<{ question: string; answer: string }>;
}

export const TEMPLATE_GUIDES: Record<string, TemplateGuide> = {
  chatgpt: {
    overview: [
      "A ChatGPT-style assistant is a chat application wrapped around a large language model. The model does the language work; everything else in the diagram exists to get the right context to it quickly, stream its answer back, and remember the conversation.",
      "The diagram reads left to right: the web client and CDN at the edge, an API gateway and load balancer in front of three services (auth, chat and streaming), and behind the chat service the pieces of a retrieval-augmented generation (RAG) pipeline, storage, a job queue and observability.",
    ],
    flows: [
      {
        title: "Answering a message",
        steps: [
          "The web client loads its static assets from the CDN and sends the message over HTTPS to the API gateway.",
          "The gateway passes the request to the load balancer, which checks the user with the auth service (user records in the SQL database, JWT validation) and routes the chat request to the chat service.",
          "The chat service loads the session from the in-memory cache and asks the embedding service to turn the message into a vector.",
          "The vector database returns the closest document chunks, and the RAG pipeline adds them to the prompt as context.",
          "The chat service sends the augmented prompt to the LLM API, and the streaming service sends tokens back to the client as they are generated.",
          "The finished exchange is stored in the NoSQL database as chat history; uploads go to object storage, and slower follow-up work (summaries, indexing) goes onto the message queue for background workers.",
        ],
      },
    ],
    decisions: [
      { title: "Retrieval before generation", body: "Models only know what they were trained on. Retrieving relevant chunks from a vector database and adding them to the prompt lets the assistant answer from private or fresh documents without retraining, at the cost of an extra embedding call and a vector search on every message." },
      { title: "Streaming the answer", body: "Generating a long answer takes seconds. Streaming tokens as they arrive makes the first words appear almost immediately, which matters more to how fast the product feels than total generation time. A separate streaming service keeps long-lived connections away from the request-response chat service." },
      { title: "Chat history in a NoSQL store", body: "Conversations are append-heavy and always read by conversation id, which suits a key-value or document store. User accounts stay in SQL, where relational constraints and transactions matter." },
      { title: "A queue for everything that can wait", body: "Titles, summaries, re-indexing documents and analytics do not need to finish before the user sees an answer, so the chat service publishes them to a queue and workers handle them in the background." },
    ],
    scaling: [
      "The LLM call dominates cost and latency, so cache what you can (repeated prompts, embeddings for unchanged documents) and enforce per-user rate limits at the gateway.",
      "Chat and streaming services are stateless and scale horizontally behind the load balancer; session state lives in the cache.",
      "The vector database is sharded by collection or tenant as the document set grows; re-embedding happens in background workers, not on the request path.",
      "Logs and metrics from every service feed the observability stack, which is how you spot slow model responses and rising error rates.",
    ],
    faq: [
      { question: "What is RAG in a ChatGPT architecture?", answer: "Retrieval-augmented generation: before calling the model, the system turns the question into an embedding, finds the most similar document chunks in a vector database and adds them to the prompt. The model then answers from that context instead of only from its training data." },
      { question: "Why does a chat assistant need a vector database?", answer: "To search by meaning rather than keywords. Documents are stored as embeddings, and the vector database returns the chunks closest to the question's embedding, which is what the RAG pipeline feeds to the model." },
      { question: "Is this OpenAI's real architecture?", answer: "No. It is a typical design for a ChatGPT-style product, drawn from public information about how LLM chat apps are built. Open it in the editor to adapt it to your own system." },
    ],
  },

  netflix: {
    overview: [
      "A Netflix-style streaming service is two systems that meet at the CDN: a control plane that handles sign-in, browsing, recommendations and billing, and a content pipeline that turns uploaded masters into adaptive-bitrate files cached close to viewers.",
      "The diagram groups the parts into layers: clients (web, mobile, smart TV), edge (DNS routing and the CDN, Open Connect at Netflix), the API gateway, domain microservices, data stores, the ingestion and encoding pipeline, and an event pipeline that feeds recommendations.",
    ],
    flows: [
      {
        title: "Pressing play",
        steps: [
          "The client resolves the service through DNS routing and calls the API gateway.",
          "The gateway sends the request to the playback service, which checks the session in Redis and asks the orchestrator for the right files for this device and connection.",
          "The client fetches the video chunks directly from the nearest CDN node, switching bitrate as the connection changes.",
          "Playback events go to Kafka, where real-time and batch processing turn viewing behaviour into input for the recommendation service.",
        ],
      },
      {
        title: "Publishing a title",
        steps: [
          "Content ingestion receives the master file and passes it to transcoding.",
          "ABR encoding produces each title at several bitrates and resolutions, cut into short chunks.",
          "The chunks are stored in S3 and pushed out to CDN nodes before viewers ask for them.",
        ],
      },
    ],
    decisions: [
      { title: "Serve video from the edge", body: "Video is by far the largest share of traffic. Pushing popular titles to CDN nodes inside or near internet providers keeps playback fast and keeps that traffic off the central services, which only handle small API calls." },
      { title: "Adaptive bitrate encoding", body: "Encoding every title at multiple bitrates lets the player step down on a slow connection instead of buffering. It multiplies storage and encoding work, which is why encoding runs as an offline pipeline." },
      { title: "One service per domain", body: "Auth, profiles, catalog, playback, recommendations and billing change at different speeds and fail differently, so each is its own service behind the gateway, with its own store: Cassandra for user and metadata records, MySQL for profiles and subscriptions, Elasticsearch for search and Redis for hot lookups." },
      { title: "Events feed recommendations", body: "Every play and browse event goes through Kafka. Real-time processing reacts within minutes, and batch processing retrains on full history; both feed the recommendation service." },
    ],
    scaling: [
      "The API tier scales horizontally per service; a spike in browsing does not need more playback capacity.",
      "Cassandra spreads user and metadata records across many nodes and regions, so reads stay local.",
      "CDN capacity is planned per region from viewing data, and popular titles are pre-positioned before release.",
    ],
    faq: [
      { question: "How does Netflix deliver video so fast?", answer: "Through its own CDN, Open Connect: encoded chunks are copied to servers close to viewers ahead of time, so playback fetches from nearby instead of from a central data center." },
      { question: "What databases does a Netflix-style system use?", answer: "Several, each for one job: a wide-column store such as Cassandra for user and metadata records, a relational database for profiles and billing, a search engine for the catalog and an in-memory cache for sessions and hot data." },
      { question: "Is this Netflix's actual architecture?", answer: "It is a representative design based on public information, simplified for a diagram and for system design interviews. It is not Netflix's internal architecture." },
    ],
  },

  rideshare: {
    overview: [
      "A ride-sharing backend matches riders with nearby drivers in seconds, tracks every driver's position continuously and settles payment after the trip. Those three jobs have very different traffic patterns, so the diagram keeps them as three flows: the ride request, real-time location, and post-ride processing.",
      "Riders and drivers use mobile apps. Requests go through an API gateway to user, matching, driver and ride services; driver locations stream over WebSockets into a geo index in Redis; finished rides go onto a message queue for notifications and billing.",
    ],
    flows: [
      {
        title: "Requesting a ride",
        steps: [
          "The rider app sends the request to the API gateway, which authenticates the rider through the user service.",
          "The matching service queries the Redis geo cache for drivers near the pickup point and fetches their details from the driver service.",
          "It sends a ride offer to the chosen driver over the WebSocket server and, once accepted, asks the ride service to create the ride, which is saved in the database.",
        ],
      },
      {
        title: "Tracking drivers",
        steps: [
          "Each driver app sends its location over a WebSocket connection every few seconds.",
          "The location service updates the driver's position in the geo index, which is what matching reads.",
        ],
      },
      {
        title: "After the trip",
        steps: [
          "The ride service publishes a ride-completed event to the message queue.",
          "A background worker sends notifications and asks the billing service to charge the rider.",
        ],
      },
    ],
    decisions: [
      { title: "Location in an in-memory geo index", body: "Driver positions change every few seconds and are only useful while fresh. Keeping them in a Redis geo index makes radius queries fast and keeps the write load off the main database, which stores rides and accounts." },
      { title: "WebSockets for drivers", body: "A persistent connection lets drivers stream locations cheaply and lets the matching service push ride offers instantly, instead of drivers polling for work." },
      { title: "Payments off the request path", body: "Charging a card, sending receipts and updating earnings can take seconds and can fail and retry. Doing them from a queue after the trip keeps the ride flow fast and lets billing retry without bothering the rider." },
    ],
    scaling: [
      "Split the geo index by city or region; matching rarely needs drivers from another city.",
      "WebSocket servers hold many connections each and scale horizontally; a connection registry tells matching which server holds a driver.",
      "Ride and payment records grow steadily and can be partitioned by region and time.",
    ],
    faq: [
      { question: "How does Uber find nearby drivers?", answer: "Drivers report their location every few seconds into a geospatial index (for example Redis GEO or a grid of map cells). Matching queries the index for drivers within a radius of the pickup point and ranks them by distance and arrival time." },
      { question: "Why do ride-sharing apps use WebSockets?", answer: "Driver apps need to send locations constantly and receive ride offers instantly. A persistent WebSocket connection does both with far less overhead than repeated HTTP requests." },
      { question: "Is this Uber's real architecture?", answer: "No. It is a typical ride-sharing design based on public information, useful as a starting point and for system design interviews." },
    ],
  },

  instagram: {
    overview: [
      "An Instagram-style platform stores a huge volume of photos and videos, builds a personalised feed for every user and notifies people when someone interacts with them. Reads vastly outnumber writes, so most of the design is about serving media and feeds quickly.",
      "In the diagram, clients reach a CDN for media and an API gateway for everything else. Behind the load balancer sit user, feed, media and search services; media processing and feed updates flow through background workers and a Kafka stream.",
    ],
    flows: [
      {
        title: "Posting a photo",
        steps: [
          "The app calls the API gateway, which verifies the user's token with the auth service (with social login through an identity provider).",
          "The media service stores the original in object storage and queues a resize and transcode job.",
          "A background worker produces the sizes each device needs and publishes a processed event to Kafka.",
          "The feed service consumes the event and adds the post to followers' feeds, cached in memory and persisted in the NoSQL database; the notification service sends push notifications.",
        ],
      },
      {
        title: "Opening the feed",
        steps: [
          "The feed service reads the user's feed from the in-memory cache, falling back to the NoSQL database.",
          "The app then loads the images and videos themselves from the CDN, which fetches from object storage on a miss.",
        ],
      },
    ],
    decisions: [
      { title: "Media through a CDN", body: "Images and videos are most of the bytes served. Putting them in object storage behind a CDN keeps them cheap to store and fast to load, and keeps that traffic away from the application servers." },
      { title: "Process media asynchronously", body: "Resizing and transcoding take time. Doing them in background workers lets the upload return quickly; the post appears once processing finishes." },
      { title: "Fan-out through a stream", body: "Building feeds from Kafka events decouples posting from reading: the feed, notification and analytics consumers each process the same event at their own pace." },
      { title: "Precomputed, cached feeds", body: "Assembling a feed at read time from every followed account is expensive, so feeds are built ahead of time and served from cache. Accounts with huge followings are usually merged in at read time instead, to avoid writing to millions of feeds per post." },
    ],
    scaling: [
      "Feed storage is partitioned by user id; the cache holds recent feeds for active users.",
      "Workers scale with the upload rate independently of the API tier.",
      "Search runs on its own index, updated from events, so heavy search traffic never touches the primary databases.",
    ],
    faq: [
      { question: "How does Instagram generate the news feed?", answer: "Typically by fan-out on write: when someone posts, the post is added to each follower's precomputed feed, which is stored in a cache and a NoSQL database. Very large accounts are often merged in when the feed is read instead." },
      { question: "Where does Instagram store photos?", answer: "In object storage such as S3, served through a CDN. Background workers create the different sizes each device needs." },
      { question: "Is this Instagram's real architecture?", answer: "It is a representative design based on public information, not Instagram's internal system." },
    ],
  },

  url_shortener: {
    overview: [
      "A URL shortener maps a short code to a long URL and redirects anyone who opens the short link. Creating links is rare; redirects are constant, often millions for one popular link, so the design is built around fast reads.",
      "The diagram is deliberately small: clients reach an API service through a load balancer, the service reads through a Redis cache in front of Cassandra, and a scheduled cleanup job removes expired links.",
    ],
    flows: [
      {
        title: "Shortening a link",
        steps: [
          "The client sends the long URL through the load balancer to the API service.",
          "The service generates a unique short code and stores the mapping in the database, scheduling its expiry if it has one.",
          "It returns the short link.",
        ],
      },
      {
        title: "Following a short link",
        steps: [
          "The load balancer routes the request to the API service.",
          "The service looks the code up in Redis; on a miss it reads the database and fills the cache.",
          "It answers with an HTTP redirect to the long URL.",
        ],
      },
    ],
    decisions: [
      { title: "Cache-aside for redirects", body: "A small share of links receives most of the traffic. Keeping hot codes in Redis serves them from memory; the database only sees misses." },
      { title: "A key-value store underneath", body: "Every lookup is by short code, with no joins, so a distributed key-value or wide-column store such as Cassandra scales writes and reads by adding nodes." },
      { title: "How codes are generated", body: "Base62 encoding of a unique counter gives short, collision-free codes but needs a coordinated counter; hashing the URL needs no coordination but must handle collisions. Seven base62 characters already give about 3.5 trillion codes." },
      { title: "301 or 302", body: "A permanent 301 redirect lets browsers cache it and lowers load; a temporary 302 sends every click through the service, which is what you want if you count clicks." },
    ],
    scaling: [
      "Scale API servers horizontally behind the load balancer; they hold no state.",
      "Partition the database by short code so data spreads evenly across nodes.",
      "Expiry runs as a scheduled batch job, never on the redirect path.",
    ],
    faq: [
      { question: "How does a URL shortener work?", answer: "It stores a mapping from a short code to the original URL. Opening the short link looks the code up (usually in a cache first) and returns an HTTP redirect to the original URL." },
      { question: "How long should short codes be?", answer: "Seven base62 characters (a-z, A-Z, 0-9) give about 3.5 trillion combinations, which is enough for most services. Shorter codes work for smaller volumes." },
      { question: "Which database is best for a URL shortener?", answer: "A key-value or wide-column store such as Cassandra or DynamoDB, with a cache such as Redis in front, because every lookup is by key and reads dominate." },
    ],
  },

  microservices: {
    overview: [
      "A microservices architecture splits an application into small services that each own one business capability and their own data. Services deploy and scale independently and talk to each other over APIs and events.",
      "The diagram shows the core shape: clients call an API gateway that handles authentication and routing; auth, user and order services sit behind it; the user and order services each own a Postgres database and publish changes to an event bus.",
    ],
    flows: [
      {
        title: "Placing an order",
        steps: [
          "The client calls the API gateway over HTTPS.",
          "The gateway validates the request with the auth service and routes it to the order service over REST.",
          "The order service writes the order to its own database and publishes an event to the event bus.",
          "Other services that care about orders (billing, email, analytics) consume the event; the order service never calls them directly.",
        ],
      },
    ],
    decisions: [
      { title: "Database per service", body: "Each service owns its data and nobody else reads its tables. That lets teams change schemas and scale stores independently, at the cost of no cross-service joins or transactions: data shared between services travels as events or API calls." },
      { title: "A single entry point", body: "The API gateway gives clients one address and handles cross-cutting concerns once: authentication, routing, rate limits and request logging." },
      { title: "Events for side effects", body: "Publishing to an event bus instead of calling other services directly keeps services decoupled: a new consumer can be added without changing the publisher, and a slow consumer does not slow the request." },
    ],
    scaling: [
      "Scale each service on its own; the order service can run more instances during a sale without touching the user service.",
      "The event bus absorbs bursts, and consumers catch up at their own pace.",
      "Distributed tracing and per-service metrics are what make many services debuggable.",
    ],
    faq: [
      { question: "What is a microservices architecture diagram?", answer: "A diagram showing the separate services an application is split into, how clients reach them (usually through an API gateway), which data store each owns, and how services communicate through APIs and events." },
      { question: "Microservices vs monolith: when should you split?", answer: "When separate teams need to deploy independently or parts of the system scale very differently. A well-structured monolith is simpler to build and run until then." },
      { question: "Why does each microservice have its own database?", answer: "So services can change and scale without coordinating schema changes. Data needed by other services is shared through APIs or events instead of shared tables." },
    ],
  },

  ecommerce: {
    overview: [
      "An e-commerce platform lets shoppers browse a catalog, search, fill a cart and check out. Browsing traffic is huge and read-heavy; checkout is small but must never lose an order or a payment.",
      "The diagram puts a CDN and an API gateway in front of auth, catalog, cart and order services. Catalog feeds a search index, the cart reserves stock with inventory, and orders charge through a payment provider.",
    ],
    flows: [
      {
        title: "From browsing to checkout",
        steps: [
          "The client loads assets and product images from the CDN and calls the API gateway.",
          "Catalog serves product listings, and search queries go to the Elasticsearch index built from the catalog.",
          "Adding to the cart updates the Redis-backed cart and reserves stock with the inventory service.",
          "At checkout the order service creates the order and charges the payment provider.",
        ],
      },
    ],
    decisions: [
      { title: "Carts in memory", body: "Carts change constantly and are short-lived, so a fast in-memory store such as Redis suits them better than the order database." },
      { title: "Reserve stock early", body: "Reserving inventory when an item goes into the cart, with a timeout, prevents two shoppers from buying the last item. The reservation is released if the cart expires." },
      { title: "A separate search index", body: "Full-text search, filters and ranking need a search engine. Indexing the catalog into Elasticsearch keeps those queries off the product database." },
      { title: "Idempotent payments", body: "Network failures happen mid-checkout. Sending an idempotency key with each charge means a retried request never charges the customer twice." },
    ],
    scaling: [
      "Cache product pages and images at the CDN; most traffic never reaches the backend.",
      "Scale catalog and search for browsing peaks separately from order and payment.",
      "Queue post-order work (emails, fulfilment, analytics) so checkout stays fast during sales.",
    ],
    faq: [
      { question: "What are the main components of an e-commerce architecture?", answer: "A CDN, an API gateway, and services for authentication, the product catalog, search, the cart, inventory, orders and payments, each with the store that suits it." },
      { question: "How do e-commerce sites avoid overselling?", answer: "By reserving stock in the inventory service when items are added to the cart or at checkout, with a timeout that releases the reservation if the purchase is not completed." },
      { question: "Is this Amazon's architecture?", answer: "No. It is a typical design for an online store, inspired by large marketplaces, that you can adapt to your own." },
    ],
  },

  chat_system: {
    overview: [
      "A chat system delivers messages between users in real time, shows who is online, keeps history and reaches people whose app is closed. Slack, WhatsApp and Discord all solve these same problems.",
      "In the diagram, clients hold a WebSocket connection to a gateway. A message service sends and delivers messages, stores them in Cassandra, pushes notifications to offline users, and publishes to Kafka for search indexing; a presence service tracks who is online.",
    ],
    flows: [
      {
        title: "Sending a message",
        steps: [
          "The sender's client sends the message over its WebSocket connection to the gateway.",
          "The message service persists it in the message store and works out the recipients.",
          "Online recipients receive it through their own WebSocket connections; offline recipients get a push notification through APNS or FCM.",
          "The message is also published to Kafka, and the search service indexes it.",
        ],
      },
    ],
    decisions: [
      { title: "Persistent connections", body: "WebSockets let the server push messages the moment they arrive, without clients polling. The gateway's job is to hold those connections and know which user is on which server." },
      { title: "A write-heavy message store", body: "Messages are appended constantly and read by conversation and time. A wide-column store such as Cassandra, partitioned by conversation, handles that pattern well." },
      { title: "Presence as its own service", body: "Online status changes all the time and is read by everyone who can see a user. Keeping it in a separate, in-memory service stops those updates from loading the message path." },
      { title: "Search off the hot path", body: "Indexing through Kafka means sending a message never waits for the search index." },
    ],
    scaling: [
      "Add gateway servers as connections grow; each holds many idle connections.",
      "Partition messages by conversation id so one busy channel lands on a few nodes.",
      "Large group channels fan out through the queue rather than one write per member on the request path.",
    ],
    faq: [
      { question: "How does a chat app deliver messages in real time?", answer: "Clients keep a WebSocket connection open to a gateway. When a message arrives, the message service stores it and pushes it down the recipients' open connections; offline users get a push notification instead." },
      { question: "What database do chat apps use for messages?", answer: "Usually a wide-column or key-value store such as Cassandra or ScyllaDB, partitioned by conversation and sorted by time, because the workload is mostly appends and recent reads." },
      { question: "How is online status (presence) tracked?", answer: "The gateway reports connects, disconnects and heartbeats to a presence service that keeps status in memory and publishes changes to the people who can see it." },
    ],
  },

  event_driven: {
    overview: [
      "In an event-driven architecture, services announce what happened (an order was created) instead of telling other services what to do. Any number of consumers can react to the same event independently.",
      "The diagram shows the pattern end to end, including the part that keeps it reliable: the API writes the order and the event in one transaction through an outbox, a relay publishes the event to Kafka, and inventory, email and analytics each consume OrderCreated on their own.",
    ],
    flows: [
      {
        title: "Creating an order",
        steps: [
          "The client sends a command to the API service.",
          "The API writes the order and an OrderCreated record to the outbox table in the same database transaction.",
          "A relay reads the outbox and publishes the event to the event bus.",
          "Inventory reserves stock, email sends the confirmation and analytics records the sale, each at its own pace.",
        ],
      },
    ],
    decisions: [
      { title: "The transactional outbox", body: "Writing to the database and publishing to Kafka are two systems, so one can succeed while the other fails. Writing the event into an outbox table in the same transaction as the data, and relaying it afterwards, guarantees the event is published if and only if the order was saved." },
      { title: "Consumers instead of calls", body: "The API does not know who consumes OrderCreated. Adding a new reaction (loyalty points, fraud checks) means adding a consumer, not changing the API." },
      { title: "At-least-once delivery", body: "Relays and consumers can retry, so an event may arrive twice. Consumers must be idempotent, for example by recording processed event ids." },
    ],
    scaling: [
      "Partition the topic by order id so events for one order stay in order.",
      "Each consumer group scales its own instances; a slow consumer only builds up its own lag.",
      "Keep events for a retention period so new consumers can replay history.",
    ],
    faq: [
      { question: "What is the transactional outbox pattern?", answer: "Writing an event into an outbox table in the same database transaction as the business data, then having a separate relay publish it to the message broker. It prevents saving data without publishing its event, or publishing an event for data that was never saved." },
      { question: "When should I use an event-driven architecture?", answer: "When several parts of a system need to react to the same change and should not depend on each other, or when work can happen after the request returns." },
      { question: "Event-driven vs request-response: what is the difference?", answer: "In request-response the caller waits for a specific service to answer. In event-driven systems the producer publishes an event and moves on; any number of consumers react later." },
    ],
  },

  video_streaming: {
    overview: [
      "A video streaming platform, YouTube-style, has two halves: creators upload videos that are transcoded into many renditions, and viewers stream those renditions from a CDN with quality that adapts to their connection.",
      "The diagram shows the upload and transcode pipeline (upload service, transcode queue, transcoder fleet, object storage), the playback path (API gateway, playback, manifest and catalog services, the CDN edge) and the telemetry that measures quality of experience.",
    ],
    flows: [
      {
        title: "Uploading a video",
        steps: [
          "Creator Studio starts an upload through the API gateway; the upload service accepts it in parts and writes the raw file to object storage.",
          "It puts a transcode job on the queue, and the transcoder fleet produces HLS and DASH renditions at several bitrates.",
          "Renditions go back to object storage and their details to the metadata database; the catalog indexes the title for search.",
        ],
      },
      {
        title: "Watching a video",
        steps: [
          "The viewer app asks the API gateway to play a title, and the playback service checks entitlements.",
          "The manifest service builds the adaptive-bitrate manifest from the rendition list and caches it.",
          "The player reads the manifest and streams segments from the CDN edge, which fetches from object storage on a miss.",
          "Playback telemetry flows into the analytics warehouse and raises quality-of-experience alerts in monitoring.",
        ],
      },
    ],
    decisions: [
      { title: "Transcoding through a queue", body: "Encoding is slow and bursty. A queue in front of a fleet of transcoders absorbs upload spikes and lets the fleet scale with the backlog." },
      { title: "Adaptive bitrate with manifests", body: "Each video is cut into short segments at several qualities. The manifest lists them, and the player switches quality segment by segment, which avoids buffering on changing networks." },
      { title: "Cached manifests", body: "Popular titles are requested constantly. Caching their manifests means the CDN rarely needs to reach the manifest service." },
      { title: "Measure the viewer's experience", body: "Startup time, rebuffering and bitrate drops are the numbers that matter to viewers. Collecting them from players is how you find a bad CDN region or a broken encoding." },
    ],
    scaling: [
      "Segments are immutable, so the CDN caches them for a long time; the origin mostly serves new or rare videos.",
      "Scale transcoders with queue depth, and use cheaper spare capacity for non-urgent jobs.",
      "Store raw uploads separately from renditions so files can be re-encoded later with better codecs.",
    ],
    faq: [
      { question: "How does video streaming work?", answer: "Videos are transcoded into short segments at several bitrates. The player downloads a manifest listing them and streams segments from a CDN, switching quality as bandwidth changes (adaptive bitrate streaming, using HLS or DASH)." },
      { question: "Why do video platforms transcode uploads?", answer: "To produce versions for every device and connection speed, from low-bitrate mobile streams to 4K, in the formats players support." },
      { question: "Is this YouTube's architecture?", answer: "It is a typical design for a video platform like YouTube, based on public information, not YouTube's internal system." },
    ],
  },
};

export function getTemplateGuide(templateId: string): TemplateGuide | undefined {
  return TEMPLATE_GUIDES[templateId];
}
