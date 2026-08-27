import type { ConceptTemplatePlan, ConceptDomain, ImplicitConcept } from './types';
import { BASE_STYLE, FORMAT } from './types';
import {
  dockerMermaid,
  apiGatewayMermaid,
  kafkaMermaid,
  linuxMermaid,
  domainMermaid,
  sanitizeLabel,
} from './templateMermaid';
import { trimMermaidByDetailLevel } from './trimming';

export function getConceptTemplatePlan(
  concept: ImplicitConcept,
  detailLevel: 1 | 2 | 3 = 3,
): ConceptTemplatePlan {
  let plan: ConceptTemplatePlan;
  switch (concept.template) {
    case 'docker':
      plan = buildPlan(dockerMermaid, 'Step 0 - Generic Docker architecture request, so use canonical Docker Engine architecture, not Swarm/Kubernetes/CI/CD. Step 1 - Show Docker Client, Docker API, Docker Daemon, Registry, Local Image Store, containerd, runc, Containers, Networks, Volumes, and Host OS Kernel. Step 2 - Client commands enter through the Docker API. Step 3 - Docker Daemon pulls images, stores layers, configures networking/storage, and starts containers through containerd/runc. Step 4 - Runtime status returns through daemon and API. Step 5 - No orchestration, overlay networking, load balancer, or pipeline is added because the prompt does not request deployment architecture. Step 6 - Labels are concise. Step 7 - The diagram is an explanatory grid of components grouped by responsibility.');
      break;
    case 'api-gateway':
      plan = buildPlan(apiGatewayMermaid, 'Step 0 - Generic API Gateway request, so show a production API gateway capability map rather than inventing an application behind it. Step 1 - Show clients, edge protection, gateway control plane, request processing policies, upstream services, policy data, and observability. Step 2 - Requests enter through DNS/CDN/WAF and reach the gateway listener. Step 3 - The gateway authenticates, authorizes, rate limits, validates, transforms, routes, and proxies traffic to upstream services. Step 4 - Responses and telemetry return through the gateway. Step 5 - Include production-standard controls without app-specific services. Step 6 - Labels are concise. Step 7 - The diagram is grouped as a grid by responsibility.');
      break;
    case 'kafka':
      plan = buildPlan(kafkaMermaid, 'Step 0 - Generic Kafka request, so show Kafka platform architecture rather than a made-up app workflow. Step 1 - Show producers, brokers, topics/partitions, replication, controller quorum, consumers, stream processing, connectors, schema registry, and observability. Step 2 - Producers write records to topic partitions. Step 3 - Brokers persist logs, replicate partitions, coordinate metadata through KRaft controllers, and serve consumers/stream processors. Step 4 - Connectors integrate external systems and observability monitors lag/health. Step 5 - The diagram reflects current production Kafka concepts without forcing unrelated services. Step 6 - Labels are concise. Step 7 - Components are grouped by responsibility.');
      break;
    case 'linux':
      plan = buildPlan(linuxMermaid, 'Step 0 - Generic Linux request, so show operating system architecture as layered internals rather than an application deployment. Step 1 - Show user space, system libraries, system call boundary, kernel subsystems, security, device drivers, and hardware. Step 2 - Applications call libraries and shell utilities. Step 3 - System calls enter the kernel, where scheduler, memory manager, VFS, networking, IPC, security modules, and drivers coordinate hardware. Step 4 - Results return back to user space. Step 5 - Include production-relevant OS concepts without unrelated cloud infrastructure. Step 6 - Labels are concise. Step 7 - The diagram is a layered grid.');
      break;
    default:
      plan = buildDomainConceptPlan(concept);
  }

  if (detailLevel < 3) {
    plan = {
      ...plan,
      mermaidCode: trimMermaidByDetailLevel(plan.mermaidCode, detailLevel),
      reasoning: `${plan.reasoning} Detail level L${detailLevel}: trimmed secondary / ops bands to match the requested scope.`,
    };
  }
  return plan;
}


export function buildPlan(mermaidCode: string, reasoning: string): ConceptTemplatePlan {
  return {
    formatConfig: { ...FORMAT },
    styleConfig: { ...BASE_STYLE },
    mermaidCode,
    reasoning,
  };
}

function buildDomainConceptPlan(concept: ImplicitConcept): ConceptTemplatePlan {
  const subject = sanitizeLabel(concept.subject);
  const mermaidCode = domainMermaid(concept.domain, subject);
  const reasoning = `Step 0 - This is a short implicit concept prompt for ${subject}, so build a production-grade explanatory grid rather than inventing an application-specific architecture. Step 1 - Classify ${subject} as ${concept.domain} infrastructure. Step 2 - Show interfaces, core runtime/data plane, control/configuration, security/policy, state/persistence, and operations where relevant. Step 3 - Connect components by responsibility instead of forcing a long request path. Step 4 - Include modern production concerns such as health, metrics, policy, replication, persistence, and safe integration. Step 5 - Avoid domain services or databases that the user did not request. Step 6 - Edge labels are concise (2 words max). Step 7 - Components are grouped into grid-style responsibility bands.`;
  return buildPlan(mermaidCode, reasoning);
}
