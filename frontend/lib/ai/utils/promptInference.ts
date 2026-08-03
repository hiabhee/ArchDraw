export function inferSystemType(description: string): string {
  const lower = description.toLowerCase();
  if (lower.includes('ecommerce') || lower.includes('shop') || lower.includes('order')) return 'E-commerce Platform';
  if (lower.includes('chat') || lower.includes('messaging') || lower.includes('realtime')) return 'Real-time Messaging';
  if (lower.includes('social') || lower.includes('twitter') || lower.includes('instagram')) return 'Social Media Platform';
  if (lower.includes('streaming') || lower.includes('video') || lower.includes('netflix')) return 'Streaming Platform';
  if (lower.includes('payment') || lower.includes('transaction') || lower.includes('fintech')) return 'Payment System';
  if (lower.includes('iot') || lower.includes('sensor') || lower.includes('device')) return 'IoT Platform';
  if (lower.includes('ml') || lower.includes('machine learning') || lower.includes('ai')) return 'ML/AI Platform';
  if (lower.includes('saas') || lower.includes('multi-tenant')) return 'SaaS Platform';
  return 'Monolith Architecture';
}

export function inferComplexity(description: string): 'low' | 'medium' | 'high' {
  const lower = description.toLowerCase();
  const wordCount = description.split(/\s+/).length;
  const complexKeywords = [
    'microservices', 'distributed', 'event-driven', 'real-time',
    'multi-tenant', 'caching', 'message queue', 'load balancer',
    'cdn', 'database', 'cache', 'queue', 'worker',
  ];
  const complexCount = complexKeywords.filter(kw => lower.includes(kw)).length;
  if (complexCount >= 5 || wordCount > 50) return 'high';
  if (complexCount >= 2 || wordCount > 20) return 'medium';
  return 'low';
}
