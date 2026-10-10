/**
 * Kubernetes component role mappings.
 * Maps Kubernetes-specific components to their role-appropriate icons,
 * so etcd shows a key-value icon instead of the generic Kubernetes logo.
 */

export interface KubernetesRoleMapping {
  icon: string;
  category: 'compute' | 'data' | 'orchestration' | 'networking' | 'async';
  description: string;
}

export const KUBERNETES_ROLE_MAP: Record<string, KubernetesRoleMapping> = {
  // Control Plane Components
  'etcd': {
    icon: 'arch-key-value',
    category: 'data',
    description: 'Distributed key-value store for cluster state',
  },
  'kube-apiserver': {
    icon: 'arch-api-gateway',
    category: 'networking',
    description: 'Kubernetes API server',
  },
  'api server': {
    icon: 'arch-api-gateway',
    category: 'networking',
    description: 'Kubernetes API server',
  },
  'apiserver': {
    icon: 'arch-api-gateway',
    category: 'networking',
    description: 'Kubernetes API server',
  },
  'kube-scheduler': {
    icon: 'arch-scheduler',
    category: 'orchestration',
    description: 'Schedules pods to nodes',
  },
  'scheduler': {
    icon: 'arch-scheduler',
    category: 'orchestration',
    description: 'Schedules pods to nodes',
  },
  'kube-controller-manager': {
    icon: 'arch-config',
    category: 'orchestration',
    description: 'Runs controller processes',
  },
  'controller manager': {
    icon: 'arch-config',
    category: 'orchestration',
    description: 'Runs controller processes',
  },
  'controller-manager': {
    icon: 'arch-config',
    category: 'orchestration',
    description: 'Runs controller processes',
  },
  'cloud-controller-manager': {
    icon: 'arch-config',
    category: 'orchestration',
    description: 'Cloud-specific controller manager',
  },
  
  // Node Components
  'kubelet': {
    icon: 'arch-agent',
    category: 'compute',
    description: 'Node agent that manages pods',
  },
  'kube-proxy': {
    icon: 'arch-proxy',
    category: 'networking',
    description: 'Network proxy on each node',
  },
  'proxy': {
    icon: 'arch-proxy',
    category: 'networking',
    description: 'Network proxy',
  },
  
  // Workload Resources
  'pod': {
    icon: 'arch-docker',
    category: 'compute',
    description: 'Smallest deployable unit',
  },
  'pods': {
    icon: 'arch-docker',
    category: 'compute',
    description: 'Smallest deployable units',
  },
  'deployment': {
    icon: 'arch-service',
    category: 'compute',
    description: 'Manages ReplicaSets and Pods',
  },
  'deployments': {
    icon: 'arch-service',
    category: 'compute',
    description: 'Manages ReplicaSets and Pods',
  },
  'replicaset': {
    icon: 'arch-cluster',
    category: 'compute',
    description: 'Maintains pod replicas',
  },
  'replicasets': {
    icon: 'arch-cluster',
    category: 'compute',
    description: 'Maintains pod replicas',
  },
  'statefulset': {
    icon: 'arch-database',
    category: 'compute',
    description: 'Manages stateful applications',
  },
  'statefulsets': {
    icon: 'arch-database',
    category: 'compute',
    description: 'Manages stateful applications',
  },
  'daemonset': {
    icon: 'arch-agent',
    category: 'compute',
    description: 'Runs a pod on every node',
  },
  'daemonsets': {
    icon: 'arch-agent',
    category: 'compute',
    description: 'Runs a pod on every node',
  },
  'job': {
    icon: 'arch-batch',
    category: 'compute',
    description: 'Creates pods for batch tasks',
  },
  'jobs': {
    icon: 'arch-batch',
    category: 'compute',
    description: 'Creates pods for batch tasks',
  },
  'cronjob': {
    icon: 'arch-scheduler',
    category: 'compute',
    description: 'Creates jobs on a schedule',
  },
  'cronjobs': {
    icon: 'arch-scheduler',
    category: 'compute',
    description: 'Creates jobs on a schedule',
  },
  
  // Networking
  'service': {
    icon: 'arch-load-balancer',
    category: 'networking',
    description: 'Exposes pods as a network service',
  },
  'services': {
    icon: 'arch-load-balancer',
    category: 'networking',
    description: 'Exposes pods as network services',
  },
  'ingress': {
    icon: 'arch-api-gateway',
    category: 'networking',
    description: 'HTTP/HTTPS routing to services',
  },
  'ingresses': {
    icon: 'arch-api-gateway',
    category: 'networking',
    description: 'HTTP/HTTPS routing to services',
  },
  'networkpolicy': {
    icon: 'arch-firewall',
    category: 'networking',
    description: 'Controls pod-to-pod traffic',
  },
  'network policy': {
    icon: 'arch-firewall',
    category: 'networking',
    description: 'Controls pod-to-pod traffic',
  },
  
  // Storage
  'persistentvolume': {
    icon: 'arch-storage',
    category: 'data',
    description: 'Cluster storage resource',
  },
  'persistent volume': {
    icon: 'arch-storage',
    category: 'data',
    description: 'Cluster storage resource',
  },
  'pv': {
    icon: 'arch-storage',
    category: 'data',
    description: 'Persistent volume',
  },
  'persistentvolumeclaim': {
    icon: 'arch-file',
    category: 'data',
    description: 'User storage request',
  },
  'persistent volume claim': {
    icon: 'arch-file',
    category: 'data',
    description: 'User storage request',
  },
  'pvc': {
    icon: 'arch-file',
    category: 'data',
    description: 'Persistent volume claim',
  },
  'storageclass': {
    icon: 'arch-storage',
    category: 'data',
    description: 'Dynamic provisioning config',
  },
  'storage class': {
    icon: 'arch-storage',
    category: 'data',
    description: 'Dynamic provisioning config',
  },
  
  // Configuration
  'configmap': {
    icon: 'arch-config',
    category: 'orchestration',
    description: 'Configuration data for pods',
  },
  'config map': {
    icon: 'arch-config',
    category: 'orchestration',
    description: 'Configuration data for pods',
  },
  'secret': {
    icon: 'arch-secrets',
    category: 'orchestration',
    description: 'Sensitive data storage',
  },
  'secrets': {
    icon: 'arch-secrets',
    category: 'orchestration',
    description: 'Sensitive data storage',
  },
  
  // Cluster-level
  'namespace': {
    icon: 'arch-cluster',
    category: 'orchestration',
    description: 'Virtual cluster isolation',
  },
  'namespaces': {
    icon: 'arch-cluster',
    category: 'orchestration',
    description: 'Virtual cluster isolation',
  },
  'node': {
    icon: 'arch-server',
    category: 'compute',
    description: 'Worker machine in cluster',
  },
  'nodes': {
    icon: 'arch-server',
    category: 'compute',
    description: 'Worker machines in cluster',
  },
  'control plane': {
    icon: 'arch-coordinator',
    category: 'orchestration',
    description: 'Cluster management components',
  },
  'controlplane': {
    icon: 'arch-coordinator',
    category: 'orchestration',
    description: 'Cluster management components',
  },
  
  // Cluster management
  'cluster': {
    icon: 'arch-cluster',
    category: 'orchestration',
    description: 'Kubernetes cluster',
  },
  'master': {
    icon: 'arch-coordinator',
    category: 'orchestration',
    description: 'Control plane node',
  },
  'worker': {
    icon: 'arch-server',
    category: 'compute',
    description: 'Worker node',
  },
  'workers': {
    icon: 'arch-server',
    category: 'compute',
    description: 'Worker nodes',
  },
};

/**
 * Check if a label represents a Kubernetes component and return its role mapping.
 */
export function resolveKubernetesRole(label?: string): KubernetesRoleMapping | null {
  if (!label) return null;
  
  const normalized = label.toLowerCase().trim();
  
  // Direct match
  if (KUBERNETES_ROLE_MAP[normalized]) {
    return KUBERNETES_ROLE_MAP[normalized];
  }
  
  // Check for partial matches with kubernetes prefix/suffix
  // e.g., "Kubernetes API Server" → "api server"
  const stripped = normalized
    .replace(/^(kube|kubernetes|k8s)\s+/i, '')
    .replace(/\s+(kube|kubernetes|k8s)$/i, '')
    .trim();
  
  if (stripped && KUBERNETES_ROLE_MAP[stripped]) {
    return KUBERNETES_ROLE_MAP[stripped];
  }
  
  // Check if any key is contained in the label
  for (const [key, mapping] of Object.entries(KUBERNETES_ROLE_MAP)) {
    if (normalized.includes(key)) {
      return mapping;
    }
  }
  
  return null;
}

/**
 * Check if a label is kubernetes-related (mentions kubernetes, k8s, or kube).
 */
export function isKubernetesContext(label?: string, technology?: string): boolean {
  if (technology === 'kubernetes') return true;
  if (!label) return false;
  
  const normalized = label.toLowerCase();
  return /\b(kubernetes|k8s|kube-|eks|aks|gke)\b/.test(normalized);
}
