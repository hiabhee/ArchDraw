import { defineTutorial, level, step } from '@/lib/tutorial/builder';

const youtubeTutorial = defineTutorial({
  id: 'youtube-architecture',
  title: 'How to Design YouTube Architecture',
  description: 'Build the video platform serving 2 billion users. Learn about video encoding, CDN delivery, recommendations, and scalable architecture.',
  difficulty: 'advanced',
  estimatedMinutes: 75,
  tags: ['video', 'cdn', 'recommendations'],
  icon: 'Play',
  color: '#FF0000',

  levels: [
    level({
      title: 'Video Foundation',
      steps: [
        step({
          component: 'CDN',
          nodeType: 'cdn',
          noConnect: true,
          phases: {
            context: { heading: 'Welcome to YouTube Architecture', body: 'YouTube serves 2 billion logged-in users monthly. Video delivery starts at the edge — 80% of watch time is served from CDN caches inside ISP networks.' },
            intro: { heading: 'About CDNs', body: 'CDNs cache video segments at edge locations close to viewers, minimizing buffering and origin load.' },
            teaching: { heading: 'Deep dive: CDN', body: 'YouTube\'s CDN (Google Global Cache) deploys servers directly inside ISP networks — your video might come from a server in the same building as your router. For video, CDN caching is critical: a popular music video might be watched 100 million times, but the CDN serves 99% of those views from edge cache, protecting YouTube\'s origin infrastructure.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'CDN', and add the CDN." },
            connecting: { heading: 'Connect it up', body: 'First step — no connections yet.' },
            celebration: { heading: 'Great job!', body: 'CDN added.' },
          },
          hints: ['Search for "CDN"'],
        }),
        step({
          component: 'Web Client',
          nodeType: 'client_web',
          parent: 'CDN',
          phases: {
            context: { heading: 'Step 2: Web Client', body: 'The web and TV clients request manifests and segments from the CDN while handling uploads, comments, and recommendations.' },
            intro: { heading: 'About the Web Client', body: 'The YouTube web client is a complex SPA that handles video playback, upload management, comments, and personalized recommendations.' },
            teaching: { heading: 'Deep dive: Web Client', body: 'The YouTube client implements adaptive bitrate streaming (ABR) — it monitors network bandwidth in real-time and switches between quality levels (144p to 4K) every few seconds. It also handles the upload pipeline: chunked uploads with resume capability, progress tracking, and metadata editing. The client must work on 2,000+ device types from 4K Smart TVs to budget Android phones. Without adaptive streaming, users on slow connections would buffer constantly.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Web Client', and add the Web Client." },
            connecting: { heading: 'Connect it up', body: 'Connect CDN \u2192 Web Client.' },
            celebration: { heading: 'Great job!', body: 'Web Client added.' },
          },
          hints: ['Search for "Web"', 'Connect CDN to Web Client'],
        }),
        step({
          component: 'API Gateway',
          nodeType: 'api_gateway',
          parent: 'Web Client',
          phases: {
            context: { heading: 'Step 3: API Gateway', body: 'The API Gateway routes all non-video requests — search, comments, subscriptions, channel management — to backend services.' },
            intro: { heading: 'About API Gateways', body: 'API gateways provide a unified entry point, handling authentication, rate limiting, and request routing.' },
            teaching: { heading: 'Deep dive: API Gateway', body: 'YouTube\'s API Gateway handles 1 billion API calls per day. It routes search queries to the Search Service, comment operations to the Comment Service, and subscription changes to the Subscription Service. The gateway enforces per-user quotas and implements request coalescing — if 100 users request the same trending video metadata simultaneously, only one request hits the backend, and the response is shared.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'API Gateway', and add it." },
            connecting: { heading: 'Connect it up', body: 'Connect Web Client \u2192 API Gateway.' },
            celebration: { heading: 'Great job!', body: 'API Gateway added.' },
          },
          hints: ['Search for "API Gateway"', 'Connect Web Client to it'],
        }),
        step({
          component: 'Video Service',
          nodeType: 'media_service',
          parent: 'API Gateway',
          phases: {
            context: { heading: 'Step 4: Video Service', body: 'The Video Service manages the entire video lifecycle — upload, processing, metadata, and playback URL generation.' },
            intro: { heading: 'About Video Services', body: 'Video services handle upload ingestion, metadata management, and playback URL generation.' },
            teaching: { heading: 'Deep dive: Video Service', body: 'When you upload a video, the Video Service receives chunks via resumable upload protocol, stores the raw file, and triggers the transcoding pipeline. It manages video metadata (title, description, tags, thumbnail) and generates signed playback URLs that route viewers to the nearest CDN edge. The service must handle 500 hours of new video uploaded every minute — that is 3.5TB of raw video per minute entering the processing pipeline.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Video Service', and add the Video Service." },
            connecting: { heading: 'Connect it up', body: 'Connect API Gateway \u2192 Video Service.' },
            celebration: { heading: 'Great job!', body: 'Video Service added.' },
          },
          hints: ['Search for "Video Service"', 'Connect API Gateway to it'],
        }),
        step({
          component: 'Object Storage',
          nodeType: 'object_storage',
          parent: 'Video Service',
          phases: {
            context: { heading: 'Step 5: Object Storage', body: 'YouTube stores over 800 million videos in Google Cloud Storage — over 1 exabyte of video data. Object storage provides the infinite scalability needed for this volume.' },
            intro: { heading: 'About Object Storage', body: 'Object storage stores unbounded amounts of unstructured data (videos, images, documents) with high durability and global replication.' },
            teaching: { heading: 'Deep dive: Object Storage', body: 'Google Cloud Storage provides 11 nines of durability (99.999999999%) for YouTube\'s video library. Each video is stored as a single object with metadata (resolution, duration, encoding format). Object storage scales horizontally — adding more data just means adding more disks, no database sharding required. Without object storage, YouTube could not store 800M+ videos with the durability and availability guarantees users expect.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Object Storage', and add it." },
            connecting: { heading: 'Connect it up', body: 'Connect Video Service \u2192 Object Storage.' },
            celebration: { heading: 'Great job!', body: 'Object Storage added. Videos can now be stored.' },
          },
          hints: ['Search for "Object Storage"', 'Connect Video Service to it'],
        }),
      ],
    }),
    level({
      title: 'Production Ready',
      steps: [
        step({
          component: 'Transcoding',
          nodeType: 'transcoding_worker',
          parent: 'Object Storage',
          phases: {
            context: { heading: 'Level 2: Transcoding', body: 'Every uploaded video must be transcoded into 10+ quality formats (144p to 4K, multiple codecs). YouTube transcodes 500 hours of video per minute.' },
            intro: { heading: 'About Transcoding', body: 'Transcoding converts video from one format/codec/resolution to another, enabling playback on all devices.' },
            teaching: { heading: 'Deep dive: Transcoding', body: 'YouTube\'s transcoding pipeline reads the raw upload from object storage and produces 10+ output files at different resolutions (144p, 240p, 360p, 480p, 720p, 1080p, 1440p, 4K) and codecs (H.264, VP9, AV1). Each output is segmented into 2-second chunks for adaptive bitrate streaming. The pipeline uses distributed GPU clusters that can transcode one hour of video in under 2 minutes. Without transcoding, only users with the exact same device and bandwidth as the uploader could watch the video.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Transcoding', and add the Transcoding pipeline." },
            connecting: { heading: 'Connect it up', body: 'Connect Object Storage \u2192 Transcoding.' },
            celebration: { heading: 'Great job!', body: 'Transcoding pipeline added.' },
          },
          hints: ['Search for "Transcoding"', 'Connect Object Storage to it'],
        }),
        step({
          component: 'Search Service',
          nodeType: 'search_service',
          parent: 'API Gateway',
          phases: {
            context: { heading: 'Level 2: Search Service', body: 'YouTube search indexes titles, descriptions, and auto-captions across 800M+ videos.' },
            intro: { heading: 'About Search Services', body: 'Search services power query autocomplete and ranked video results.' },
            teaching: { heading: 'Deep dive: Search Service', body: 'Search combines lexical matching with watch-time signals. Trending queries are pre-warmed in cache so the homepage loads instantly during live events.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Search Service', and add it." },
            connecting: { heading: 'Connect it up', body: 'Connect API Gateway \u2192 Search Service.' },
            celebration: { heading: 'Great job!', body: 'Search Service added.' },
          },
          hints: ['Search for "Search Service"', 'Connect API Gateway to it'],
        }),
      ],
    }),
    level({
      title: 'Expert Architecture',
      steps: [
        step({
          component: 'Recommendation',
          nodeType: 'recommendation_service',
          parent: 'API Gateway',
          phases: {
            context: { heading: 'Level 3: Recommendation Engine', body: 'YouTube\'s recommendation engine drives 70% of all views. It analyzes watch history, engagement signals, and similar user patterns to suggest videos.' },
            intro: { heading: 'About Recommendation Engines', body: 'Recommendation engines use machine learning to predict what content a user will engage with based on their history and similar users\' behavior.' },
            teaching: { heading: 'Deep dive: Recommendation', body: 'YouTube\'s recommendation system uses a two-stage architecture: candidate generation (select 100 videos from millions using collaborative filtering) and ranking (score each candidate using a deep neural network trained on watch time, likes, and shares). It processes 800 million videos and 2 billion user profiles in real-time. The system must balance relevance with diversity — showing only one type of content leads to "filter bubbles" that reduce engagement. Without recommendations, users would have to manually search for every video, drastically reducing watch time.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Recommendation', and add the Recommendation." },
            connecting: { heading: 'Connect it up', body: 'Connect API Gateway \u2192 Recommendation.' },
            celebration: { heading: 'Great job!', body: 'Recommendation added. Your YouTube architecture is complete!' },
          },
          hints: ['Search for "Recommendation"', 'Connect API Gateway to it'],
        }),
      ],
    }),
  ],
});

export default youtubeTutorial;
