/**
 * Shared Lucide → custom architecture icon aliases.
 * Kept free of React so server and client resolvers can both use it.
 */

export const LUCIDE_TO_ARCH_ICON: Record<string, string> = {
  Monitor: 'arch-web',
  Smartphone: 'arch-mobile',
  Webhook: 'arch-webhook',
  ArrowLeftRight: 'arch-api-gateway',
  Inbox: 'arch-message-queue',
  Radio: 'arch-event-stream',
  Activity: 'arch-observability',
  Database: 'arch-database',
  Gauge: 'arch-cache',
  HardDrive: 'arch-storage',
  Server: 'arch-server',
  Box: 'arch-service',
  Boxes: 'arch-service',
  Scale: 'arch-load-balancer',
  ShieldCheck: 'arch-auth',
  KeyRound: 'arch-auth',
  Brain: 'arch-ai',
  Globe: 'arch-external',
  RadioTower: 'arch-cdn',
  Search: 'arch-search',
  Zap: 'arch-function',
  Mail: 'arch-email',
  CreditCard: 'arch-payment',
  Bell: 'arch-notification',
  Shield: 'arch-firewall',
  ShieldAlert: 'arch-firewall',
  Lock: 'arch-secrets',
  Key: 'arch-secrets',
  BarChart2: 'arch-metrics',
  LayoutDashboard: 'arch-observability',
  ScrollText: 'arch-logs',
  FileText: 'arch-logs',
  GitBranch: 'arch-cicd',
  GitPullRequest: 'arch-cicd',
  GitMerge: 'arch-cicd',
  Package: 'arch-registry',
  FolderOpen: 'arch-file',
  Archive: 'arch-warehouse',
  Layers: 'arch-document-db',
  Bot: 'arch-agent',
  Users: 'arch-users',
  User: 'arch-users',
  UserCheck: 'arch-auth',
  MessageSquare: 'arch-chat',
  MessageCircle: 'arch-chat',
  Upload: 'arch-upload',
  Settings: 'arch-config',
  Map: 'arch-maps',
  Network: 'arch-dns',
  Shuffle: 'arch-proxy',
  CircleDot: 'arch-kubernetes',
  Play: 'arch-function',
  Clock: 'arch-worker',
  Timer: 'arch-worker',
  Cpu: 'arch-function',
  Plug: 'arch-webhook',
  Sparkles: 'arch-ai',
  Triangle: 'arch-database',
  Droplets: 'arch-database',
  Code2: 'arch-service',
  Plane: 'arch-cdn',
  AppWindow: 'arch-web',
  ListTodo: 'arch-config',
  Wrench: 'arch-config',
  RefreshCw: 'arch-observability',
  Scissors: 'arch-partition',
  MessageSquareWarning: 'arch-agent',
  Sliders: 'arch-config',
  Terminal: 'arch-terminal',
  Laptop: 'arch-desktop',
  Workflow: 'arch-workflow',
  BookOpen: 'arch-knowledge',
  HeartPulse: 'arch-health-check',
  LineChart: 'arch-timeseries',
  Copy: 'arch-replication',
  HardDriveDownload: 'arch-download',
  Layers3: 'arch-cluster',
  Unplug: 'arch-circuit-breaker',
  CalendarClock: 'arch-scheduler',
};

/** Official AWS keys → role glyphs so diagrams stay on one stroke language. */
export const AWS_TO_ARCH_ICON: Record<string, string> = {
  'aws-ec2': 'arch-vm',
  'aws-lambda': 'arch-function',
  'aws-ecs': 'arch-docker',
  'aws-eks': 'arch-kubernetes',
  'aws-fargate': 'arch-docker',
  'aws-beanstalk': 'arch-service',
  'aws-s3': 'arch-storage',
  'aws-ebs': 'arch-storage',
  'aws-efs': 'arch-file',
  'aws-glacier': 'arch-backup',
  'aws-rds': 'arch-database',
  'aws-dynamodb': 'arch-key-value',
  'aws-elasticache': 'arch-cache',
  'aws-aurora': 'arch-database',
  'aws-redshift': 'arch-warehouse',
  'aws-documentdb': 'arch-document-db',
  'aws-api-gateway': 'arch-api-gateway',
  'aws-cloudfront': 'arch-cdn',
  'aws-route53': 'arch-dns',
  'aws-vpc': 'arch-router',
  'aws-elb': 'arch-load-balancer',
  'aws-alb': 'arch-load-balancer',
  'aws-sqs': 'arch-message-queue',
  'aws-sns': 'arch-notification',
  'aws-eventbridge': 'arch-event-stream',
  'aws-kinesis': 'arch-event-stream',
  'aws-msk': 'arch-broker',
  'aws-opensearch': 'arch-search',
  'aws-cloudwatch': 'arch-metrics',
  'aws-cloudtrail': 'arch-logs',
  'aws-shield': 'arch-firewall',
  'aws-sagemaker': 'arch-ai',
};

export function normalizeArchIconName(iconName?: string | null): string | undefined {
  if (!iconName?.trim()) return undefined;
  const trimmed = iconName.trim();
  if (trimmed.startsWith('arch-') || trimmed.startsWith('aws-')) return trimmed;
  return LUCIDE_TO_ARCH_ICON[trimmed] ?? trimmed;
}

/** Icon actually drawn on the canvas (always an `arch-*` glyph when possible). */
export function toCanvasArchIcon(iconName?: string | null): string | undefined {
  const normalized = normalizeArchIconName(iconName);
  if (!normalized) return undefined;
  if (normalized.startsWith('arch-')) return normalized;
  if (AWS_TO_ARCH_ICON[normalized]) return AWS_TO_ARCH_ICON[normalized];
  if (normalized.startsWith('azure-')) {
    if (/sql|cosmos|db|postgres|mysql/i.test(normalized)) return 'arch-database';
    if (/blob|storage|disk/i.test(normalized)) return 'arch-storage';
    if (/func|function/i.test(normalized)) return 'arch-function';
    if (/aks|kube/i.test(normalized)) return 'arch-kubernetes';
    if (/queue|servicebus|eventhub/i.test(normalized)) return 'arch-message-queue';
    if (/redis|cache/i.test(normalized)) return 'arch-cache';
    if (/cdn|front-?door/i.test(normalized)) return 'arch-cdn';
    if (/app.?gw|gateway|apim/i.test(normalized)) return 'arch-api-gateway';
    return 'arch-service';
  }
  return LUCIDE_TO_ARCH_ICON[normalized] ?? normalized;
}
