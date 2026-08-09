/** Fields used to infer vertical drum vs horizontal pipe for cylinder nodes. */
export interface CylinderAxisInput {
  cylinderAxis?: 'vertical' | 'horizontal';
  serviceType?: string;
  label?: string;
}

/** Vertical drum (database) vs horizontal pipe (queue / pub-sub). */
export function resolveCylinderAxis(data: CylinderAxisInput): 'vertical' | 'horizontal' {
  if (data.cylinderAxis === 'horizontal' || data.cylinderAxis === 'vertical') {
    return data.cylinderAxis;
  }
  if (data.serviceType === 'queue') return 'horizontal';
  const label = (data.label || '').toLowerCase();
  if (/\b(pub\/sub|pubsub|message queue|kafka|rabbitmq|topic|event bus|event stream|connector)\b/.test(label)) {
    return 'horizontal';
  }
  return 'vertical';
}
