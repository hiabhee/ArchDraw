'use client';

import React from 'react';
import { Avatar, Bar, Follow, Popover, Stage, Text, Window, type Act, type Rect } from '@/lib/stageshow-kit';
import { SESSION_COLORS } from '@/lib/diagram/projects/liveActivity';
import './LiveMapShot.css';

/**
 * Live project demo: three coding agents working on one codebase, drawn on the
 * system map. Beats: Gecko walks the map (web, gateway, auth) reading files;
 * Fox, building code no component owns yet, asks for permission, so its row
 * jumps to the top of "Needs you" and its flag goes up; the cursor opens that
 * component's history card, which says who touched it and why. Loops: the
 * card closes, Fox gets its answer and the agents return to their start.
 *
 * Real strings: the three session names, what each is doing, the component
 * names, the card's headline. Everything else is a placeholder bar.
 */

type Id = 'web' | 'gateway' | 'auth' | 'orders' | 'payments' | 'site';
type Act_ = 'reading' | 'writing' | 'waiting';

type S = {
  gecko: Id;
  geckoActs: Act_;
  fox: Act_;
  needs: boolean;
  card: boolean;
};

const initial: S = { gecko: 'web', geckoActs: 'reading', fox: 'writing', needs: false, card: false };

const LABEL: Record<Act_, string> = {
  reading: 'reading files…',
  writing: 'writing code…',
  waiting: 'needs permission',
};

const AGENTS = {
  otter: { name: 'Otter', color: SESSION_COLORS[4] },
  gecko: { name: 'Gecko', color: SESSION_COLORS[2] },
  fox: { name: 'Fox', color: SESSION_COLORS[6] },
};

const NODES: Record<Id, { label: string; col: number; row: number }> = {
  auth: { label: 'Auth', col: 1, row: 0 },
  orders: { label: 'Orders', col: 2, row: 0 },
  web: { label: 'Web app', col: 0, row: 1 },
  gateway: { label: 'API gateway', col: 1, row: 1 },
  payments: { label: 'Payments', col: 2, row: 1 },
  site: { label: 'refunds/', col: 2, row: 2 },
};

const EDGES: [Id, Id][] = [
  ['web', 'gateway'],
  ['gateway', 'auth'],
  ['gateway', 'orders'],
  ['gateway', 'payments'],
];

async function script(a: Act<S>) {
  await a.wait(1000);
  // Gecko reads its way along the request path
  a.mark('gecko');
  a.put({ gecko: 'gateway' });
  await a.wait(1500);
  a.put({ gecko: 'auth' });
  await a.wait(1300);
  // Fox needs a yes: the flag goes up and its row rises to the top
  a.mark('fox');
  a.put({ fox: 'waiting', needs: true });
  await a.wait(1400);
  // The cursor comes for the component and opens its history
  await a.move({ at: 'n-payments', x: 0.82, y: 0.78 }, { duration: 900 });
  await a.click({ at: 'n-payments', x: 0.82, y: 0.78 });
  a.put({ card: true });
  await a.wait(3400);
  // Closed by the pane click, then Fox gets its answer and goes back to work
  await a.move(a.rect('pane'), { duration: 700 });
  await a.click('pane');
  a.put({ card: false });
  await a.wait(500);
  a.put({ fox: 'writing', needs: false });
  await a.wait(900);
  a.put({ gecko: 'web', geckoActs: 'reading' });
  await a.wait(900);
}

function Star({ color, hollow }: { color: string; hollow?: boolean }) {
  const pts: string[] = [];
  for (let k = 0; k < 10; k++) {
    const r = k % 2 === 0 ? 8 : 3.6;
    const ang = -Math.PI / 2 + (k * Math.PI) / 5;
    pts.push(`${(9 + Math.cos(ang) * r).toFixed(1)},${(9 + Math.sin(ang) * r).toFixed(1)}`);
  }
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <polygon points={pts.join(' ')} fill={hollow ? 'none' : color} stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

/** A figure standing under a component. `at` is that component's rect. */
function Figure({ at, dx = 0, color, name, doing, attention }: { at: Rect; dx?: number; color: string; name: string; doing: string; attention?: boolean }) {
  const to = at.width ? { x: at.x + 4 + dx, y: at.y + at.height + 8, width: 18, height: 18 } : null;
  return (
    <Follow to={to} data-show={to ? '' : undefined} stiffness={0.1} className="lp-figure" style={{ '--who': color } as React.CSSProperties}>
      <Star color={color} />
      <span className="lp-tag" data-attention={attention || undefined}>
        <b>{name}</b>
        <i>{doing}</i>
      </span>
    </Follow>
  );
}

function SessionRow({ name, color, doing, attention, time }: { name: string; color: string; doing: string; attention?: boolean; time?: string }) {
  return (
    <div className="lp-row" data-attention={attention || undefined} style={{ '--who': color } as React.CSSProperties}>
      <span className="lp-dot" />
      <b>{name}</b>
      <i>{doing}</i>
      {time && <time>{time}</time>}
    </div>
  );
}

export function LiveMapShot() {
  return (
    <Stage<S>
      width={548}
      height={400}
      compact={{ below: 480, width: 358, height: 400 }}
      theme="dark"
      initial={initial}
      poster={{ gecko: 'auth', geckoActs: 'reading', fox: 'waiting', needs: true, card: true }}
      script={script}
      cursor={{ at: { x: 420, y: 330 }, style: 'arrow' }}
      className="lp"
    >
      {(s, rect, layout) => {
        const compact = layout === 'compact';
        const r = (id: Id) => rect(`n-${id}`);
        const foxWaiting = s.fox === 'waiting';
        const side = (
          <div className="lp-side">
            <div className="lp-head">Sessions</div>
            <div className="lp-group" data-open={s.needs || undefined}>
              <div className="lp-cap">Needs you</div>
              <SessionRow name="Fox" color={AGENTS.fox.color} doing="needs permission" attention time="0:12" />
            </div>
            <div className="lp-list" data-lowered={s.needs || undefined}>
              <SessionRow name="Otter" color={AGENTS.otter.color} doing="writing code…" />
              <SessionRow name="Gecko" color={AGENTS.gecko.color} doing={LABEL[s.geckoActs]} />
              <div className="lp-fox" data-hidden={s.needs || undefined}>
                <SessionRow name="Fox" color={AGENTS.fox.color} doing={LABEL[s.fox]} />
              </div>
              <div className="lp-filler">
                <Bar w="78%" h={7} r={3.5} tone={2} />
                <Bar w="54%" h={7} r={3.5} tone={2} />
              </div>
            </div>
          </div>
        );
        return (
          <>
            <Window
              title="acme-shop"
              className="lp-win"
              sidebar={compact ? undefined : side}
              sidebarWidth={160}
              lead={
                <span className="lp-live">
                  <i /> 3 sessions
                </span>
              }
            >
              <div className="lp-canvas" data-target="pane">
                {EDGES.map(([from, to]) => (
                  <Edge key={`${from}-${to}`} from={r(from)} to={r(to)} pane={rect('pane')} />
                ))}
                {(Object.keys(NODES) as Id[]).map((id) => (
                  <div
                    key={id}
                    className="lp-node"
                    data-id={id}
                    data-target={`n-${id}`}
                    data-cursor="pointer"
                    data-site={id === 'site' || undefined}
                    data-ring={(id === 'payments' && s.card) || undefined}
                    data-alert={(id === 'site' && foxWaiting) || undefined}
                    style={{ gridColumn: NODES[id].col + 1, gridRow: NODES[id].row + 1 }}
                  >
                    {id === 'site' ? <small>not on the map yet</small> : null}
                    <Text className="lp-name">{NODES[id].label}</Text>
                    {id !== 'site' && <Bar w="52%" h={5} r={2.5} tone={2} />}
                  </div>
                ))}
                <span className="lp-level">
                  <b>Overview</b>
                  <span>Detailed</span>
                </span>
              </div>
            </Window>

            <Figure at={r('orders')} color={AGENTS.otter.color} name="Otter" doing="writing code…" />
            <Figure at={r(s.gecko)} color={AGENTS.gecko.color} name="Gecko" doing={LABEL[s.geckoActs]} />
            <Figure at={r('site')} color={AGENTS.fox.color} name="Fox" doing={LABEL[s.fox]} attention={foxWaiting} />

            <Popover show={s.card} origin="top right" className="lp-card">
              <div className="lp-card-head">
                <b>Payments</b>
                <span>history</span>
              </div>
              <div className="lp-bout">
                <Avatar name="Fox" size={20} />
                <div>
                  <p>
                    <b>Fox</b> · 4 edits · 2m ago
                  </p>
                  <q>Add refund endpoint</q>
                </div>
              </div>
              <div className="lp-bout">
                <Avatar name="Otter" size={20} />
                <div>
                  <p>
                    <b>Otter</b> · 11 edits · 1h ago
                  </p>
                  <q>Retry failed charges</q>
                </div>
              </div>
            </Popover>
          </>
        );
      }}
    </Stage>
  );
}

/** A quiet orthogonal link between two measured components. */
function Edge({ from, to, pane }: { from: Rect; to: Rect; pane: Rect }) {
  if (!from.width || !to.width || !pane.width) return null;
  const x1 = from.x + from.width - pane.x;
  const y1 = from.y + from.height / 2 - pane.y;
  const x2 = to.x - pane.x;
  const y2 = to.y + to.height / 2 - pane.y;
  const mid = (x1 + x2) / 2;
  return (
    <svg className="lp-edge" width={pane.width} height={pane.height} aria-hidden="true">
      <path d={`M${x1} ${y1} H${mid} V${y2} H${x2}`} />
    </svg>
  );
}
