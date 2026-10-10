import { defineTutorial, level, step } from '@/lib/tutorial/builder';

const githubTutorial = defineTutorial({
  id: 'github-architecture',
  title: 'How to Design GitHub Architecture',
  description: 'Build a code hosting platform for 100 million developers with 420 million repositories. Learn Git object storage, pull request workflows, CI/CD pipelines, code search, and webhook delivery at scale.',
  difficulty: 'intermediate',
  estimatedMinutes: 30,
  tags: ['code-hosting', 'ci-cd', 'git'],
  icon: 'Github',
  color: '#181717',

  levels: [
    level({
      title: 'Code Hosting Platform',
      steps: [
        step({
          component: 'Web Client',
          nodeType: 'client_web',
          phases: {
            context: {
              heading: 'Welcome to GitHub Architecture',
              body: "Let's build GitHub from scratch. 100 million developers, 420 million repositories, and a push that triggers CI/CD pipelines, notifies collaborators, and updates integrations.",
            },
            intro: {
              heading: 'Do you know about Web Clients?',
              body: "GitHub's web client is where developers browse code, review pull requests, and manage issues.",
            },
            teaching: {
              heading: 'Deep dive: Web Client',
              body: "GitHub's scale of Git storage alone is staggering. Every commit, every file, every version of every file across 420 million repositories.",
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
              body: 'Adding the API Gateway \u2014 handles REST, GraphQL, and Git protocol.',
            },
            intro: {
              heading: 'Do you know about API Gateways?',
              body: "GitHub's API Gateway handles REST API v3, GraphQL API v4, and Git protocol requests.",
            },
            teaching: {
              heading: 'Deep dive: API Gateway',
              body: "Loading a pull request page used to require 10+ REST API calls. GraphQL lets the client specify exactly what it needs in one request.",
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
              body: 'Adding the Load Balancer \u2014 distributes Git operations and API requests.',
            },
            intro: {
              heading: 'Do you know about Load Balancers?',
              body: "GitHub's Load Balancer distributes traffic across service instances using HAProxy.",
            },
            teaching: {
              heading: 'Deep dive: Load Balancer',
              body: "When a popular open-source project releases a new version, thousands of CI systems clone the repository simultaneously. Git operations are stateless, so any server can handle any clone.",
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
              body: 'Adding the Auth Service \u2014 handles tokens, OAuth, GitHub Apps, and SSH keys.',
            },
            intro: {
              heading: 'Do you know about Auth Services?',
              body: "GitHub's Auth Service handles personal access tokens, OAuth apps, GitHub Apps, and SSH key authentication.",
            },
            teaching: {
              heading: 'Deep dive: Auth Service',
              body: "GitHub Apps have repository-level permissions \u2014 a CI app only gets read access to your code repo, not your private repos.",
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
              body: 'Auth Service added. Now the Database.',
            },
          },
          hints: ['Search for "Auth Service"', 'Connect Load Balancer to it'],
        }),
        step({
          component: 'Database',
          nodeType: 'sql_db',
          parent: 'Auth Service',
          phases: {
            context: { heading: 'Step 5: Database', body: 'GitHub stores repository metadata, pull requests, issues, and user accounts in a relational database while Git objects live in a separate blob store.' },
            intro: { heading: 'About Databases', body: 'Relational databases store structured metadata with transactional guarantees for collaborative workflows.' },
            teaching: { heading: 'Deep dive: Database', body: 'GitHub\'s metadata database tracks repos, branches, PRs, and permissions. Git blobs (commits, trees, files) are content-addressed and stored separately — the database only holds pointers and indexes. This split lets Git operations scale independently from social features like stars and notifications.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Database', and add it." },
            connecting: { heading: 'Connect it up', body: 'Connect Auth Service \u2192 Database.' },
            celebration: { heading: 'Great job!', body: 'Database added. Now the Search Service.' },
          },
          hints: ['Search for "Database"', 'Connect Auth Service to it'],
        }),
        step({
          component: 'Search Service',
          nodeType: 'search_service',
          parent: 'API Gateway',
          phases: {
            context: { heading: 'Step 6: Search Service', body: 'GitHub Code Search indexes billions of files across public repositories so developers can find functions, libraries, and examples in seconds.' },
            intro: { heading: 'About Search Services', body: 'Search services index code and metadata for fast full-text and symbol lookups.' },
            teaching: { heading: 'Deep dive: Search Service', body: 'Code search must index every file in every public repo while respecting private-repo ACLs. Queries like `language:typescript repo:vercel/next.js` hit inverted indexes built from Git trees. Without a dedicated search tier, every code lookup would scan raw Git storage — far too slow at GitHub scale.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Search Service', and add it." },
            connecting: { heading: 'Connect it up', body: 'Connect API Gateway \u2192 Search Service.' },
            celebration: { heading: 'Great job!', body: 'Search Service added. Now CI workers.' },
          },
          hints: ['Search for "Search Service"', 'Connect API Gateway to it'],
        }),
        step({
          component: 'Worker',
          nodeType: 'worker_job',
          parent: 'Load Balancer',
          phases: {
            context: { heading: 'Step 7: Worker', body: 'GitHub Actions runs CI/CD jobs in ephemeral containers when you push code or open a pull request.' },
            intro: { heading: 'About Workers', body: 'Workers execute background jobs like builds, tests, and deployments triggered by repository events.' },
            teaching: { heading: 'Deep dive: Worker', body: 'Each workflow run spins up isolated runners that clone the repo, run your YAML-defined steps, and report status checks back to the PR. Burst traffic during hackathons can launch millions of concurrent jobs — workers must scale elastically without starving interactive Git operations.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Worker', and add it." },
            connecting: { heading: 'Connect it up', body: 'Connect Load Balancer \u2192 Worker.' },
            celebration: { heading: 'Great job!', body: 'Worker added. Now webhooks.' },
          },
          hints: ['Search for "Worker"', 'Connect Load Balancer to it'],
        }),
        step({
          component: 'Webhook Handler',
          nodeType: 'webhook_dispatcher',
          parent: 'API Gateway',
          phases: {
            context: { heading: 'Step 8: Webhook Handler', body: 'Webhooks notify Slack, Jira, and custom integrations when code is pushed, PRs merge, or releases ship.' },
            intro: { heading: 'About Webhook Handlers', body: 'Webhook handlers deliver signed HTTP callbacks to external systems when repository events occur.' },
            teaching: { heading: 'Deep dive: Webhook Handler', body: 'Every push can fan out to dozens of integrations. The handler signs payloads with HMAC secrets, retries failures with backoff, and deduplicates events so CI systems do not run twice. This event layer is what turns GitHub from a code host into a platform.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Webhook Handler', and add it." },
            connecting: { heading: 'Connect it up', body: 'Connect API Gateway \u2192 Webhook Handler.' },
            celebration: { heading: 'Great job!', body: 'Webhook Handler added. Your GitHub architecture is complete!' },
          },
          hints: ['Search for "Webhook Handler"', 'Connect API Gateway to it'],
        }),
      ],
    }),
  ],
});

export default githubTutorial;
