export function generateFallbackPlan(prompt: string) {
  const mermaidCode = `graph TD
  subgraph CLIENT["Client Layer"]
    user["User"]
  end
  subgraph API["API Layer"]
    gateway["API Gateway"]
  end
  subgraph SERVICE["Service Layer"]
    service["Service"]
  end
  subgraph DATA["Data Layer"]
    database[("Database")]
  end
  user -->|request| gateway
  gateway -->|route| service
  service -->|query| database`;

  return {
    formatConfig: {
      format: 'mermaid' as const,
      diagramType: 'graph TD' as const,
      optionalVariants: [],
    },
    styleConfig: {
      primaryColor: '#2563EB',
      secondaryColor: '#4F46E5',
      background: '#F9FAFB',
      backgroundColor: '#F9FAFB',
      fontFamily: 'Inter',
      theme: 'default',
      nodeTypeStyles: {
        client: '#2563EB',
        edge: '#4F46E5',
        gateway: '#4F46E5',
        application: '#4F46E5',
        data: '#1e293b',
        queue: '#1e293b',
        observability: '#475569',
        external: '#64748b',
      },
    },
    mermaidCode,
  };
}
