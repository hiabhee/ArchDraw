export type GeometryStatus = 'ok' | 'degraded' | 'invalid' | 'failed';
export type RouteFailureReason = 'no-path-found' | 'search-budget-exceeded' | 'invalid-terminal';
export type FlowRole = 'main' | 'branch' | 'feedback' | 'supporting';

export interface Point { x: number; y: number }
export interface Rect { x: number; y: number; width: number; height: number }

export type EdgePathInput =
  | { kind: 'orthogonal'; waypoints: readonly Point[]; cornerRadius: number }
  | { kind: 'cubic'; start: Point; control1: Point; control2: Point; end: Point };

export type GeometryViolation =
  | { severity: 'hard'; code: 'NODE_COLLISION'; nodeId: string; otherNodeId: string }
  | { severity: 'hard'; code: 'OBSTACLE_INTERSECTION'; edgeId: string; obstacleId: string }
  | { severity: 'hard'; code: 'TERMINAL_INTERSECTION'; edgeId: string; nodeId: string }
  | { severity: 'soft'; code: 'EDGE_CROSSING'; edgeId: string; otherEdgeId: string }
  | { severity: 'soft'; code: 'PRIVATE_ROUTE_OVERLAP'; edgeId: string; otherEdgeId: string; length: number }
  | { severity: 'hard'; code: 'LABEL_COLLISION'; edgeId: string; withId: string };

export type PathViolation =
  | { code: 'PATH_OBSTACLE_INTERSECTION'; obstacleId: string }
  | { code: 'PATH_SELF_INTERSECTION' };
