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
  claude_code: {
    overview: [
      "A terminal coding agent such as Claude Code is a loop around a language model: it builds a request from the conversation and the project's context, lets the model decide on the next step, runs the tools the model asks for, and feeds the results back until the task is done.",
      "The diagram follows that loop. The developer talks to the CLI, the agent loop asks the context builder for a request (system prompt, history, CLAUDE.md memory, skills and summaries from compaction), the Anthropic API streams the model's answer, and tool calls go through a router that checks permissions and hooks before reaching file, Bash, search, web, subagent and MCP tools.",
    ],
    flows: [
      {
        title: "One turn of the agent loop",
        steps: [
          "The developer types a prompt in the terminal or IDE; the CLI hands it to the agent loop as a user turn.",
          "The context builder assembles the request: system prompt, conversation history, CLAUDE.md instructions, relevant skill content and any compaction summary.",
          "The request goes to the Anthropic API with the list of available tools, and the model's answer streams back.",
          "If the answer contains tool calls, the tool router checks permissions, runs any hooks and dispatches each call to the right tool: read or edit files, run a shell command, search the repo, fetch a web page, delegate to a subagent or call an MCP server.",
          "Tool results go back into the loop, and the model decides the next step. The loop ends when the model answers without calling a tool.",
          "When the conversation nears the context limit, compaction summarises older turns so the loop can continue.",
        ],
      },
    ],
    decisions: [
      { title: "The model chooses the tools", body: "Instead of a fixed script, the model sees tool descriptions and decides which to call and when. That makes the agent general (the same loop fixes a test, writes a migration or answers a question) at the cost of needing guardrails around what the tools may do." },
      { title: "Permissions and hooks around every tool call", body: "Editing files and running commands affect the developer's machine, so every call passes a permission check (settings and modes decide what runs without asking) and can trigger hooks that block, log or adjust it." },
      { title: "Context as a budget", body: "The model's context window is finite. Project memory (CLAUDE.md), skills loaded on demand and compaction of old turns keep the most useful information in the request without overflowing it." },
      { title: "Subagents and MCP for reach", body: "Subagents run a task in a separate context and return only the result, which keeps the main conversation small. MCP servers add tools from outside (databases, issue trackers, design tools) without changing the agent itself." },
    ],
    scaling: [
      "Long tasks are limited by context, not compute: compaction and subagents are what let a session run for hours.",
      "Parallel work comes from several sessions or subagents working on separate parts of the repo, each with its own context.",
      "Tool output is the largest consumer of context, so search tools and file reads return focused results rather than whole files where they can.",
    ],
    faq: [
      { question: "How does Claude Code work?", answer: "It runs an agent loop in your terminal: it sends your request plus project context to a Claude model, the model replies with text or tool calls (read files, edit code, run commands, search), the CLI runs those tools with your permission settings, and the results go back to the model until the task is done." },
      { question: "What is CLAUDE.md?", answer: "A Markdown file of project or user instructions that Claude Code adds to its context at the start of a session, so the agent knows your conventions, commands and constraints." },
      { question: "What are hooks in Claude Code?", answer: "Commands you configure to run on events such as before or after a tool call. They can block a call, log it or add context, which is how teams enforce their own rules around the agent." },
    ],
  },

  fintech_payments: {
    overview: [
      "A payment system takes a customer's payment, decides whether it is safe, gets it authorised by the card network, records it correctly and settles the money later. The hard parts are not speed but correctness: never charge twice, never lose a record, and always be able to explain every balance.",
      "The diagram shows mobile and web checkouts calling an API gateway, a payment service that consults a risk engine before authorising through a card processor, a double-entry ledger, a payments database, and an event stream that feeds analytics and alerting.",
    ],
    flows: [
      {
        title: "Authorising a payment",
        steps: [
          "The checkout sends the payment to the API gateway, which authenticates the merchant or user and applies rate limits.",
          "The payment service asks the risk engine to score the transaction before authorising it.",
          "If the score is acceptable, the payment service sends the authorisation to the card processor, which settles with the bank network later.",
          "The payment service writes the transaction to the payments database and a double-entry record through the ledger service.",
          "A payment event goes to Kafka, feeding the data warehouse and alerting on failed payments.",
        ],
      },
    ],
    decisions: [
      { title: "A double-entry ledger", body: "Every movement of money is recorded as matching debit and credit entries that are never edited, only added. Balances are derived from entries, so any number can be traced back and audited, and errors are corrected with new entries." },
      { title: "Fraud scoring before authorisation", body: "Scoring the transaction first stops bad payments before money moves and lets the system add friction (for example 3-D Secure) only where the risk is high." },
      { title: "Idempotency on every write", body: "Clients and networks retry. An idempotency key on each payment request means a retry returns the original result instead of charging again." },
      { title: "Authorisation now, settlement later", body: "Card networks approve a payment in seconds but move the money in batches. The design keeps the two apart: authorisation is synchronous, settlement and reconciliation run later from the ledger." },
    ],
    scaling: [
      "The payment service is stateless and scales horizontally; the database is the part to protect, partitioned by merchant or account.",
      "Analytics and reporting read from the event stream and warehouse, never from the transactional database.",
      "Daily reconciliation compares the ledger with processor and bank reports, which catches discrepancies at any volume.",
    ],
    faq: [
      { question: "What is a double-entry ledger in a payment system?", answer: "A record where every transaction writes equal debits and credits to two or more accounts and entries are never changed. It makes balances auditable and guarantees money is never created or lost by a bug." },
      { question: "How do payment systems prevent double charges?", answer: "With idempotency keys: the client sends a unique key with each payment, and the server stores the result under that key, so a retried request returns the first result instead of creating a second charge." },
      { question: "What is the difference between authorisation and settlement?", answer: "Authorisation is the card network approving and reserving the amount, which happens in seconds. Settlement is the actual transfer of money between banks, which happens later in batches." },
    ],
  },

  collaborative_docs: {
    overview: [
      "A Google Docs-style editor lets many people edit the same document at once, see each other's cursors and keep working offline. The central problem is merging edits that happen at the same time on different devices without losing anyone's work.",
      "In the diagram, browser and mobile editors connect through an edge router. A presence service tracks cursors and viewers in Redis, a collaboration service applies CRDT operations and broadcasts them over pub/sub, a document API serves metadata and sharing, and a snapshot worker compacts the operation log and updates search.",
    ],
    flows: [
      {
        title: "Typing in a shared document",
        steps: [
          "The editor opens the document through the edge router, which joins the user to the document's presence room and loads metadata from the document API.",
          "Each keystroke becomes an operation sent to the collaboration service, which appends it to the document store's operation log.",
          "The collaboration service broadcasts the operation on the document's pub/sub channel, and the edge router delivers it to every other open session.",
          "Each editor merges remote operations into its local copy; because they are CRDT operations, every copy ends up identical regardless of arrival order.",
          "Periodically the snapshot worker compacts the log into a snapshot and indexes the text for search.",
        ],
      },
    ],
    decisions: [
      { title: "CRDTs for merging", body: "Conflict-free replicated data types let each device apply edits locally and merge others' edits in any order with the same result. That makes offline editing and low-latency typing possible without a central lock. Operational transformation is the older alternative and needs a central server to order operations." },
      { title: "An operation log plus snapshots", body: "Storing every operation gives full history and lets late joiners catch up, but replaying a long log is slow. Snapshots taken by a background worker bound the replay to recent operations." },
      { title: "Presence kept separate", body: "Cursor positions change constantly and do not need to be durable. Keeping them in Redis through a presence service stops them from flooding the document store." },
    ],
    scaling: [
      "Route all sessions for one document to the same region, so its pub/sub channel stays local.",
      "Snapshot frequency trades storage and worker time against how long a document takes to load.",
      "Metrics on merge conflicts and operation latency show when a hot document needs attention.",
    ],
    faq: [
      { question: "How does real-time collaborative editing work?", answer: "Each edit is sent as an operation to a collaboration service, which stores it and broadcasts it to everyone with the document open. Each client merges remote operations into its copy using an algorithm such as CRDTs or operational transformation, so all copies converge." },
      { question: "What is a CRDT?", answer: "A conflict-free replicated data type: a data structure designed so that copies edited independently can always be merged automatically into the same result, whatever order the edits arrive in." },
      { question: "Is this Google Docs' architecture?", answer: "No. It is a typical design for a collaborative editor, based on public information about how such editors work." },
    ],
  },

  food_delivery: {
    overview: [
      "A food delivery app is a three-sided marketplace: customers order, restaurants prepare, couriers deliver. The system has to keep all three in sync in real time and pick the right courier for each order.",
      "The diagram shows customer, courier and restaurant apps behind an API gateway, catalog and order services, a dispatch service fed by a stream of courier locations, payments, an order event pipeline on Kafka, notifications and an operations dashboard.",
    ],
    flows: [
      {
        title: "From order to doorstep",
        steps: [
          "The customer browses restaurants and menus through the catalog service, which keeps a search index for discovery.",
          "Placing the order goes to the order service, which charges the customer through the payment service and writes the order to the orders database.",
          "The restaurant sees the order in its portal, and the order service asks the dispatch service for a courier.",
          "Dispatch matches a courier using live positions from the location stream and records the assignment.",
          "Every status change is published to the order events pipeline, which drives push and SMS updates to the customer and the operations dashboard.",
        ],
      },
    ],
    decisions: [
      { title: "An explicit order lifecycle", body: "An order moves through clear states (placed, accepted, preparing, picked up, delivered, cancelled). Owning that state machine in one order service makes it clear who may change what and when." },
      { title: "Dispatch on live locations", body: "Couriers stream GPS positions continuously. Matching needs the freshest positions plus estimated preparation time, so dispatch reads a location stream rather than querying a database." },
      { title: "Events for everything downstream", body: "Notifications, analytics and the ops dashboard all react to order events, so the order service does not wait on them and new consumers can be added freely." },
    ],
    scaling: [
      "Partition by city: orders, couriers and restaurants rarely interact across cities.",
      "Lunch and dinner peaks drive capacity; the catalog and search tier is cached heavily since menus change rarely.",
      "Track delivery-time SLAs from the event stream to spot problems in a zone before customers complain.",
    ],
    faq: [
      { question: "How do food delivery apps assign couriers?", answer: "A dispatch service combines couriers' live GPS positions, their current workload and the restaurant's preparation time to pick the courier who can arrive when the food is ready, then offers them the job." },
      { question: "What services does a food delivery platform need?", answer: "Catalog and search for restaurants and menus, an order service for the order lifecycle, payments, dispatch for couriers, a location stream, notifications and an event pipeline that connects them." },
      { question: "Is this DoorDash's or Uber Eats' architecture?", answer: "It is a typical design for a food delivery marketplace based on public information, not any company's internal architecture." },
    ],
  },

  mvc: {
    overview: [
      "Model-View-Controller (MVC) splits a web application into three roles: the model holds the data and business rules, the view renders what the user sees, and the controller handles each request and decides what to do. It is the structure behind Rails, Django, Laravel, Spring MVC and ASP.NET MVC.",
      "The diagram follows one request: the browser calls a router, the router picks a controller, the controller updates or reads the model (which talks to the database) and selects a view, and the view renders HTML back to the browser.",
    ],
    flows: [
      {
        title: "Handling one request",
        steps: [
          "The browser sends an HTTP request, and the router matches the URL to a controller action.",
          "The controller validates input and asks the model to read or change data.",
          "The model applies business rules and queries the database.",
          "The controller selects a view, passing it the model data.",
          "The view renders HTML (or JSON) and the response goes back to the browser.",
        ],
      },
    ],
    decisions: [
      { title: "Separate data from presentation", body: "Keeping business rules in the model means the same rules apply whether the request came from a web page, an API or a background job, and views can change without touching them." },
      { title: "Thin controllers", body: "Controllers should coordinate, not decide: parse the request, call the model, choose the view. Logic that piles up in controllers is hard to test and reuse." },
      { title: "Convention over configuration", body: "Most MVC frameworks map URLs to controllers and models to tables by naming convention, which is why MVC apps are quick to start." },
    ],
    scaling: [
      "MVC is a code structure, not a deployment one: the whole application usually runs as one process, scaled by running more copies behind a load balancer.",
      "As the model grows, teams often add a service layer between controllers and models, which is the step towards layered or clean architecture.",
      "Caching rendered views and database queries handles most read-heavy growth.",
    ],
    faq: [
      { question: "What is MVC architecture?", answer: "A way to organise an application into models (data and business rules), views (what the user sees) and controllers (code that handles each request, updates the model and picks the view)." },
      { question: "What is the difference between MVC and layered architecture?", answer: "MVC separates concerns inside the presentation of a web app. Layered architecture separates the whole application into tiers (presentation, business, persistence), and an MVC framework often forms its presentation layer." },
      { question: "Is MVC still used?", answer: "Yes. Rails, Django, Laravel, Spring MVC and ASP.NET MVC all follow it, and many front-end frameworks use variations of the same idea." },
    ],
  },

  clean_architecture: {
    overview: [
      "Clean architecture arranges code in rings with one rule: source code dependencies point inwards. Entities and use cases sit at the centre and know nothing about the web framework or the database, which sit on the outside.",
      "The diagram shows the rings from the inside out: entities (enterprise business rules), use cases (application logic), interface adapters (controllers, presenters and gateways), and frameworks and drivers (the web framework and the database).",
    ],
    flows: [
      {
        title: "A request through the rings",
        steps: [
          "The web framework receives an HTTP request and passes it to a controller.",
          "The controller converts it into an input model and calls a use case through its input port.",
          "The use case applies application logic using entities, and loads or saves data through a repository port.",
          "A gateway implements that port and talks to the database with SQL.",
          "The use case hands its result to a presenter (an output port implementation), which builds a view model for the web framework to render.",
        ],
      },
    ],
    decisions: [
      { title: "The dependency rule", body: "Inner rings never import outer ones. The use case defines the interfaces it needs (ports), and the outer ring implements them, so the core can be tested without a database or web server and the framework can be replaced." },
      { title: "Use cases as the unit of design", body: "Each use case (place order, register user) is one class or function, so the application's behaviour is visible in one place rather than spread across controllers." },
      { title: "The cost", body: "More interfaces and data mapping between rings. For a small CRUD app this is overhead; it pays off when business rules are complex and long-lived." },
    ],
    scaling: [
      "Clean architecture scales with the codebase and team, not with traffic: deployment is the same as any application.",
      "Use cases are natural boundaries if the application is later split into services.",
      "Tests at the use-case level stay fast because they need no infrastructure.",
    ],
    faq: [
      { question: "What is clean architecture?", answer: "A way of structuring an application, described by Robert C. Martin, in which business rules sit at the centre and all source code dependencies point inwards, so frameworks, databases and user interfaces are details that can change without touching the core." },
      { question: "Clean architecture vs hexagonal architecture?", answer: "They share the same idea: the core defines ports and the outside implements adapters. Clean architecture adds explicit rings for entities and use cases; hexagonal focuses on the split between driving and driven sides." },
      { question: "What is the dependency rule?", answer: "Code in an inner ring must not name anything in an outer ring. Data crosses boundaries as simple structures, and inner rings declare the interfaces that outer rings implement." },
    ],
  },

  hexagonal: {
    overview: [
      "Hexagonal architecture, also called ports and adapters, puts the domain logic in the centre and connects it to the outside world only through ports: interfaces the domain defines. Adapters on the outside implement those ports for a specific technology.",
      "In the diagram, REST and CLI adapters drive the application through an input port. The domain core calls an output port, which the database (Postgres), queue (Kafka) and cache (Redis) adapters implement.",
    ],
    flows: [
      {
        title: "A request through ports and adapters",
        steps: [
          "A REST call or a CLI command arrives at its adapter, which translates it into a call on the input port.",
          "The domain core runs the business logic.",
          "When it needs to persist, publish or cache something, it calls the output port.",
          "The DB, queue or cache adapter carries out the call with its technology.",
        ],
      },
    ],
    decisions: [
      { title: "Driving and driven sides", body: "Adapters that call the application (REST, CLI, tests) are on the driving side; adapters the application calls (database, queue, cache) are on the driven side. Keeping them apart makes it obvious which code is infrastructure." },
      { title: "The domain owns the interfaces", body: "Because the core defines the output port, it never imports a database client. Swapping Postgres for another store, or a real queue for an in-memory one in tests, means writing a new adapter." },
      { title: "Several adapters for one port", body: "The same input port serves HTTP and the command line; the same logic runs in production and in tests with fake adapters." },
    ],
    scaling: [
      "Like other code-structure patterns, it scales the codebase: deployment is unchanged.",
      "Adding a new entry point (a message consumer, a GraphQL API) is a new driving adapter, with no change to the core.",
      "Domain tests run against in-memory adapters and stay fast as the system grows.",
    ],
    faq: [
      { question: "What is hexagonal architecture?", answer: "A design, introduced by Alistair Cockburn, in which the application's core logic talks to the outside only through ports (interfaces it defines), and adapters implement those ports for specific technologies such as HTTP, databases or message queues." },
      { question: "What is the difference between a port and an adapter?", answer: "A port is an interface owned by the application, for example 'save order'. An adapter is an implementation of that interface for one technology, for example a Postgres repository." },
      { question: "Why is it called hexagonal?", answer: "The hexagon is just a drawing convention that leaves room for many ports on each side. The number six has no meaning." },
    ],
  },

  layered: {
    overview: [
      "Layered (n-tier) architecture stacks an application in horizontal layers, each depending only on the one below: presentation handles requests and views, business logic holds the rules, persistence handles storage, and the database sits at the bottom.",
      "The diagram shows the classic three tiers plus the client and the external services the business layer integrates with, such as payment, email and SMS providers.",
    ],
    flows: [
      {
        title: "A request down the layers",
        steps: [
          "The client sends an HTTP or REST request to the presentation layer (controllers and views).",
          "Presentation calls the business layer, where services and the domain model apply the rules.",
          "The business layer uses the persistence layer (repositories and DAOs) to read and write data.",
          "Persistence runs the queries against the database; the result travels back up the layers.",
          "Where needed, the business layer calls external services such as payments or email.",
        ],
      },
    ],
    decisions: [
      { title: "Each layer talks only to the next", body: "Presentation never queries the database directly. That keeps responsibilities clear and lets each layer be changed or tested on its own." },
      { title: "Business logic in the middle", body: "Putting the rules in one layer means every entry point (web, API, jobs) shares them, and storage details stay out of them." },
      { title: "The common pitfall", body: "When the database schema drives everything, business logic leaks into persistence and the middle layer becomes a pass-through. Clean and hexagonal architectures invert that dependency to prevent it." },
    ],
    scaling: [
      "The presentation and business layers are usually stateless and scale by adding servers behind a load balancer.",
      "The database layer is scaled with replicas, caching and, eventually, partitioning.",
      "Calls to external services are best moved to background jobs once they slow requests down.",
    ],
    faq: [
      { question: "What is layered architecture?", answer: "An application structure in which code is grouped into layers (typically presentation, business logic and persistence) and each layer only depends on the layer directly beneath it." },
      { question: "What is the difference between layers and tiers?", answer: "Layers are a logical grouping of code; tiers are where that code runs. A three-layer app can run on one server or on three tiers (web server, application server, database server)." },
      { question: "Layered vs microservices architecture?", answer: "Layered architecture splits one application horizontally by technical role. Microservices split a system vertically by business capability into separately deployed services, each of which may be layered inside." },
    ],
  },

  cqrs: {
    overview: [
      "Command Query Responsibility Segregation (CQRS) uses separate models for changing data and for reading it. Commands go to a write side optimised for consistency; queries go to a read side optimised for the views the application needs.",
      "In the diagram, an API gateway routes commands to the command API and queries to the query API. The command API writes to a Postgres write database, which emits events onto an event bus; a projection keeps a materialised read database up to date for the query API.",
    ],
    flows: [
      {
        title: "A command",
        steps: [
          "The client sends a command (for example, place order), and the gateway routes it to the command API.",
          "The command API validates it against the write model and saves the change in the write database.",
          "The change is published as a domain event on the event bus.",
        ],
      },
      {
        title: "A query",
        steps: [
          "The projection consumes the event and updates the materialised read database.",
          "Queries from the gateway go to the query API, which reads the precomputed view directly.",
        ],
      },
    ],
    decisions: [
      { title: "Two models for two jobs", body: "The write model enforces rules and invariants; the read model is shaped for each screen, often denormalised so a page needs one query. Neither has to compromise for the other." },
      { title: "Eventual consistency", body: "The read side lags the write side by the time it takes to process events. The interface has to accept that, for example by showing the user's own change immediately while the view catches up." },
      { title: "When not to use it", body: "For simple CRUD applications the extra moving parts add cost without benefit. CQRS pays off when reads and writes have very different shapes or scale." },
    ],
    scaling: [
      "Reads and writes scale independently: add read replicas or more query instances without touching the write side.",
      "New views can be added by building a new projection from the same events.",
      "Monitor projection lag; it is the main health signal of a CQRS system.",
    ],
    faq: [
      { question: "What is CQRS?", answer: "Command Query Responsibility Segregation: a pattern that separates operations that change data (commands) from operations that read it (queries), often with separate data stores kept in sync through events." },
      { question: "Is CQRS the same as event sourcing?", answer: "No. CQRS separates reads from writes; event sourcing stores state as a sequence of events. They are often used together but each works without the other." },
      { question: "When should you use CQRS?", answer: "When the read side and write side differ a lot in shape or load, for example complex validation on writes and many different, high-volume views on reads." },
    ],
  },

  event_sourcing: {
    overview: [
      "Event sourcing stores the state of the system as a sequence of events (order placed, item added, order shipped) instead of only the latest values. The current state is derived by replaying the events, and the log is never changed, only appended to.",
      "The diagram shows the cycle: a command handler validates commands and appends events to the event store, the event store publishes them on an event bus, a projection builds a query-optimised read model, and the client reads from that model.",
    ],
    flows: [
      {
        title: "Recording a change",
        steps: [
          "The client sends a command, and the command handler loads the current state by replaying that entity's events.",
          "If the command is valid, the handler appends one or more new events to the event store.",
          "The event store publishes the new events on the event bus.",
          "A projection consumes them and upserts the read model, which the client queries.",
        ],
      },
    ],
    decisions: [
      { title: "The log is the source of truth", body: "Because every change is kept, you get a complete audit trail, the ability to rebuild state as of any point in time, and new read models built from history." },
      { title: "Projections for reading", body: "Replaying events for every query would be slow, so projections keep read models up to date. They can be dropped and rebuilt from the log at any time." },
      { title: "Events are forever", body: "Event shapes must be versioned carefully, since old events are replayed for years. Mistakes are fixed with new compensating events, not edits." },
    ],
    scaling: [
      "Snapshots of an entity's state bound how many events must be replayed to load it.",
      "Partition the event store by entity id; appends for one entity stay ordered.",
      "Projections scale independently and can be rebuilt in parallel from the log.",
    ],
    faq: [
      { question: "What is event sourcing?", answer: "A way of storing data as an append-only sequence of events that describe every change, rather than overwriting records with their latest values. Current state is computed by replaying the events." },
      { question: "What are the benefits of event sourcing?", answer: "A full audit history, the ability to reconstruct past states, and the freedom to build new read models from existing events. The cost is more complexity in versioning events and building projections." },
      { question: "What is a projection in event sourcing?", answer: "A process that reads events and builds a view of the data shaped for queries, such as a table of current order statuses. It can be rebuilt by replaying the log." },
    ],
  },

  serverless: {
    overview: [
      "A serverless architecture runs code as functions that the cloud provider starts on demand, so there are no servers to manage and you pay per request. Storage and messaging are managed services too.",
      "The diagram shows a typical AWS setup: static assets served by CloudFront from S3, API calls through API Gateway to Lambda functions, data in DynamoDB and S3, and EventBridge triggering scheduled functions.",
    ],
    flows: [
      {
        title: "Serving a request",
        steps: [
          "The client loads the static front end from the CDN, which fetches it from S3 on a miss.",
          "API calls go to API Gateway, which invokes a Lambda function.",
          "The function reads and writes DynamoDB or S3 and returns the response.",
          "Scheduled work (reports, clean-ups) runs when EventBridge triggers a function on a cron schedule.",
        ],
      },
    ],
    decisions: [
      { title: "Pay per use", body: "Functions cost nothing when idle and scale automatically with traffic, which suits spiky or low-volume workloads. At constant high load, always-on servers can be cheaper." },
      { title: "Stateless functions", body: "Each invocation may run on a fresh instance, so state lives in DynamoDB or S3, never in memory between requests." },
      { title: "Managed building blocks", body: "API Gateway, DynamoDB, S3 and EventBridge remove the work of running gateways, databases and schedulers, at the cost of tying the design to one provider." },
    ],
    scaling: [
      "Lambda scales by running more concurrent instances; set concurrency limits so a spike cannot overwhelm downstream services.",
      "Cold starts add latency to the first request on a new instance; keep functions small, or use provisioned concurrency for latency-sensitive paths.",
      "Design DynamoDB keys around access patterns so load spreads evenly across partitions.",
    ],
    faq: [
      { question: "What is a serverless architecture?", answer: "An architecture where application code runs in functions managed by a cloud provider (such as AWS Lambda) that start on demand and scale automatically, combined with managed services for APIs, storage and events." },
      { question: "What is a cold start?", answer: "The extra delay when the provider has to start a new function instance before handling a request. It ranges from milliseconds to a few seconds depending on the runtime and package size." },
      { question: "When is serverless a bad fit?", answer: "For long-running jobs beyond the function time limit, steady high traffic where servers are cheaper, or workloads needing persistent connections or local state." },
    ],
  },

  notification: {
    overview: [
      "A notification system lets any service send a message to a user over push, email or SMS without knowing how each channel works. It has to respect user preferences, survive provider outages and never send the same message twice.",
      "In the diagram, services put notification requests on a queue, a dispatcher consumes them, checks the user's preferences and fans each message out to push (FCM and APNS), email (SES) and SMS (Twilio).",
    ],
    flows: [
      {
        title: "Sending a notification",
        steps: [
          "A service enqueues a notification request (who, what, which channels) on Kafka or SQS and moves on.",
          "The dispatcher polls the queue and checks the preference database for opt-outs and channel choices.",
          "It sends the message through each allowed channel: push to FCM or APNS, email through SES, SMS through Twilio.",
          "Failed sends are retried with backoff; after repeated failures they go to a dead-letter queue.",
        ],
      },
    ],
    decisions: [
      { title: "A queue in front of everything", body: "Producers never wait for email or SMS providers. The queue absorbs bursts (a marketing send, an outage alert) and lets dispatchers process at a steady rate." },
      { title: "Preferences checked centrally", body: "Opt-outs, quiet hours and channel choices are checked in one place, so no service can accidentally message someone who opted out." },
      { title: "Deduplication", body: "Queues deliver at least once. Giving each notification an id and recording what was sent stops retries from sending duplicates." },
    ],
    scaling: [
      "Run separate queues or priorities per channel and urgency, so a large email campaign cannot delay security alerts.",
      "Respect each provider's rate limits, and keep a second provider ready for critical channels.",
      "Track delivery, open and failure rates per channel to catch provider problems early.",
    ],
    faq: [
      { question: "How do you design a notification system?", answer: "Services publish notification requests to a queue; dispatchers consume them, check user preferences, render the message and send it through channel providers (push, email, SMS), with retries, deduplication and rate limiting." },
      { question: "Why use a queue for notifications?", answer: "So senders do not wait on slow third-party providers, bursts are absorbed, and failed sends can be retried without losing messages." },
      { question: "How do push notifications work?", answer: "The app registers with Apple Push Notification service or Firebase Cloud Messaging and gets a device token. Your server sends the message and token to that service, which delivers it to the device." },
    ],
  },

  search: {
    overview: [
      "Search autocomplete (typeahead) suggests completions as the user types, within a few tens of milliseconds per keystroke. The design keeps the most common prefixes in memory and falls back to a full search index for the rest.",
      "In the diagram, the client calls a search API that checks a trie cache in Redis and queries Elasticsearch. Changes in the primary Postgres database flow through change data capture into Kafka, and an indexer updates both the search index and the trie.",
    ],
    flows: [
      {
        title: "A keystroke",
        steps: [
          "The client sends the current prefix to the search API (usually after a short debounce).",
          "The API looks the prefix up in the trie cache, which holds the top suggestions for common prefixes.",
          "For less common prefixes it queries the Elasticsearch index.",
          "It returns a short list of suggestions, ranked by popularity or relevance.",
        ],
      },
      {
        title: "Keeping suggestions fresh",
        steps: [
          "Changes in the primary database are captured and published to Kafka.",
          "The indexer consumes them, re-indexes Elasticsearch and rebuilds the affected trie entries.",
        ],
      },
    ],
    decisions: [
      { title: "Precomputed top results per prefix", body: "Storing the top few completions at each prefix means a lookup is a single key read, not a search. The cost is rebuilding entries when popularity changes." },
      { title: "Change data capture for indexing", body: "Reading the database's change log means the application never has to remember to update search, and the index catches up even after an outage." },
      { title: "Debounce on the client", body: "Waiting a short moment between keystrokes cuts the request rate several times over without making suggestions feel slow." },
    ],
    scaling: [
      "Shard the trie cache by prefix and replicate it for read throughput.",
      "Cache popular prefixes at the edge or in the browser, since a few prefixes take most of the traffic.",
      "Rebuild popularity rankings in batch from query logs; real-time updates are rarely worth the cost.",
    ],
    faq: [
      { question: "How does search autocomplete work?", answer: "As the user types, the client sends the prefix to a service that returns the most likely completions, usually from a precomputed in-memory structure (a trie or prefix cache) with a full search index as fallback." },
      { question: "What is a trie in autocomplete?", answer: "A tree where each node is a character, so every path from the root spells a prefix. Storing the top completions at each node makes looking up suggestions for a prefix very fast." },
      { question: "How is the search index kept up to date?", answer: "Often with change data capture: database changes are streamed (for example through Kafka) to an indexer that updates the search index and suggestion cache." },
    ],
  },

  request_response: {
    overview: [
      "Every web or API request follows roughly the same path, from typing a URL to seeing the page. This diagram numbers the steps of that path, which is the most common warm-up question in system design interviews: what happens when you open a URL?",
      "The request goes through DNS, a CDN, a load balancer, an API gateway with an auth service, an application server, a Redis cache and a PostgreSQL database, and the response comes back the same way.",
    ],
    flows: [
      {
        title: "The 14 steps",
        steps: [
          "The client asks DNS (for example Route 53) for the domain's address.",
          "It opens an HTTPS connection and sends the request to the nearest CDN node.",
          "If the CDN cannot answer from its cache, it forwards the request to the origin's load balancer.",
          "The load balancer forwards it to an API gateway instance.",
          "The gateway asks the auth service to verify the JWT and gets back the user's claims.",
          "It routes the request to the application server for that service.",
          "The application server checks Redis; on a hit it uses the cached value, on a miss it queries PostgreSQL and gets rows back.",
          "It builds a JSON response, which returns through the gateway, load balancer and CDN (which may cache it) to the client.",
        ],
      },
    ],
    decisions: [
      { title: "Cache at every layer", body: "The CDN caches public responses close to the user, the application caches hot data in Redis, and the database has its own buffer cache. Each layer that answers saves every layer behind it." },
      { title: "Authenticate at the gateway", body: "Verifying tokens once at the edge of the system means services receive requests that are already authenticated, with the user's claims attached." },
      { title: "Stateless application servers", body: "Because session and data live in the cache and database, any server can handle any request, which is what lets the load balancer spread traffic freely." },
    ],
    scaling: [
      "DNS and the CDN spread users across regions before requests reach the origin.",
      "Add application servers behind the load balancer as traffic grows.",
      "Scale the database last, with read replicas and caching first, then partitioning.",
    ],
    faq: [
      { question: "What happens when you type a URL into a browser?", answer: "The browser resolves the domain through DNS, opens a TCP and TLS connection, sends an HTTP request (often to a CDN), which forwards it to the origin through a load balancer and gateway to an application server; the server reads from cache or database and the response returns along the same path." },
      { question: "What is the difference between a load balancer and an API gateway?", answer: "A load balancer spreads traffic across servers. An API gateway also routes requests to different services and handles cross-cutting concerns such as authentication, rate limiting and request transformation." },
      { question: "Where does caching happen in a request?", answer: "In the browser, at the CDN, in an application cache such as Redis, and inside the database. Each layer can answer the request before it reaches the next." },
    ],
  },

  archdraw_self: {
    overview: [
      "This is ArchDraw's own architecture, drawn in ArchDraw. It shows how a prompt, a Mermaid file or a GitHub repository becomes an editable diagram: three pipelines that share one stage engine and one layout engine, a React Flow canvas in the browser, and a Postgres backend.",
      "The browser side is the Next.js app, the React Flow canvas, the Mermaid code panel and a Zustand store. The pipelines are the AI Mermaid pipeline (concept detection, LLM planning, materialise, score, validate), the Mermaid pipeline (parse, validate, build, layout, size) and the repo diagram pipeline (ingest, analyse, classify, extract, relate, verify, finalise). Groq and OpenRouter provide the models.",
    ],
    flows: [
      {
        title: "From a prompt to a diagram",
        steps: [
          "The web UI sends the prompt to the orchestrator, which runs the AI pipeline through the shared pipeline engine.",
          "Concept detection serves a canned diagram for short concept prompts; otherwise the LLM architecture planner (through the API key manager, Groq first, OpenRouter on rate limits) writes a plan as Mermaid.",
          "Mermaid materialise runs the Mermaid pipeline: parse to an AST, validate, build React Flow objects, lay them out with Dagre and size the groups.",
          "The result is scored and validated, cached, and written to the Zustand store, which the canvas renders and auto-saves through the canvas API to Postgres.",
        ],
      },
    ],
    decisions: [
      { title: "Everything becomes Mermaid", body: "The AI pipeline, the code panel and the repo pipeline all produce Mermaid or React Flow objects and go through the same build and layout stages, so every diagram looks and behaves the same however it was made." },
      { title: "One stage engine", body: "pipeline-core runs every pipeline as a list of stages: a PipelineContext carries the abort signal, progress and shared data, every run ends in a typed DomainResult (success or failure with an error code), and Stage Metrics record each stage's duration. That keeps error handling and progress reporting the same in all three pipelines." },
      { title: "Shared renderers", body: "Whatever produced the graph, the canvas draws it with the same components: SystemNode for services, ShapeNode for databases, gateways and other shapes, and SimpleFloatingEdge for connections with dynamic handles. Sign-in (Google or GitHub through better-auth) and the canvas API sit on the Postgres backend." },
      { title: "Deterministic layout", body: "The layout engine (Dagre, with compound grouping and symmetry passes) is deterministic, so the same graph always gets the same layout and layout quality can be tested." },
    ],
    scaling: [
      "Generation results are cached by prompt, and repo diagrams by repository, commit and detail level.",
      "Model calls rotate across several API keys and fall back to a second provider on rate limits.",
      "Canvas saves are debounced and compare-and-swap protected, so two tabs cannot silently overwrite each other.",
    ],
    faq: [
      { question: "How does ArchDraw turn a prompt into a diagram?", answer: "An LLM plans the architecture and writes it as Mermaid; ArchDraw's Mermaid pipeline then parses it, builds the components and lays them out with a deterministic layout engine before showing it on the canvas." },
      { question: "Which AI models does ArchDraw use?", answer: "Models served through Groq first, with OpenRouter as a fallback when the primary provider is rate-limited." },
      { question: "Can I see ArchDraw's source code?", answer: "Yes, ArchDraw is open source on GitHub at github.com/hiabhee/ArchDraw." },
    ],
  },

  repo_to_diagram: {
    overview: [
      "This diagram shows how ArchDraw turns a GitHub repository into an architecture diagram. It combines deterministic analysis of the code with three LLM agents, then checks the agents' answer against evidence in the repository and its README before drawing anything.",
      "The developer pastes a repository URL; the repo diagram API checks a cache keyed by repository and commit, ingests the code from GitHub, runs static analysis and a baseline graph, then the classifier, component extractor and relationship analyst agents, and finally verification and a docs review before finalising the canvas.",
    ],
    flows: [
      {
        title: "From repository URL to diagram",
        steps: [
          "The API checks the quota and the result cache (memory and Redis, keyed by repository and commit SHA); a hit returns immediately.",
          "On a miss, ingestion downloads the repository archive from GitHub, falling back to the contents API.",
          "Static analysis finds subsystems, signals and the import graph, and builds a deterministic baseline graph.",
          "The classifier agent profiles the repository and picks an extraction strategy; the component extractor and relationship analyst add components, edges and user journeys.",
          "Verification prunes anything the evidence does not support, and the docs review re-checks the graph against the README.",
          "Finalisation applies limits and confidence scores, caches the result and sends the graph to the canvas, with progress streamed to the developer throughout.",
        ],
      },
    ],
    decisions: [
      { title: "Read the architecture files first", body: "READMEs, package manifests, Docker Compose, Terraform and CI files describe a system's architecture more directly than source code, so ingestion reads them all before sampling code." },
      { title: "A deterministic baseline", body: "Static analysis produces a draft graph without any LLM, so the agents refine something grounded in the code instead of inventing a system from scratch." },
      { title: "Verify before drawing", body: "LLM agents can hallucinate components. Checking each one against import-graph evidence and the README removes unsupported parts before the user sees them." },
    ],
    scaling: [
      "Results are cached per repository, commit and detail level, so popular repositories are analysed once per commit.",
      "File and content budgets scale with the requested detail level, which bounds the cost of very large repositories.",
      "Progress is streamed with server-sent events, so long analyses never look stuck.",
    ],
    faq: [
      { question: "Can AI generate an architecture diagram from a GitHub repository?", answer: "Yes. ArchDraw reads the repository's architecture files and code, builds a draft from static analysis, refines it with LLM agents and verifies the result against the code and README before drawing it." },
      { question: "Does it work with private repositories?", answer: "The repository import works with public GitHub repositories." },
      { question: "How accurate are repo diagrams?", answer: "Components are kept only when the code or documentation supports them, but generated diagrams can still miss or misname parts, so review them before relying on them." },
    ],
  },
  whatsapp: {
    overview: [
      "A WhatsApp-style messenger delivers short, end-to-end encrypted messages between phones in real time, keeps undelivered messages until the recipient comes online, and fans group messages out to every member. The server never sees message contents: clients encrypt before sending.",
      "In the diagram, mobile and web clients keep a persistent connection to chat servers behind a load balancer. A message service stores messages until they are delivered, a group service fans out group messages, a presence service tracks who is online, a queue and push service reach offline phones, and media and calls have their own services.",
    ],
    flows: [
      {
        title: "Sending a message",
        steps: [
          "The sender's app encrypts the message with the recipient's public key (fetched once through the API gateway and auth service) and sends it over its open connection to a chat server.",
          "The chat server hands it to the message service, which stores it in the message store until it is delivered.",
          "If the recipient is online, the message goes straight to the chat server holding their connection; delivery and read receipts flow back the same way.",
          "If they are offline, the message goes onto the queue and the push service wakes their phone through APNS or FCM; the stored copy is deleted once delivered.",
          "For a group, the group service looks up the members and fans the message out, one copy per member.",
        ],
      },
    ],
    decisions: [
      { title: "End-to-end encryption", body: "Keys live on the devices and the server only relays ciphertext. That protects users even if the servers are compromised, but means the server cannot search, filter or back up message contents; the auth service only stores public keys." },
      { title: "Store until delivered", body: "Messages are held only until every recipient device has them, then deleted. That keeps server storage small and fits the privacy model, while history lives on the devices." },
      { title: "Persistent connections", body: "Phones keep one long-lived connection open to a chat server, so messages arrive instantly without polling and the server knows who is online." },
      { title: "Media out of band", body: "Photos and videos are encrypted on the device, uploaded once to object storage through the media service, and messages carry only a reference and the key." },
    ],
    scaling: [
      "Each chat server holds a very large number of mostly idle connections; add servers as users grow and keep a registry of which server holds which user.",
      "Group fan-out is the expensive path, so it runs through the queue and large groups are capped.",
      "Presence is kept in a cache and updates are batched, since status changes far more often than messages are sent.",
    ],
    faq: [
      { question: "How does WhatsApp deliver messages?", answer: "Phones keep a persistent connection to a chat server. A message goes to the server, is stored until the recipient's device receives it, and is pushed over the recipient's connection, or via a push notification if they are offline. Delivery and read receipts travel back the same way." },
      { question: "How does end-to-end encryption work in a messenger?", answer: "Each device has its own key pair. The sender encrypts the message with keys derived from the recipient's public key, so only the recipient's device can decrypt it; the server only relays and briefly stores ciphertext." },
      { question: "Is this WhatsApp's real architecture?", answer: "No. It is a typical design for a WhatsApp-style messenger based on public information, not WhatsApp's internal system." },
    ],
  },

  twitter: {
    overview: [
      "A Twitter-style service lets anyone post short messages and shows each user a timeline of posts from the accounts they follow. Reads outnumber writes by orders of magnitude, so the design precomputes timelines instead of building them on every request.",
      "In the diagram, clients call an API gateway. The tweet service stores tweets in a NoSQL database and hands each new tweet to a fan-out service, which reads the social graph and appends the tweet to followers' timelines in Redis. The timeline service reads those cached timelines; an event stream feeds search indexing and notifications; media goes through its own service to object storage and the CDN.",
    ],
    flows: [
      {
        title: "Posting a tweet",
        steps: [
          "The client sends the tweet through the API gateway and load balancer to the tweet service, which stores it in the NoSQL database.",
          "The fan-out service looks up the author's followers in the social graph and appends the tweet id to each follower's timeline in the cache.",
          "The tweet event goes onto the event stream, which updates the search index and triggers notifications for mentions.",
        ],
      },
      {
        title: "Reading the home timeline",
        steps: [
          "The timeline service reads the user's precomputed list of tweet ids from the cache.",
          "It hydrates them with tweet content and returns the page; images and video load from the CDN.",
        ],
      },
    ],
    decisions: [
      { title: "Fan-out on write", body: "Writing each tweet into every follower's timeline makes reading a timeline a single cache read. The cost moves to posting, which is fine because most users have few followers and reads dominate." },
      { title: "A hybrid for celebrities", body: "Fanning out a tweet from an account with tens of millions of followers would mean millions of writes. Those accounts are usually merged into timelines at read time instead." },
      { title: "Timelines in memory", body: "Timelines are lists of recent tweet ids, kept in Redis. They can always be rebuilt from the tweet store and the social graph, so the cache does not need to be durable." },
      { title: "Search from the stream", body: "Indexing tweets from the event stream keeps search off the write path and lets the index fall behind briefly without slowing posting." },
    ],
    scaling: [
      "Partition tweets by tweet id and timelines by user id so load spreads evenly.",
      "Keep cached timelines only for active users and rebuild the rest on demand.",
      "Scale fan-out workers with the posting rate; spikes during big events are absorbed by the queue.",
    ],
    faq: [
      { question: "How does Twitter build the home timeline?", answer: "Mostly by fan-out on write: when someone tweets, the tweet id is added to each follower's timeline in an in-memory cache, so reading a timeline is a single lookup. Tweets from accounts with huge followings are merged in at read time." },
      { question: "What is fan-out in system design?", answer: "Delivering one item to many recipients. Fan-out on write pushes it to every recipient's feed when it is created; fan-out on read collects it from all sources when a feed is opened." },
      { question: "Is this Twitter's (X's) real architecture?", answer: "No. It is a representative design for a Twitter-style timeline service based on public information." },
    ],
  },

  airbnb: {
    overview: [
      "An Airbnb-style marketplace connects guests looking for a place to stay with hosts who list homes. The two hard parts are search (location, dates, price and filters at once) and booking (never letting two guests reserve the same nights).",
      "In the diagram, the web client reaches an API gateway and load balancer in front of search, listing, availability, booking, payment, messaging and review services. Search runs on a geo-aware index, listings are cached, availability calendars and bookings live in the database, and booking events drive notifications.",
    ],
    flows: [
      {
        title: "Searching and booking a stay",
        steps: [
          "The guest searches by place and dates; the search service queries the search index for listings in that area with free dates and matching filters.",
          "Opening a listing loads it from the listing service (from the in-memory cache when hot) with photos from the CDN.",
          "Booking goes to the booking service, which asks the availability service to hold the dates and the payment service to charge the guest.",
          "Once confirmed, a booking event goes onto the queue and the notification service tells the guest and the host.",
        ],
      },
    ],
    decisions: [
      { title: "Hold dates atomically", body: "Two guests can try to book the same nights at once. The availability service reserves the dates in a single transaction (or with a conditional update) before payment, so only one booking can win." },
      { title: "A separate search index", body: "Searching by map area, dates and many filters is a job for a search engine with geo queries. The index is updated from listing changes, so searches never load the main database." },
      { title: "Charge after the hold", body: "Holding the dates first and charging second means a failed payment simply releases the hold, and a guest is never charged for dates they did not get." },
    ],
    scaling: [
      "Search traffic is far larger than booking traffic, so the search tier and index scale independently.",
      "Cache listing pages aggressively; prices and availability are checked again at booking time.",
      "Partition bookings and calendars by listing, so all writes for one home stay together.",
    ],
    faq: [
      { question: "How does Airbnb prevent double bookings?", answer: "The availability service reserves the dates for one booking atomically, for example with a transaction or a conditional update on the listing's calendar, before charging the guest. A second request for the same nights fails the check." },
      { question: "How does search by location and dates work?", answer: "Listings are indexed in a search engine that supports geo queries. A search filters by map area and price, and excludes listings whose calendars are blocked for the requested dates." },
      { question: "Is this Airbnb's real architecture?", answer: "No. It is a typical design for a booking marketplace based on public information." },
    ],
  },

  discord: {
    overview: [
      "A Discord-style platform runs millions of communities (guilds) with text channels, voice channels and live presence. Every message must reach everyone viewing a channel within moments, and the full history must stay searchable for years.",
      "In the diagram, clients use REST through an API gateway for actions and a WebSocket gateway for live events. Guild, message, voice and session services sit behind them; messages are stored in a NoSQL database partitioned by channel, attachments go through a media pipeline to object storage, and metrics and traces cover the whole system.",
    ],
    flows: [
      {
        title: "Posting in a channel",
        steps: [
          "The client sends the message through the API gateway; the auth service verifies the token and the guild service checks the member's permissions for that channel.",
          "The message service stores it in the NoSQL database, keyed by channel and time.",
          "It publishes the message to the WebSocket gateway, which pushes it to every member currently connected and viewing that guild.",
          "Attachments go through the media pipeline to object storage and are served through the CDN.",
        ],
      },
      {
        title: "Joining a voice channel",
        steps: [
          "The guild service checks the member may join and the voice service assigns a voice server for the channel.",
          "The client connects to that voice server directly for audio; the session service updates presence so others see who is in the channel.",
        ],
      },
    ],
    decisions: [
      { title: "REST for actions, WebSockets for events", body: "Sending a message, editing a role or creating a channel are ordinary requests. Everything that happens to you (new messages, typing, presence) arrives as events over one persistent WebSocket connection." },
      { title: "Messages partitioned by channel and time", body: "Reads are almost always the latest messages in one channel, so storing messages in a wide-column store keyed by channel and time bucket makes those reads cheap and keeps huge histories spread across nodes." },
      { title: "Voice on separate servers", body: "Voice is latency-sensitive real-time media, unlike chat. Dedicated voice servers handle it, close to users, and the rest of the system only coordinates who is where." },
    ],
    scaling: [
      "Shard the WebSocket gateway by guild, so all events for one community go through a known set of servers.",
      "Very large guilds fan events out only to members who are online, and lazily load member lists.",
      "Metrics and tracing on the session and message paths are how slow fan-out is found before users notice.",
    ],
    faq: [
      { question: "How does Discord deliver messages in real time?", answer: "Clients hold a WebSocket connection to a gateway. When a message is posted, it is stored and then published to the gateway servers responsible for that guild, which push it to every connected member." },
      { question: "How does Discord store billions of messages?", answer: "In a distributed wide-column database, with messages partitioned by channel and time window, so the latest messages of a channel are read from one partition and history spreads across the cluster." },
      { question: "Is this Discord's real architecture?", answer: "No. It is a representative design for a Discord-style platform based on public information." },
    ],
  },

  zoom: {
    overview: [
      "A Zoom-style video conferencing system lets many people see and hear each other with as little delay as possible. Media takes a different path from everything else: signaling sets the call up, and audio and video then flow through media servers built for real-time traffic.",
      "In the diagram, clients join through a signaling server, which uses the meeting service to find the room and negotiates the session with the WebRTC server. Audio and video run through media servers, with a TURN server relaying for clients behind strict firewalls. Meeting state, chat and cloud recording are separate services, and recordings are processed by workers into object storage.",
    ],
    flows: [
      {
        title: "Joining a meeting",
        steps: [
          "The client schedules or signs in through the API gateway, and opens the meeting link.",
          "The signaling server looks up the room in the meeting service (live state in the in-memory cache, meetings in the SQL database).",
          "It negotiates the media session through the WebRTC server, exchanging codecs and network candidates.",
          "Audio and video flow to a media server, which forwards each participant's streams to the others; the TURN server relays traffic when a direct path is blocked.",
          "If recording is on, the media server streams to the recording service, which queues the recording for workers to transcode and store.",
        ],
      },
    ],
    decisions: [
      { title: "A forwarding media server", body: "Sending every participant's video to every other participant directly does not scale past a few people. A selective forwarding server receives each stream once and sends each viewer only the streams and quality they need." },
      { title: "UDP and adaptive quality", body: "Real-time media prefers a late frame dropped over a frame delivered late, so it uses UDP-based protocols and lowers resolution or frame rate as the network degrades." },
      { title: "TURN as a fallback", body: "Many corporate networks block direct connections. A TURN server relays the media so the call still works, at the cost of extra bandwidth on the relay." },
      { title: "Recording off the live path", body: "Recording streams to its own service and is processed later by workers, so transcoding and transcription never affect the live call." },
    ],
    scaling: [
      "Place media servers in many regions and connect each participant to the nearest one; large meetings cascade between servers.",
      "Signaling and meeting services are light and scale horizontally; media capacity is planned separately by bandwidth.",
      "Recording workers scale with the queue, and recordings are stored in object storage.",
    ],
    faq: [
      { question: "How does Zoom video conferencing work?", answer: "Clients first exchange connection details through a signaling server. Their audio and video then flow to a media server that forwards each participant's streams to the others, adapting quality to each connection." },
      { question: "What is a TURN server?", answer: "A relay that forwards media between participants when firewalls or NAT prevent a direct connection. It makes calls work on restrictive networks at the cost of relaying all of that participant's traffic." },
      { question: "Is this Zoom's real architecture?", answer: "No. It is a typical design for a video conferencing service based on public information about WebRTC-style systems." },
    ],
  },

  spotify: {
    overview: [
      "A Spotify-style music service streams a huge catalog of tracks, keeps each listener's playlists and library, and recommends what to play next. Audio files are served from a CDN; the services handle catalog, playback rights, playlists, search and recommendations.",
      "In the diagram, the client apps stream audio from the audio CDN and call the API gateway. Behind the load balancer sit auth, catalog, playback, playlist, search and recommendation services; listening events flow through Kafka into a data warehouse and the recommendation service; new releases are transcoded from object storage and pushed to the CDN.",
    ],
    flows: [
      {
        title: "Playing a track",
        steps: [
          "The app calls the API gateway; the auth service checks the account and subscription.",
          "The playback service checks the listener may play the track in their country and returns where to fetch it.",
          "The app streams the encoded audio from the audio CDN, buffering ahead to avoid gaps.",
          "A track-played event goes to the listening events stream, which feeds the data warehouse and the recommendation service.",
        ],
      },
      {
        title: "Publishing a release",
        steps: [
          "Uploaded audio lands in object storage, and the transcoding worker encodes it at several bitrates.",
          "The encoded files are pushed to the audio CDN, ready to stream.",
        ],
      },
    ],
    decisions: [
      { title: "Audio from the edge", body: "Streaming audio is most of the traffic. Serving encoded files from a CDN keeps playback fast and keeps the bytes off the application servers, which only answer small API calls." },
      { title: "Several bitrates per track", body: "Encoding each track at multiple qualities lets the app pick one for the connection and the listener's settings, and switch without stopping playback." },
      { title: "Listening events as the raw material", body: "Every play, skip and save is an event. Streaming them into a warehouse and the recommendation service is what personalised playlists and radio are built from." },
    ],
    scaling: [
      "Popular tracks stay hot in the CDN; the long tail is fetched from storage on demand.",
      "Recommendations are mostly computed in batch and served from storage, with lighter real-time updates from recent listening.",
      "Playlists and libraries are partitioned by user id.",
    ],
    faq: [
      { question: "How does Spotify stream music?", answer: "Tracks are encoded at several bitrates and cached on a CDN. The app asks the backend for permission and the file location, then streams the audio from the nearest CDN server while buffering ahead." },
      { question: "How do music recommendations work?", answer: "Listening events (plays, skips, saves) are collected into a data warehouse and used to find patterns between listeners and tracks; the recommendation service turns those into playlists and suggestions." },
      { question: "Is this Spotify's real architecture?", answer: "No. It is a representative design for a music streaming service based on public information." },
    ],
  },

  linkedin: {
    overview: [
      "A LinkedIn-style network is built on a graph of members and their connections. Profiles, the feed, people search and recommendations all depend on that graph, and the feed has to rank posts from a member's network, not just list them.",
      "In the diagram, clients reach an API gateway and load balancer. The user service reads profiles and connections from a graph database and cache; the feed service ranks candidate posts from the timeline service; a fan-out service distributes new posts; search runs on its own index; activity events go through a queue to notifications.",
    ],
    flows: [
      {
        title: "Opening the feed",
        steps: [
          "The client calls the API gateway; the auth service verifies the session.",
          "The feed service asks the timeline service for recent candidate posts from the member's network.",
          "It ranks them by relevance and returns the page; profile details come from the user service and its cache.",
        ],
      },
      {
        title: "Publishing a post",
        steps: [
          "The fan-out service looks up who should see the post in the connection graph.",
          "It appends the post to those members' feed stores and publishes an activity event, which the notification service turns into email and push notifications.",
        ],
      },
    ],
    decisions: [
      { title: "A graph store for connections", body: "Questions such as 'how am I connected to this person' or 'people you may know' are graph traversals. A graph database answers them directly instead of with many joins." },
      { title: "Ranking, not just recency", body: "Showing the most relevant posts first means scoring candidates (relationship, engagement, freshness) at read time, which is why the feed service is separate from the timeline store." },
      { title: "Search as its own system", body: "People and job search need full text, filters and ranking, so they run on a dedicated index kept in sync from profile changes." },
    ],
    scaling: [
      "Cache profiles and connection lists heavily; they are read far more often than they change.",
      "Partition the graph by member and keep second-degree lookups bounded.",
      "Fan-out and notifications run asynchronously from the queue so posting stays fast.",
    ],
    faq: [
      { question: "How does LinkedIn's feed work?", answer: "Candidate posts from a member's network are collected (partly precomputed by fan-out), then ranked by relevance signals such as relationship strength, engagement and freshness before the page is returned." },
      { question: "Why use a graph database for a social network?", answer: "Connections are a graph, and features like degrees of connection and 'people you may know' are traversals that a graph store answers efficiently." },
      { question: "Is this LinkedIn's real architecture?", answer: "No. It is a typical design for a professional network based on public information." },
    ],
  },

  figma: {
    overview: [
      "A Figma-style design tool lets many people edit the same file at once in the browser, seeing each other's cursors and changes live. The editor itself runs in the browser; the server's job is to merge edits, broadcast them and keep the file safe.",
      "In the diagram, the browser editor connects over a WebSocket through a load balancer to a multiplayer server for that file. A CRDT engine merges concurrent edits, a presence service shares cursors, a pub/sub bus broadcasts changes, version history checkpoints the file to object storage, and an API gateway with auth and a SQL database handles files, teams and permissions.",
    ],
    flows: [
      {
        title: "Editing together",
        steps: [
          "Opening a file goes through the API gateway, where the auth service checks the user's access in the SQL database.",
          "The editor opens a WebSocket, and the load balancer routes it to the multiplayer server responsible for that file.",
          "Each change is sent as a small operation; the CRDT engine merges it with others' changes and the result is broadcast to everyone in the file.",
          "Cursor moves go to the presence service, which shares them without storing them durably.",
          "Version history periodically checkpoints the file to object storage; workers produce thumbnails and exports.",
        ],
      },
    ],
    decisions: [
      { title: "One server per file", body: "Routing every editor of a file to the same multiplayer process gives that file a single place where edits are ordered and merged, which keeps the merge logic simple and fast." },
      { title: "Property-level merging", body: "Conflicts are resolved per object property (last writer wins on the same property), using CRDT-style rules, so two people moving different layers never conflict." },
      { title: "Snapshots, not a database per edit", body: "Edits are held in memory on the multiplayer server and checkpointed regularly, which keeps editing fast; the checkpoint interval bounds how much could be replayed after a crash." },
    ],
    scaling: [
      "Spread files across many multiplayer servers; a busy file only affects its own server.",
      "Presence updates are frequent and throwaway, so they stay in memory and are throttled.",
      "Exports and thumbnails run on workers so heavy rendering never slows the live session.",
    ],
    faq: [
      { question: "How does Figma multiplayer work?", answer: "Everyone editing a file connects to the same server process for that file. Each change is sent as a small operation, merged with others using conflict-free rules, and broadcast to all collaborators, while cursors are shared through a separate presence channel." },
      { question: "What is a CRDT in collaborative design tools?", answer: "A conflict-free replicated data type: a way of structuring the document so concurrent changes can be merged automatically and every copy ends up the same." },
      { question: "Is this Figma's real architecture?", answer: "No. It is a representative design for a multiplayer design tool based on public information." },
    ],
  },

  github: {
    overview: [
      "A GitHub-style code host stores Git repositories, lets teams review changes in pull requests, runs CI on every push and notifies integrations through webhooks. Git traffic and web traffic arrive through different protocols but share accounts, permissions and events.",
      "In the diagram, the web client uses an API gateway and the Git client connects over HTTPS or SSH through a load balancer. The repository service reads and writes replicated Git storage; the pull request service handles reviews and merges; push and PR events go onto an event queue that starts Actions runners, delivers webhooks and runs background jobs such as code indexing for search.",
    ],
    flows: [
      {
        title: "Pushing code",
        steps: [
          "git push connects over HTTPS or SSH; the auth service checks the token or SSH key.",
          "The repository service writes the new objects and updates the branch in Git storage, replicated across several servers.",
          "A push event goes onto the event queue.",
          "Actions runners pick up matching workflows, the webhook handler notifies integrations, and a worker re-indexes the changed code for search.",
        ],
      },
      {
        title: "Reviewing a pull request",
        steps: [
          "The pull request service computes the diff between branches from the repository service and stores reviews and comments in the database.",
          "Merging updates the target branch in Git storage and emits a PR event that triggers the same downstream work.",
        ],
      },
    ],
    decisions: [
      { title: "Replicated Git storage", body: "Repositories are stored as Git data on several servers at once, so a disk or machine failure does not lose code and reads can be spread across replicas." },
      { title: "Events drive everything after a push", body: "CI, webhooks, notifications and search indexing all react to push and PR events from a queue, so a push returns as soon as the code is stored." },
      { title: "Two front doors", body: "Web and API traffic go through the API gateway; Git protocol traffic goes through its own load balancer to the repository service, since it is long-lived and bandwidth-heavy." },
    ],
    scaling: [
      "Partition repositories across storage servers; very large monorepos get dedicated capacity.",
      "Actions runners scale with the job queue and are isolated per job.",
      "Webhook delivery retries with backoff so a slow integration cannot hold up the queue.",
    ],
    faq: [
      { question: "How does GitHub store repositories?", answer: "As Git data on storage servers, with each repository replicated to several servers so it survives failures. A repository service handles push and fetch on top of that storage." },
      { question: "How do GitHub webhooks work?", answer: "When something happens (a push, a pull request, an issue), an event is queued and a webhook handler sends an HTTP POST describing it to every URL configured for that repository, retrying if delivery fails." },
      { question: "Is this GitHub's real architecture?", answer: "No. It is a typical design for a code hosting platform based on public information." },
    ],
  },

  rate_limiter: {
    overview: [
      "A rate limiter caps how many requests a client may make in a period, protecting the API from abuse and overload and enforcing plan limits. In a system with many API servers, the limit must be shared, so the counters live in a fast central store.",
      "In the diagram, requests reach the API gateway, where a distributed rate limiter checks each one. It reads limits from a rules service and applies a token bucket backed by counters in Redis; allowed requests continue to the load balancer and API servers, rejected ones get HTTP 429 and are counted in metrics, and heavy work can be deferred to a queue.",
    ],
    flows: [
      {
        title: "Checking a request",
        steps: [
          "The request reaches the API gateway, which passes it to the rate limiter middleware.",
          "The limiter identifies the client (API key, user id or IP) and looks up its limit from the rules service, cached locally.",
          "The token bucket takes one token for that client with an atomic operation in Redis.",
          "If a token was available, the request continues through the load balancer to the API servers; if not, the client gets 429 Too Many Requests with a Retry-After header and the rejection is recorded in metrics.",
        ],
      },
    ],
    decisions: [
      { title: "Token bucket", body: "Each client has a bucket that refills at a steady rate up to a maximum. It allows short bursts while enforcing an average rate, and needs only two values per client. Sliding windows are more exact but cost more memory." },
      { title: "Shared counters in Redis", body: "With many gateway instances, each one counting alone would let a client exceed the limit several times over. A central store with atomic operations (or a Lua script) keeps one count per client." },
      { title: "Fail open or fail closed", body: "If Redis is unreachable the limiter must decide: allow traffic (fail open) to keep the API up, or reject it (fail closed) to protect the backend. Most public APIs fail open with a local fallback limit." },
    ],
    scaling: [
      "Shard counters by client id across Redis nodes; each check is one small atomic call.",
      "Cache rules in memory on every gateway so the rules service is not on the hot path.",
      "For very high traffic, count locally and sync with Redis in small batches, trading a little accuracy for latency.",
    ],
    faq: [
      { question: "How do you design a rate limiter?", answer: "Identify each client, keep a counter or token bucket per client in a fast shared store such as Redis, update it atomically on every request, and reject requests over the limit with HTTP 429 and a Retry-After header." },
      { question: "Token bucket vs sliding window: which is better?", answer: "Token bucket allows bursts up to a set size while enforcing an average rate, with little state per client. A sliding window log is exact but stores every request time; the sliding window counter is a cheap approximation of it." },
      { question: "Where should a rate limiter run?", answer: "Usually at the API gateway or as middleware in front of every API server, so requests are rejected before they reach the application." },
    ],
  },
};

export function getTemplateGuide(templateId: string): TemplateGuide | undefined {
  return TEMPLATE_GUIDES[templateId];
}
