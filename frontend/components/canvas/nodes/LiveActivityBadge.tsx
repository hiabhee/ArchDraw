'use client';

import { memo } from 'react';
import { useCanvasView } from '@/lib/diagram/canvas/CanvasHostContext';
import { useNodeLiveActivity, useProjectLiveStore } from '@/store/projectLiveStore';

const MAX_DOTS = 3;

/**
 * Live coding-agent overlay for a project canvas node: one dot per session
 * that touched the node, a pulse while it is being edited, and a ring for the
 * session focused in the Sessions panel. Editor-only; excluded from exports
 * via the `live-activity-overlay` class.
 */
function LiveActivityBadgeComponent({ nodeId }: { nodeId: string }) {
  const { readOnly } = useCanvasView();
  const activity = useNodeLiveActivity(nodeId);
  const focusedSessionKey = useProjectLiveStore((s) => s.focusedSessionKey);
  if (readOnly || !activity || (activity.sessions.length === 0 && !activity.addedBy)) return null;

  const focused = focusedSessionKey
    ? activity.sessions.find((s) => s.sessionKey === focusedSessionKey)
    : undefined;
  const { addedBy } = activity;
  const ringColor = (focused ?? activity.sessions[0])?.color ?? addedBy?.color;
  const title = [
    ...(addedBy ? [`Added by ${addedBy.label}`] : []),
    ...activity.sessions.map(
      (s) => `${s.label} — ${s.isCurrent ? 'working here' : s.status === 'active' ? 'edited here' : s.status}`,
    ),
  ].join('\n');
  const extra = activity.sessions.length - MAX_DOTS;

  return (
    <>
      {(activity.recent || focused || addedBy) && (
        <div
          aria-hidden
          className={`live-activity-overlay live-activity-ring${activity.recent ? ' live-activity-ring--pulse' : ''}${addedBy && !activity.recent ? ' live-activity-ring--added' : ''}`}
          style={{ ['--live-color' as string]: ringColor }}
        />
      )}
      <div className="live-activity-overlay live-activity-badge nodrag nopan" title={title} role="status" aria-label={title}>
        {addedBy && (
          <span className="live-activity-new" style={{ backgroundColor: addedBy.color }}>
            New
          </span>
        )}
        {activity.sessions.slice(0, MAX_DOTS).map((s) => (
          <span
            key={s.sessionKey}
            className={`live-activity-dot${s.status === 'active' ? '' : ' live-activity-dot--idle'}`}
            style={{ backgroundColor: s.color }}
          />
        ))}
        {extra > 0 && <span className="live-activity-more">+{extra}</span>}
      </div>
    </>
  );
}

export const LiveActivityBadge = memo(LiveActivityBadgeComponent);
