import { defineTutorial, level, step } from '@/lib/tutorial/builder';

const instagramTutorial = defineTutorial({
  id: 'instagram-architecture',
  title: 'How to Design Instagram Architecture',
  description: 'Instagram serves 2B+ monthly active users sharing 100M+ photos daily. Learn how CDN, distributed storage, ML recommendations, and the follower graph work at global scale.',
  difficulty: 'intermediate',
  estimatedMinutes: 60,
  tags: ['social-media', 'cdn', 'media-storage'],
  icon: 'Camera',
  color: '#E4405F',

  levels: [
    level({
      title: 'The Foundation',
      steps: [
        step({
          component: 'Mobile Client',
          nodeType: 'client_mobile',
          phases: {
            context: { heading: 'Welcome to Instagram Architecture', body: "Let's build Instagram from scratch. Level 1 is the foundation \u2014 8 components that handle photo uploads." },
            intro: { heading: 'Do you know about Mobile Clients?', body: 'The Mobile Client is the iOS or Android app where users upload photos.' },
            teaching: { heading: 'Deep dive: Mobile Client', body: 'The Mobile Client is the iOS or Android app where users upload photos, scroll their feed, and interact with content. 95% of Instagram usage is mobile.' },
            action: { heading: 'Your turn!', body: "Press \u2318K and search for 'Mobile' to add the client." },
            connecting: { heading: 'Connect it up', body: 'First step, no connections needed.' },
            celebration: { heading: 'Great job!', body: 'Mobile Client added. Now the Web Client.' },
          },
          hints: ['Search for "Mobile"', 'Add Mobile Client'],
        }),
        step({
          component: 'Web Client',
          nodeType: 'client_web',
          phases: {
            context: { heading: 'Level 1: Step 2', body: 'Adding the Web Client \u2014 browser-based version.' },
            intro: { heading: 'Do you know about Web Clients?', body: 'Web clients provide browser-based access.' },
            teaching: { heading: 'Deep dive: Web Client', body: "Instagram's Web Client is the browser-based version used primarily for browsing and messaging." },
            action: { heading: 'Your turn!', body: "Press \u2318K and search for 'Web' to add it." },
            connecting: { heading: 'Connect it up', body: 'Second client, no connections yet.' },
            celebration: { heading: 'Great job!', body: 'Web Client added. Now the CDN.' },
          },
          hints: ['Search for "Web"', 'Add Web Client'],
        }),
        step({
          component: 'CDN',
          nodeType: 'cdn',
          parents: ['Mobile Client', 'Web Client'],
          phases: {
            context: { heading: 'Level 1: Step 3', body: 'Adding the CDN for media delivery.' },
            intro: { heading: 'Do you know about CDNs?', body: 'CDNs serve content from edge servers.' },
            teaching: { heading: 'Deep dive: CDN', body: 'The CDN serves photos, videos, and static assets from edge servers worldwide.' },
            action: { heading: 'Your turn!', body: "Press \u2318K and search for 'CDN' to add it." },
            connecting: { heading: 'Connect it up', body: 'Connect Mobile \u2192 CDN and Web \u2192 CDN.' },
            celebration: { heading: 'Great job!', body: 'CDN added. Now the API Gateway.' },
          },
          hints: ['Search for "CDN"', 'Connect both clients to CDN'],
        }),
        step({
          component: 'API Gateway',
          nodeType: 'api_gateway',
          parents: ['Mobile Client', 'Web Client'],
          phases: {
            context: { heading: 'Level 1: Step 4', body: 'Adding API Gateway for API routing.' },
            intro: { heading: 'Do you know about API Gateways?', body: 'API Gateways route API requests.' },
            teaching: { heading: 'Deep dive: API Gateway', body: 'The API Gateway handles all non-media API requests \u2014 feed loading, post creation, likes, comments.' },
            action: { heading: 'Your turn!', body: "Press \u2318K and search for 'API Gateway' to add it." },
            connecting: { heading: 'Connect it up', body: 'Connect clients to API Gateway.' },
            celebration: { heading: 'Great job!', body: 'API Gateway added. Now the Upload Pipeline.' },
          },
          hints: ['Search for "API Gateway"', 'Connect clients to it'],
        }),
        step({
          component: 'Upload Service', nodeType: 'upload_service', parent: 'API Gateway',
          phases: {
            context: { heading: 'Step 5: Upload Service', body: 'Instagram handles 100M+ photo uploads daily. The Upload Service manages the initial intake and validation.' },
            intro: { heading: 'About Upload Services', body: 'Upload services validate file type and size, generate thumbnails, and route to processing pipelines.' },
            teaching: { heading: 'Deep dive: Upload Service', body: 'The Upload Service accepts multipart uploads up to 60MB, validates file type (rejecting executables disguised as images), generates a unique upload ID, and pushes the raw file to object storage. It then enqueues a processing job for the Media Service. Without this validation layer, malformed or malicious files would enter the processing pipeline and cause failures downstream.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Upload', and add the Upload Service." },
            connecting: { heading: 'Connect it up', body: 'Connect API Gateway \u2192 Upload Service.' },
            celebration: { heading: 'Great job!', body: 'Upload Service added.' },
          },
          hints: ['Search for "Upload"', 'Connect API Gateway to it'],
        }),
        step({
          component: 'Media Service', nodeType: 'media_service', parent: 'Upload Service',
          phases: {
            context: { heading: 'Step 6: Media Service', body: 'Every uploaded photo must be resized into 8+ variants (thumbnail, feed, story, profile) across multiple formats.' },
            intro: { heading: 'About Media Services', body: 'Media services handle image transcoding, resizing, format conversion, and quality optimization.' },
            teaching: { heading: 'Deep dive: Media Service', body: 'The Media Service generates 8 resized variants per upload (150x150 thumbnail through 1080x1080 full-size) in WebP, AVIF, and JPEG formats. This is compute-intensive: 100M daily uploads × 8 variants = 800M image operations. The service uses a GPU-accelerated processing cluster with auto-scaling to handle peak hours (typically 7-10pm local time).' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Media', and add the Media Service." },
            connecting: { heading: 'Connect it up', body: 'Connect Upload Service \u2192 Media Service.' },
            celebration: { heading: 'Great job!', body: 'Media Service added.' },
          },
          hints: ['Search for "Media"', 'Connect Upload Service to it'],
        }),
        step({
          component: 'Media Server', nodeType: 'media_server', parent: 'Media Service', aliases: ['object_storage'],
          phases: {
            context: { heading: 'Step 7: Media Server', body: 'Processed images need durable, globally distributed storage with sub-50ms read latency.' },
            intro: { heading: 'About Media Servers', body: 'Object storage systems store blobs (images, videos) with high durability and global distribution.' },
            teaching: { heading: 'Deep dive: Media Server', body: 'Instagram stores 200+ petabytes of photos and videos. The Media Server (S3-compatible object storage) provides 99.999999999% durability (11 nines). Each uploaded photo is stored with its original plus all resized variants. The CDN pulls from this origin on cache miss. Without redundant storage, a single disk failure could permanently delete millions of user photos.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Media Server', and add it." },
            connecting: { heading: 'Connect it up', body: 'Connect Media Service \u2192 Media Server.' },
            celebration: { heading: 'Great job!', body: 'Media Server added.' },
          },
          hints: ['Search for "Media Server"', 'Connect Media Service to it'],
        }),
      ],
    }),
    level({
      title: 'Production Ready',
      steps: [
        step({
          component: 'SQL Database', nodeType: 'sql_db', parent: 'API Gateway',
          phases: {
            context: { heading: 'Level 2: SQL Database', body: 'User accounts, posts, comments, and likes need ACID transactions — a relational database is required for consistency.' },
            intro: { heading: 'About SQL Databases', body: 'SQL databases provide transactional integrity for structured data like user accounts and social interactions.' },
            teaching: { heading: 'Deep dive: SQL Database', body: 'Instagram\'s PostgreSQL cluster stores user profiles, posts, comments, and follower relationships. The follower graph alone has 2 billion edges (who follows whom). Unlike media data, social interactions require strong consistency — a "like" count that shows 42 when 43 people liked it erodes user trust. PostgreSQL handles this with row-level locking on like count increments.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'SQL', and add the database." },
            connecting: { heading: 'Connect it up', body: 'Connect API Gateway \u2192 SQL Database.' },
            celebration: { heading: 'Great job!', body: 'SQL Database added.' },
          },
          hints: ['Search for "SQL"', 'Connect API Gateway to it'],
        }),
        step({
          component: 'Recommendation Service', nodeType: 'recommendation_service', parent: 'SQL Database',
          phases: {
            context: { heading: 'Step 2: Recommendation Service', body: 'Instagram\'s feed is algorithmically ranked, not chronological. The Recommendation Service decides what each user sees and in what order.' },
            intro: { heading: 'About Recommendation Services', body: 'Recommendation services use ML models to predict what content each user will engage with.' },
            teaching: { heading: 'Deep dive: Recommendation Service', body: 'The Recommendation Service combines collaborative filtering (users like you also liked...), content-based signals (this post\'s visual similarity to posts you\'ve engaged with), and real-time signals (time since post, relationship closeness). It must generate a ranked feed in <200ms while the user scrolls. The model re-ranks every 30 minutes as engagement data updates.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Recommendation', and add the Recommendation Service." },
            connecting: { heading: 'Connect it up', body: 'Connect SQL Database \u2192 Recommendation Service.' },
            celebration: { heading: 'Great job!', body: 'Recommendation Service added.' },
          },
          hints: ['Search for "Recommendation"', 'Connect SQL Database to it'],
        }),
      ],
    }),
    level({
      title: 'Expert Architecture',
      steps: [
        step({
          component: 'In-Memory Cache', nodeType: 'in_memory_cache', parent: 'API Gateway', aliases: ['app_cache'],
          phases: {
            context: { heading: 'Level 3: In-Memory Cache', body: 'Feed generation is the most read-heavy operation — caching pre-computed feeds eliminates redundant computation.' },
            intro: { heading: 'About In-Memory Caches', body: 'Caches store pre-computed results to avoid expensive recomputation on every request.' },
            teaching: { heading: 'Deep dive: In-Memory Cache', body: 'Instagram caches pre-generated feed pages in Redis. When a user opens the app, their feed is served from cache (0.5ms) instead of recomputing from 500+ candidate posts (200ms). The cache invalidates when a followed user posts new content. Cache hit rate for active users is 95%+, meaning only 5% of feed requests trigger full recomputation.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'In-Memory Cache', and add it." },
            connecting: { heading: 'Connect it up', body: 'Connect API Gateway \u2192 In-Memory Cache.' },
            celebration: { heading: 'Great job!', body: 'In-Memory Cache added.' },
          },
          hints: ['Search for "In-Memory Cache"', 'Connect API Gateway to it'],
        }),
        step({
          component: 'Analytics Service', nodeType: 'analytics_service', parent: 'SQL Database',
          phases: {
            context: { heading: 'Step 2: Analytics Service', body: 'Every like, comment, view, and share is a data point. The Analytics Service processes billions of events for insights and advertising.' },
            intro: { heading: 'About Analytics Services', body: 'Analytics services aggregate user behavior data for dashboards, A/B testing, and ad targeting.' },
            teaching: { heading: 'Deep dive: Analytics Service', body: 'The Analytics Service consumes from a Kafka stream of user events (views, likes, comments, shares, saves) and writes to a columnar store (Druid/ClickHouse). This powers: creator insights ("Your post reached 50K accounts"), ad targeting ("Show fitness ads to users who engage with workout content"), and product analytics ("Which filter is most popular in Brazil?"). The pipeline processes 10 billion events daily with sub-5-minute freshness.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Analytics', and add the Analytics Service." },
            connecting: { heading: 'Connect it up', body: 'Connect SQL Database \u2192 Analytics Service.' },
            celebration: { heading: 'Great job!', body: 'Analytics Service added. Your Instagram architecture is complete!' },
          },
          hints: ['Search for "Analytics"', 'Connect SQL Database to it'],
        }),
      ],
    }),
  ],
});

export default instagramTutorial;
