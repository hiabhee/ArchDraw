'use client';

import { memo } from 'react';
import { useCanvasView } from '@/lib/diagram/canvas/CanvasHostContext';
import { useNodeLiveActivity, useProjectLiveStore } from '@/store/projectLiveStore';

const MAX_DOTS = 3;

/**
 * Live coding-agent overlay for a project canvas node. The node a session is
 * working on right now gets a coloured outline + glow (the session's figure
 * stands beside it, drawn by AgentAtlasLayer); nodes it touched earlier keep a
 * faint outline and a dot per session; a node an agent just added is shown
 * under construction. Editor-only; excluded from exports
 * via the `live-activity-overlay` class.
 */
function LiveActivityBadgeComponent({ nodeId }: { nodeId: string }) {
  const { showLiveActivity } = useCanvasView();
  const activity = useNodeLiveActivity(nodeId);
  const focusedSessionKey = useProjectLiveStore((s) => s.focusedSessionKey);
  if (!showLiveActivity || !activity || (activity.sessions.length === 0 && !activity.addedBy)) return null;

  // Sessions whose latest edit is on this node: the "someone is here" state.
  const here = activity.sessions.filter((s) => s.isCurrent);
  const focused = focusedSessionKey
    ? activity.sessions.find((s) => s.sessionKey === focusedSessionKey)
    : undefined;
  const { addedBy } = activity;
  const lead = focused ?? here[0] ?? activity.sessions[0];
  const ringColor = lead?.color ?? addedBy?.color;
  const editors = activity.sessions.filter((s) => s.status === 'active').map((s) => s.name ?? s.label);
  const title = [
    ...(activity.contested ? [`${editors.join(' and ')} are both editing here: they may overwrite each other or repeat work`] : []),
    ...(addedBy ? [`Added by ${addedBy.label}`] : []),
    ...activity.sessions.map(
      (s) => `${s.label} — ${s.isCurrent ? 'working here' : s.status === 'active' ? 'edited here' : s.status}`,
    ),
  ].join('\n');
  const extra = activity.sessions.length - MAX_DOTS;
  const ringClass = here.length > 0
    ? 'live-activity-ring--here'
    : focused || activity.recent
      ? ''
      : addedBy
        ? 'live-activity-ring--added'
        : 'live-activity-ring--visited';

  return (
    <>
      <div
        aria-hidden
        className={`live-activity-overlay live-activity-ring ${ringClass}${activity.recent ? ' live-activity-ring--pulse' : ''}`}
        style={{ ['--live-color' as string]: ringColor }}
      />
      {addedBy && (
        // Just added by an agent: shown under construction (see nodeStyles.css).
        <div aria-hidden className="live-activity-overlay live-construction" style={{ ['--live-color' as string]: addedBy.color }}>
          <span className="live-construction-label">building</span>
        </div>
      )}
      <div className="live-activity-overlay live-activity-badge nodrag nopan" title={title} role="status" aria-label={title}>
        {activity.contested && <span className="live-activity-clash">{editors.length} editing</span>}
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
