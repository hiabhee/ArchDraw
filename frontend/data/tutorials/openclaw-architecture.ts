import { defineTutorial, level, step } from '@/lib/tutorial/builder';

const openclawTutorial = defineTutorial({
  id: 'openclaw-architecture',
  title: 'How to Design OpenClaw Architecture',
  description: 'Build a subscription analytics platform. Learn event ingestion, Kafka streaming, analytics computation, cohort retention, and metrics visualization at scale.',
  difficulty: 'intermediate',
  estimatedMinutes: 35,
  tags: ['analytics', 'subscription', 'metrics'],
  icon: 'BarChart',
  color: '#6366F1',

  levels: [
    level({
      title: 'The Foundation',
      description: 'Build the request path from the web dashboard through the gateway and into the durable event log that powers every downstream metric.',
      steps: [
        step({
          component: 'Web Client',
          nodeType: 'client_web',
          phases: {
            context: {
              heading: 'Welcome to OpenClaw Architecture',
              body: "Let's build OpenClaw from scratch \u2014 a subscription analytics platform where finance and product teams watch MRR, churn, and cohort retention in real time. Level 1 is the foundation: events flow in, get validated, and land in a durable stream.",
            },
            intro: {
              heading: 'Do you know about Web Clients?',
              body: 'OpenClaw is a B2B product, so the web dashboard is the primary surface where analysts build reports and set up alerts.',
            },
            teaching: {
              heading: 'Deep dive: Web Client',
              body: "OpenClaw's web dashboard is where analysts build reports, filter by cohort, and export CSVs. It drives two kinds of traffic: interactive analytics queries and, from the product side, the SDK calls that emit subscription events.",
              whyItMatters: 'Without the web client, none of the product insight reaches the teams that need it. It is the only interface executives and analysts use to answer "is our business healthy?"',
              tradeoff: 'A rich dashboard queries warehouses directly, which is fast for curated views but slow for ad-hoc joins over raw events. Decide where to draw the line between live queries and precomputed panels.',
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
              body: 'The gateway is the single entry point for both event ingestion from customer SDKs and dashboard queries.',
            },
            intro: {
              heading: 'Do you know about API Gateways?',
              body: "OpenClaw's API Gateway terminates every connection: customer SDKs posting subscription events, and the dashboard issuing analytics queries.",
            },
            teaching: {
              heading: 'Deep dive: API Gateway',
              body: "The gateway authenticates customer API keys, validates the payload schema, applies per-customer rate limits, and routes events toward the ingest service while routing dashboard queries toward the analytics layer. One front door keeps cross-cutting concerns in one place.",
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
              body: 'API Gateway added. Now the ingestion service.',
            },
          },
          hints: ['Search for "API Gateway"', 'Connect Web Client to it'],
        }),
        step({
          component: 'Data Ingestion Service',
          nodeType: 'data_ingestion_service',
          parent: 'API Gateway',
          phases: {
            context: {
              heading: 'Adding the Data Ingestion Service',
              body: 'Raw subscription events are noisy \u2014 duplicate retries, partial payloads, unknown event types. The ingestion service cleans them before they reach the stream.',
            },
            intro: {
              heading: 'Do you know about Data Ingestion Services?',
              body: 'Ingestion validates, normalizes, and enriches incoming events so downstream consumers never see raw customer payloads.',
            },
            teaching: {
              heading: 'Deep dive: Data Ingestion Service',
              body: "The ingestion service dedupes retried events (using an idempotency key), enriches them with customer metadata and a server-side timestamp, and normalizes event names across SDK versions. Events that fail validation go to a dead-letter path instead of silently poisoning the stream.",
              whyItMatters: 'Bad data is worse than no data \u2014 one malformed event can skew an entire month of MRR. The ingestion service is the last line of defense before data becomes analysis.',
              tradeoff: 'Strict validation protects analytics quality but drops events from legacy SDK versions. Budget time to evolve the schema without breaking old customers.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Data Ingestion Service', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect API Gateway \u2192 Data Ingestion Service.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Ingestion added. Now the streaming backbone.',
            },
          },
          hints: ['Search for "Data Ingestion Service"', 'Connect API Gateway to it'],
        }),
        step({
          component: 'Kafka',
          nodeType: 'kafka_streaming',
          parent: 'Data Ingestion Service',
          phases: {
            context: {
              heading: 'Adding Kafka',
              body: 'Once events are clean, they must be durably logged before anything consumes them. Kafka is the backbone that decouples producers from consumers.',
            },
            intro: {
              heading: 'Do you know about Kafka?',
              body: 'Kafka is a distributed, append-only event log. Producers write, consumers read at their own pace, and nothing is lost once acknowledged.',
            },
            teaching: {
              heading: 'Deep dive: Kafka',
              body: "Every subscription event is written to a Kafka topic partitioned by customer_id. Partitioning preserves per-customer ordering, which matters for events like 'upgrade' followed by 'downgrade'. Consumers \u2014 the analytics service, the warehouse loader, and report workers \u2014 each read independently without slowing each other down.",
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Kafka / Streaming', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Data Ingestion Service \u2192 Kafka.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Kafka added. The foundation is complete.',
            },
          },
          hints: ['Search for "Kafka / Streaming"', 'Connect Data Ingestion Service to it'],
        }),
      ],
    }),
    level({
      title: 'The Analytics Pipeline',
      description: 'Turn the raw event stream into metrics, store them for fast reads, and keep the raw history for deep analysis.',
      steps: [
        step({
          component: 'Analytics Service',
          nodeType: 'analytics_service',
          parent: 'Kafka',
          phases: {
            context: {
              heading: 'Adding the Analytics Service',
              body: 'Level 2 is where events become business metrics. The analytics service consumes the stream and computes MRR, churn, expansion, and cohorts.',
            },
            intro: {
              heading: 'Do you know about Analytics Services?',
              body: 'Analytics services consume events and produce materialized metrics \u2014 the numbers that appear on dashboards.',
            },
            teaching: {
              heading: 'Deep dive: Analytics Service',
              body: "The analytics service consumes from Kafka with consumer groups and computes windowed aggregations: monthly recurring revenue, churn rate, cohort retention curves, and expansion revenue. It writes results to both a query database (for dashboards) and keeps per-customer state needed for cohort math.",
              whyItMatters: 'The whole product is these numbers. If the analytics service is wrong, finance makes decisions on broken data \u2014 this is the highest-stakes component in OpenClaw.',
              tradeoff: 'Event-time vs processing-time windows produce different cohort numbers. Streaming aggregations are approximate; exact numbers require a nightly batch reconciliation.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Analytics Service', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Kafka \u2192 Analytics Service.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Analytics Service added. Now the query store.',
            },
          },
          hints: ['Search for "Analytics Service"', 'Connect Kafka to it'],
        }),
        step({
          component: 'SQL Database',
          nodeType: 'sql_db',
          parent: 'Analytics Service',
          phases: {
            context: {
              heading: 'Adding the SQL Database',
              body: 'Dashboards need sub-second reads of materialized metrics. The analytics service writes results to a relational database optimized for point queries.',
            },
            intro: {
              heading: 'Do you know about SQL Databases?',
              body: 'The SQL Database stores the latest materialized metrics so dashboard queries never scan raw events.',
            },
            teaching: {
              heading: 'Deep dive: SQL Database',
              body: "The SQL database holds current metric values keyed by (customer_id, metric, period). It is written by the analytics service and read by the dashboard. Because it stores precomputed results rather than raw events, a single-row lookup answers 'what is our MRR?' in milliseconds.",
              whyItMatters: 'Without a query store, every dashboard view would recompute metrics from the event log on the fly \u2014 seconds of latency instead of milliseconds.',
              tradeoff: 'Storing precomputed metrics trades write complexity for read speed. A metric definition change means a backfill job to recompute history.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'SQL Database', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Analytics Service \u2192 SQL Database.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'SQL Database added. Now the raw-event store.',
            },
          },
          hints: ['Search for "SQL Database"', 'Connect Analytics Service to it'],
        }),
        step({
          component: 'Data Warehouse',
          nodeType: 'data_warehouse',
          parent: 'Kafka',
          phases: {
            context: {
              heading: 'Adding the Data Warehouse',
              body: 'Ad-hoc analysis needs the full event history, not just precomputed metrics. The warehouse stores raw events in columnar form for deep queries.',
            },
            intro: {
              heading: 'Do you know about Data Warehouses?',
              body: 'A warehouse is a columnar store optimized for analytical queries over huge volumes of historical data.',
            },
            teaching: {
              heading: 'Deep dive: Data Warehouse',
              body: "A loader consumes every event from Kafka and appends it to warehouse tables partitioned by month. Analysts query the warehouse directly for arbitrary questions \u2014 'churn by plan for customers who joined in Q1' \u2014 that no precomputed metric covers. OpenClaw's warehouse holds years of raw subscription events.",
              whyItMatters: 'Precomputed metrics answer known questions. The warehouse answers questions nobody thought to ask yet \u2014 without it, historical analysis is impossible.',
              tradeoff: 'Warehouses are optimized for bulk reads, not point lookups, and event history grows fast. Partition pruning and retention policies are required to keep query costs sane.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Data Warehouse', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Kafka \u2192 Data Warehouse.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Data Warehouse added. Now the surface layer.',
            },
          },
          hints: ['Search for "Data Warehouse"', 'Connect Kafka to it'],
        }),
      ],
    }),
    level({
      title: 'Production Ready',
      description: 'Make OpenClaw something a team can actually run: dashboards, alerting, and scheduled reporting.',
      steps: [
        step({
          component: 'Dashboard (Grafana)',
          nodeType: 'dashboard',
          parent: 'Data Warehouse',
          phases: {
            context: {
              heading: 'Adding the Dashboard',
              body: 'Metrics are only valuable when humans can see them. The dashboard visualizes warehouse data in real-time panels.',
            },
            intro: {
              heading: 'Do you know about Dashboards?',
              body: 'Dashboards render queries as live charts so teams monitor health at a glance instead of running ad-hoc SQL.',
            },
            teaching: {
              heading: 'Deep dive: Dashboard (Grafana)',
              body: "OpenClaw's dashboard surfaces the metrics that matter \u2014 MRR trend, churn rate, cohort retention heatmap \u2014 querying both the SQL database for live values and the warehouse for time-series panels. Panels run on a refresh cadence rather than per-view to protect warehouse cost.",
              whyItMatters: 'A system no one can read produces no decisions. The dashboard turns the analytics pipeline into something a finance team trusts daily.',
              tradeoff: 'Live dashboard queries on a warehouse are expensive. Batch the panels aggressively \u2014 a 5-minute stale chart is fine, a runaway query bill is not.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Dashboard (Grafana)', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Data Warehouse \u2192 Dashboard (Grafana).',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Dashboard added. Now alerting.',
            },
          },
          hints: ['Search for "Dashboard (Grafana)"', 'Connect Data Warehouse to it'],
        }),
        step({
          component: 'Alert Manager',
          nodeType: 'alert_manager',
          parent: 'Analytics Service',
          phases: {
            context: {
              heading: 'Adding the Alert Manager',
              body: 'Executives should hear about a churn spike before they open the dashboard. The alert manager watches metrics and notifies on call.',
            },
            intro: {
              heading: 'Do you know about Alert Managers?',
              body: 'Alert managers evaluate thresholds against metrics and page the right people when they breach.',
            },
            teaching: {
              heading: 'Deep dive: Alert Manager',
              body: "The alert manager watches computed metrics \u2014 churn rate, ingestion lag, failed-event rate \u2014 and fires when thresholds are breached. It routes to Slack, email, and on-call pages, and dedupes so a sustained spike sends one alert, not a thousand.",
              whyItMatters: 'Subscription businesses bleed revenue silently. An alert on churn or ingestion lag is often the difference between catching a problem in an hour or a quarter.',
              tradeoff: 'Every alert threshold is a bet between noise and blindness. Tune alerts around symptoms users feel, not every metric twitch, or the team will ignore them.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Alert Manager', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Analytics Service \u2192 Alert Manager.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Alert Manager added. Now scheduled reporting.',
            },
          },
          hints: ['Search for "Alert Manager"', 'Connect Analytics Service to it'],
        }),
        step({
          component: 'Worker',
          nodeType: 'worker_job',
          parent: 'Kafka',
          phases: {
            context: {
              heading: 'Adding the Reporting Worker',
              body: 'Not everything runs in real time. Cohort reports, PDF exports, and daily summary emails are batch jobs.',
            },
            intro: {
              heading: 'Do you know about Workers?',
              body: 'Workers run long, scheduled jobs in the background so no user request waits on them.',
            },
            teaching: {
              heading: 'Deep dive: Worker',
              body: "The reporting worker consumes from Kafka and runs scheduled jobs: nightly cohort recomputation, weekly executive summary emails, and CSV exports. Because it reads the same durable stream as the real-time path, batch results always reconcile with streaming numbers.",
              whyItMatters: 'Batch jobs let OpenClaw deliver heavy reports without ever blocking the real-time pipeline. Without a worker, exports would have to run inline and slow the product down.',
              tradeoff: 'Scheduled jobs overlap with peak load. Rate-limit the worker and make every job idempotent so a duplicate run does not double-send reports.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Worker', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Kafka \u2192 Worker.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Worker added. You have built OpenClaw \u2014 a complete subscription analytics platform.',
            },
          },
          hints: ['Search for "Worker"', 'Connect Kafka to it'],
        }),
      ],
    }),
  ],
});

export default openclawTutorial;
