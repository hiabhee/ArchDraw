import type { ConceptDomain } from './types';

export function sanitizeLabel(label: string): string {
  return label.replace(/["[\]{}()]/g, '').replace(/\s+/g, ' ').trim() || 'Concept';
}

export function domainMermaid(domain: ConceptDomain, subject: string): string {
  switch (domain) {
    case 'api-edge':
      return genericApiEdgeMermaid(subject);
    case 'messaging':
      return genericMessagingMermaid(subject);
    case 'database':
      return genericDatabaseMermaid(subject);
    case 'cache':
      return genericCacheMermaid(subject);
    case 'orchestration':
      return genericOrchestrationMermaid(subject);
    case 'observability':
      return genericObservabilityMermaid(subject);
    case 'security':
      return genericSecurityMermaid(subject);
    case 'search':
      return genericSearchMermaid(subject);
    case 'storage':
      return genericStorageMermaid(subject);
    case 'runtime':
      return genericRuntimeMermaid(subject);
    case 'container-runtime':
      return genericContainerRuntimeMermaid(subject);
    case 'operating-system':
      return linuxMermaid;
  }
}

function genericApiEdgeMermaid(subject: string): string {
  return `graph LR
  subgraph CLIENTS["Consumers"]
    clients("Clients")
    partners("Partners")
  end
  subgraph EDGE["Edge Layer"]
    entry["${subject} Entry Point"]
    tls["TLS Termination"]
    waf["WAF / Filtering"]
  end
  subgraph ROUTING["Routing Plane"]
    rules{"Routing Rules"}
    %% archdraw-shape: {"id":"balancing","shape":"hexagon"}
    balancing["Load Balancing"]
    health["Health Checks"]
  end
  subgraph POLICIES["Policy Layer"]
    auth["Authentication"]
    rate["Rate Limits"]
    transform["Request Transform"]
  end
  subgraph UPSTREAM["Upstreams"]
    services["Backend Targets"]
    discovery["Service Discovery"]
  end
  subgraph OPS["Operations"]
    logs["Access Logs"]
    metrics["Metrics / Traces"]
  end
  clients -->|send request| entry
  partners -->|send request| entry
  entry -->|terminates TLS| tls
  tls -->|filters traffic| waf
  waf -->|matches route| rules
  rules -->|applies policy| auth
  auth -->|checks quota| rate
  rate -->|normalizes request| transform
  transform -->|selects target| balancing
  discovery -->|resolves target| balancing
  health -->|checks target| balancing
  balancing -->|forwards call| services
  entry -->|emits logs| logs
  balancing -->|emits metrics| metrics`;
}

function genericMessagingMermaid(subject: string): string {
  return `graph LR
  subgraph CLIENTS["Messaging Clients"]
    producers("Producers")
    consumers("Consumers")
  end
  subgraph BROKER["${subject} Core"]
    broker["Broker / Coordinator"]
    destinations(("Queues / Topics"))
    partitions["Partitions / Shards"]
  end
  subgraph DURABILITY["Durability"]
    log[("Message Log")]
    replication["Replication"]
    retention["Retention Policy"]
  end
  subgraph DELIVERY["Delivery Semantics"]
    ack["Ack / Offset Tracking"]
    retry["Retry / DLQ"]
    ordering["Ordering Boundary"]
  end
  subgraph OPS["Operations"]
    metrics["Lag / Throughput"]
    config[("Broker Config")]
  end
  producers -->|publish events| broker
  broker -->|routes to| destinations
  destinations -->|split into| partitions
  partitions -->|append to| log
  log -->|replicates via| replication
  retention -->|expires data| log
  consumers -->|read messages| broker
  broker -->|tracks progress| ack
  ack -->|handles failure| retry
  partitions -->|preserve order| ordering
  metrics -->|observes broker| broker
  config -->|sets policy| broker`;
}

function genericDatabaseMermaid(subject: string): string {
  return `graph LR
  subgraph CLIENTS["Database Clients"]
    apps("Applications")
    admin("Admin Tools")
  end
  subgraph ACCESS["Access Layer"]
    listener["Connection Listener"]
    auth["Auth / Roles"]
    planner["Query Parser / Planner"]
  end
  subgraph ENGINE["${subject} Engine"]
    executor["Query Executor"]
    tx["Transaction Manager"]
    cache["Buffer Cache"]
    indexes["Indexes"]
  end
  subgraph STORAGE["Storage Layer"]
    tables[("Tables / Collections")]
    wal[("Write Ahead Log")]
    replicas["Replication"]
  end
  subgraph OPS["Operations"]
    backup["Backup / Restore"]
    metrics["Metrics / Slow Queries"]
  end
  apps -->|open connection| listener
  admin -->|manage schema| listener
  listener -->|checks access| auth
  auth -->|plans query| planner
  planner -->|executes plan| executor
  executor -->|uses tx| tx
  executor -->|reads cache| cache
  executor -->|uses index| indexes
  tx -->|writes log| wal
  cache -->|loads pages| tables
  wal -->|streams changes| replicas
  backup -->|copies data| tables
  metrics -->|observes engine| executor`;
}

function genericCacheMermaid(subject: string): string {
  return `graph LR
  subgraph CLIENTS["Cache Clients"]
    apps("Applications")
    workers("Workers")
  end
  subgraph ACCESS["Access Layer"]
    endpoint["${subject} Endpoint"]
    auth["Auth / ACLs"]
  end
  subgraph MEMORY["In-Memory Data Plane"]
    keys[("Key Space")]
    structures["Data Structures"]
    eviction["Eviction Policy"]
  end
  subgraph RESILIENCE["Resilience"]
    replication["Replication"]
    persistence[("Snapshots / AOF")]
    clustering["Sharding / Cluster"]
  end
  subgraph OPS["Operations"]
    metrics["Hit Rate / Latency"]
    alerts["Memory Alerts"]
  end
  apps -->|read write| endpoint
  workers -->|read write| endpoint
  endpoint -->|checks ACL| auth
  auth -->|accesses keys| keys
  keys -->|stores values| structures
  eviction -->|expires keys| keys
  keys -->|replicates to| replication
  keys -->|persists to| persistence
  clustering -->|distributes keys| keys
  metrics -->|tracks usage| endpoint
  alerts -->|watch memory| keys`;
}

function genericOrchestrationMermaid(subject: string): string {
  return `graph LR
  subgraph USERS["Operators"]
    cli("CLI / API")
    gitops("GitOps / CI")
  end
  subgraph CONTROL["${subject} Control Plane"]
    api["API Server"]
    scheduler["Scheduler"]
    controller["Controllers"]
    state[("Cluster State")]
  end
  subgraph WORKLOADS["Workloads"]
    specs["Desired State"]
    runtime["Node Runtime"]
    containers["Running Workloads"]
  end
  subgraph PLATFORM["Platform Services"]
    network["Service Networking"]
    storage["Persistent Storage"]
    secrets["Secrets / Config"]
  end
  subgraph OPS["Operations"]
    health["Health Checks"]
    metrics["Metrics / Events"]
  end
  cli -->|submits spec| api
  gitops -->|syncs spec| api
  api -->|stores state| state
  api -->|queues work| scheduler
  controller -->|reconciles state| api
  scheduler -->|places work| runtime
  specs -->|define desired| api
  runtime -->|starts workload| containers
  network -->|connects pods| containers
  storage -->|mounts volume| containers
  secrets -->|injects config| containers
  health -->|reports status| controller
  metrics -->|observes cluster| api`;
}

function genericObservabilityMermaid(subject: string): string {
  return `graph LR
  subgraph SOURCES["Telemetry Sources"]
    apps("Applications")
    infra("Infrastructure")
    users("User Signals")
  end
  subgraph COLLECT["Collection"]
    agents["Agents / SDKs"]
    collector["Collector"]
    pipeline["Processing Pipeline"]
  end
  subgraph STORE["Telemetry Stores"]
    metrics[("Metrics Store")]
    logs[("Log Store")]
    traces[("Trace Store")]
  end
  subgraph ANALYZE["${subject} Analysis"]
    dashboards["Dashboards"]
    alerts["Alert Rules"]
    slo["SLO / Error Budget"]
  end
  subgraph RESPONSE["Operations"]
    oncall("On-call")
    incidents["Incident Timeline"]
  end
  apps -->|emit telemetry| agents
  infra -->|emit telemetry| agents
  users -->|emit signals| collector
  agents -->|export data| collector
  collector -->|processes data| pipeline
  pipeline -->|stores metrics| metrics
  pipeline -->|stores logs| logs
  pipeline -->|stores traces| traces
  metrics -->|feeds charts| dashboards
  logs -->|supports search| dashboards
  traces -->|shows latency| dashboards
  alerts -->|evaluates SLO| slo
  slo -->|pages team| oncall
  oncall -->|updates incident| incidents`;
}

function genericSecurityMermaid(subject: string): string {
  return `graph LR
  subgraph ACTORS["Actors"]
    user("User / Service")
    admin("Admin")
  end
  subgraph IDENTITY["Identity Plane"]
    provider["${subject} Provider"]
    directory[("Identity Store")]
    mfa["MFA / Risk Checks"]
  end
  subgraph POLICY["Policy Plane"]
    authn["Authentication"]
    authz["Authorization"]
    tokens["Tokens / Sessions"]
  end
  subgraph RESOURCES["Protected Resources"]
    apps["Applications"]
    apis["APIs"]
    secrets[("Secrets / Keys")]
  end
  subgraph AUDIT["Audit / Operations"]
    logs["Audit Logs"]
    alerts["Security Alerts"]
  end
  user -->|requests access| provider
  admin -->|manages policy| provider
  provider -->|looks up user| directory
  provider -->|verifies factor| mfa
  provider -->|performs authn| authn
  authn -->|issues token| tokens
  tokens -->|checks policy| authz
  authz -->|allows access| apps
  authz -->|allows access| apis
  provider -->|protects keys| secrets
  provider -->|writes audit| logs
  alerts -->|monitors risk| logs`;
}

function genericSearchMermaid(subject: string): string {
  return `graph LR
  subgraph SOURCES["Data Sources"]
    apps("Applications")
    dbs[("Databases")]
    files[("Documents")]
  end
  subgraph INGEST["Ingestion"]
    connector["Connector"]
    parser["Parser / Normalizer"]
    pipeline["Index Pipeline"]
  end
  subgraph INDEX["${subject} Index"]
    shards["Shards"]
    replicas["Replicas"]
    inverted[("Inverted Index")]
  end
  subgraph QUERY["Query Path"]
    api["Search API"]
    analyzer["Query Analyzer"]
    ranking["Scoring / Ranking"]
  end
  subgraph OPS["Operations"]
    metrics["Latency / Errors"]
    lifecycle["Index Lifecycle"]
  end
  apps -->|send docs| connector
  dbs -->|sync changes| connector
  files -->|extract text| parser
  connector -->|normalizes data| parser
  parser -->|builds docs| pipeline
  pipeline -->|writes index| shards
  shards -->|replicate to| replicas
  shards -->|store terms| inverted
  api -->|parses query| analyzer
  analyzer -->|scores hits| ranking
  ranking -->|reads shards| shards
  metrics -->|observes query| api
  lifecycle -->|rolls index| shards`;
}

function genericStorageMermaid(subject: string): string {
  return `graph LR
  subgraph CLIENTS["Storage Clients"]
    apps("Applications")
    batch("Batch Jobs")
  end
  subgraph API["${subject} API"]
    endpoint["Storage Endpoint"]
    auth["Auth / IAM"]
    metadata[("Metadata")]
  end
  subgraph DATA["Data Plane"]
    objects[("Objects / Files")]
    chunks["Chunks / Blocks"]
    replication["Replication"]
  end
  subgraph POLICY["Policy Layer"]
    lifecycle["Lifecycle Rules"]
    encryption["Encryption"]
    versioning["Versioning"]
  end
  subgraph OPS["Operations"]
    metrics["Usage / Latency"]
    backup["Backup / DR"]
  end
  apps -->|read write| endpoint
  batch -->|bulk transfer| endpoint
  endpoint -->|checks access| auth
  endpoint -->|updates metadata| metadata
  endpoint -->|stores data| objects
  objects -->|split into| chunks
  chunks -->|replicate to| replication
  encryption -->|protects data| objects
  versioning -->|keeps history| objects
  lifecycle -->|expires data| objects
  metrics -->|tracks usage| endpoint
  backup -->|copies data| objects`;
}

function genericRuntimeMermaid(subject: string): string {
  return `graph LR
  subgraph DEVELOPERS["Developers"]
    source("Source Code")
    config["Runtime Config"]
  end
  subgraph RUNTIME["${subject} Runtime"]
    loader["Module Loader"]
    execution["Execution Engine"]
    memory["Memory Manager"]
    concurrency["Concurrency Model"]
  end
  subgraph PLATFORM["Platform Integration"]
    os["OS Interfaces"]
    network["Networking"]
    filesystem["File System"]
  end
  subgraph PACKAGING["Packaging"]
    deps[("Dependencies")]
    build["Build / Bundle"]
  end
  subgraph OPS["Operations"]
    logs["Logs"]
    metrics["Runtime Metrics"]
  end
  source -->|loads into| loader
  config -->|configures| execution
  loader -->|starts code| execution
  execution -->|allocates memory| memory
  execution -->|schedules work| concurrency
  execution -->|calls OS| os
  os -->|uses network| network
  os -->|uses files| filesystem
  deps -->|resolved by| loader
  build -->|packages code| deps
  execution -->|emits logs| logs
  memory -->|emits metrics| metrics`;
}

function genericContainerRuntimeMermaid(subject: string): string {
  return `graph LR
  subgraph CLIENT["Client Interface"]
    cli("${subject} Client")
    api["Runtime API"]
  end
  subgraph CONTROL["Runtime Control"]
    daemon["Runtime Daemon"]
    images[("Image Store")]
    policy["Security Policy"]
  end
  subgraph EXECUTION["Execution"]
    runtime["Low-level Runtime"]
    namespaces["Namespaces"]
    cgroups["cgroups"]
    containers["Containers"]
  end
  subgraph RESOURCES["Resources"]
    network["Container Network"]
    volume["Volumes"]
    logs["Container Logs"]
  end
  subgraph HOST["Host Kernel"]
    kernel["OS Kernel"]
  end
  cli -->|sends command| api
  api -->|calls daemon| daemon
  daemon -->|resolves image| images
  daemon -->|checks policy| policy
  daemon -->|creates task| runtime
  runtime -->|sets namespace| namespaces
  runtime -->|sets limits| cgroups
  runtime -->|starts container| containers
  network -->|connects| containers
  volume -->|mounts into| containers
  containers -->|write logs| logs
  containers -->|share kernel| kernel`;
}

export const dockerMermaid = `graph LR
  subgraph CLIENT["Client Interface"]
    client("Docker Client / CLI")
    api["Docker API"]
  end
  subgraph ENGINE["Docker Engine"]
    daemon["Docker Daemon / Engine"]
    images[("Local Image Store")]
  end
  subgraph REGISTRY["Image Distribution"]
    registry[("Docker Registry")]
  end
  subgraph RUNTIME["Container Runtime"]
    containerd["containerd"]
    runc["runc"]
    containers["Running Containers"]
  end
  subgraph RESOURCES["Container Resources"]
    networks["Docker Networks"]
    volumes["Docker Volumes"]
  end
  subgraph HOST["Host OS"]
    kernel["Host OS Kernel"]
  end
  client -->|sends command| api
  api -->|calls daemon| daemon
  daemon -->|pulls image| registry
  registry -->|returns image| daemon
  daemon -->|stores layers| images
  daemon -->|creates task| containerd
  images -->|provides layers| containerd
  containerd -->|invokes runtime| runc
  runc -->|starts container| containers
  daemon -->|configures net| networks
  daemon -->|mounts volume| volumes
  networks -->|connects container| containers
  volumes -->|persists data| containers
  containers -->|share kernel| kernel
  containerd -->|status events| daemon`;

export const apiGatewayMermaid = `graph LR
  subgraph CLIENTS["Consumers"]
    web("Web / Mobile Apps")
    partners("Partner Clients")
  end
  subgraph EDGE["Edge Protection"]
    dns["DNS"]
    cdn["CDN"]
    waf["WAF"]
  end
  subgraph GATEWAY["API Gateway Runtime"]
    listener["HTTPS Listener"]
    router{"Route Matcher"}
    %% archdraw-shape: {"id":"proxy","shape":"hexagon"}
    proxy["Reverse Proxy"]
  end
  subgraph POLICIES["Request Policies"]
    auth["AuthN / AuthZ"]
    rate["Rate Limiter"]
    validate["Request Validator"]
    transform["Transform / Version"]
  end
  subgraph UPSTREAM["Upstream APIs"]
    services["Backend Services"]
    discovery["Service Discovery"]
  end
  subgraph CONTROL["Control Plane"]
    config[("Gateway Config")]
    secrets[("Secrets / Keys")]
  end
  subgraph OBSERVE["Observability"]
    logs["Access Logs"]
    metrics["Metrics / Traces"]
  end
  web -->|API request| dns
  partners -->|API request| dns
  dns -->|resolves edge| cdn
  cdn -->|filters traffic| waf
  waf -->|forwards HTTPS| listener
  listener -->|matches route| router
  router -->|checks auth| auth
  auth -->|enforces quota| rate
  rate -->|validates body| validate
  validate -->|maps request| transform
  transform -->|proxies call| proxy
  proxy -->|routes call| services
  discovery -->|resolves target| proxy
  config -->|loads routes| router
  secrets -->|verifies tokens| auth
  listener -->|emits logs| logs
  proxy -->|emits metrics| metrics`;

export const kafkaMermaid = `graph LR
  subgraph CLIENTS["Kafka Clients"]
    producers("Producers")
    consumers("Consumer Groups")
    streams["Kafka Streams"]
  end
  subgraph CLUSTER["Kafka Cluster"]
    brokers["Broker Cluster"]
    topics(("Topics"))
    partitions["Partitions"]
    replicas["Replica Logs"]
  end
  subgraph METADATA["Metadata Quorum"]
    controllers["KRaft Controllers"]
    metadata[("Cluster Metadata")]
  end
  subgraph PLATFORM["Platform Services"]
    schema["Schema Registry"]
    connect["Kafka Connect"]
    external["External Systems"]
  end
  subgraph OPERATIONS["Operations"]
    storage[("Log Segments")]
    monitoring["Lag / Health Metrics"]
  end
  producers -->|write records| brokers
  brokers -->|append to| topics
  topics -->|split into| partitions
  partitions -->|replicate to| replicas
  replicas -->|persist as| storage
  controllers -->|manage metadata| brokers
  metadata -->|stores state| controllers
  schema -->|validates schema| producers
  consumers -->|read offsets| brokers
  streams -->|process topics| brokers
  connect -->|source sink| brokers
  connect -->|sync data| external
  monitoring -->|tracks lag| consumers
  monitoring -->|tracks brokers| brokers`;

export const linuxMermaid = `graph LR
  subgraph USER["User Space"]
    apps("Applications")
    shell["Shell / Utilities"]
    services["System Services"]
  end
  subgraph LIBS["Libraries"]
    libc["glibc / libc"]
    runtime["Language Runtimes"]
  end
  subgraph BOUNDARY["System Call Boundary"]
    syscalls["System Calls"]
  end
  subgraph KERNEL["Linux Kernel"]
    scheduler["Process Scheduler"]
    memory["Memory Manager"]
    vfs["Virtual File System"]
    network["Network Stack"]
    ipc["IPC"]
    security["LSM / cgroups"]
  end
  subgraph DRIVERS["Device Drivers"]
    block["Block Drivers"]
    netdev["Network Drivers"]
    graphics["Graphics Drivers"]
  end
  subgraph HARDWARE["Hardware"]
    cpu["CPU / Memory"]
    disk["Disk / SSD"]
    nic["Network Card"]
  end
  apps -->|calls APIs| libc
  shell -->|starts process| libc
  services -->|uses runtime| runtime
  libc -->|invokes syscall| syscalls
  runtime -->|invokes syscall| syscalls
  syscalls -->|enters kernel| scheduler
  syscalls -->|maps memory| memory
  syscalls -->|opens files| vfs
  syscalls -->|sends packets| network
  scheduler -->|runs tasks| cpu
  memory -->|manages pages| cpu
  vfs -->|uses driver| block
  network -->|uses driver| netdev
  security -->|enforces policy| scheduler
  block -->|reads writes| disk
  netdev -->|transmits data| nic
  graphics -->|renders frames| cpu`;
