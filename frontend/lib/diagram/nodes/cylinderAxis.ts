/** Fields used to infer vertical drum vs horizontal pipe for cylinder nodes. */
export interface CylinderAxisInput {
  cylinderAxis?: 'vertical' | 'horizontal';
  serviceType?: string;
  label?: string;
}

/** Vertical drum (database) vs horizontal pipe (legacy queue support). */
export function resolveCylinderAxis(data: CylinderAxisInput): 'vertical' | 'horizontal' {
  // Explicit axis always wins
  if (data.cylinderAxis === 'horizontal' || data.cylinderAxis === 'vertical') {
    return data.cylinderAxis;
  }
  
  // Legacy support: if serviceType is 'queue' but shape is still 'cylinder', use horizontal
  // (New diagrams should use shape='queue' instead)
  if (data.serviceType === 'queue') return 'horizontal';
  
  // Legacy label-based detection for backward compatibility
  const label = (data.label || '').toLowerCase();
  if (/\b(pub\/sub|pubsub|message queue|kafka|rabbitmq|topic|event bus|event stream|connector)\b/.test(label)) {
    return 'horizontal';
  }
  
  // Default to vertical drum (database)
  return 'vertical';
}
