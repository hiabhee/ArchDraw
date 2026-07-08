'use client';
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Classifies an edge by its flow type using its label, source node name, or target node name.
 */
export function getFlowColor(
  label?: string,
  sourceNodeLabel?: string,
  targetNodeLabel?: string
): string {
  const lbl = (label || '').toLowerCase();
  const src = (sourceNodeLabel || '').toLowerCase();
  const tgt = (targetNodeLabel || '').toLowerCase();

  const isStreaming = 
    lbl.includes('stream') || lbl.includes('audio') || lbl.includes('video') || lbl.includes('live') || lbl.includes('websocket') || lbl.includes('ws') || lbl.includes('grpc') ||
    src.includes('stream') || src.includes('audio') || src.includes('video') || src.includes('live') || src.includes('websocket') || src.includes('ws') || src.includes('grpc') ||
    tgt.includes('stream') || tgt.includes('audio') || tgt.includes('video') || tgt.includes('live') || tgt.includes('websocket') || tgt.includes('ws') || tgt.includes('grpc');

  if (isStreaming) return '#14B8A6';

  const isEvent = 
    lbl.includes('event') || lbl.includes('kafka') || lbl.includes('pubsub') || lbl.includes('queue') || lbl.includes('rabbitmq') || lbl.includes('sqs') || lbl.includes('sns') || lbl.includes('broker') || lbl.includes('message') ||
    src.includes('event') || src.includes('kafka') || src.includes('pubsub') || src.includes('queue') || src.includes('rabbitmq') || src.includes('sqs') || src.includes('sns') || src.includes('broker') || src.includes('message') ||
    tgt.includes('event') || tgt.includes('kafka') || tgt.includes('pubsub') || tgt.includes('queue') || tgt.includes('rabbitmq') || tgt.includes('sqs') || tgt.includes('sns') || tgt.includes('broker') || tgt.includes('message');

  if (isEvent) return '#F97316';

  const isAuth = 
    lbl.includes('auth') || lbl.includes('login') || lbl.includes('signup') || lbl.includes('oauth') || lbl.includes('session') || lbl.includes('jwt') || lbl.includes('authorize') || lbl.includes('identity') ||
    src.includes('auth') || src.includes('login') || src.includes('signup') || src.includes('oauth') || src.includes('session') || src.includes('jwt') || src.includes('authorize') || src.includes('identity') ||
    tgt.includes('auth') || tgt.includes('login') || tgt.includes('signup') || tgt.includes('oauth') || tgt.includes('session') || tgt.includes('jwt') || tgt.includes('authorize') || tgt.includes('identity');

  if (isAuth) return '#1E90FF';

  const isCache = 
    lbl.includes('cache') || lbl.includes('redis') || lbl.includes('memcached') || lbl.includes('caching') ||
    src.includes('cache') || src.includes('redis') || src.includes('memcached') || src.includes('caching') ||
    tgt.includes('cache') || tgt.includes('redis') || tgt.includes('memcached') || tgt.includes('caching');

  if (isCache) return '#3B82F6';

  const isAnalytics = 
    lbl.includes('analytics') || lbl.includes('metrics') || lbl.includes('logging') || lbl.includes('prometheus') || lbl.includes('grafana') || lbl.includes('observe') || lbl.includes('observability') || lbl.includes('amplitude') || lbl.includes('mixpanel') || lbl.includes('telemetry') || lbl.includes('dashboard') ||
    src.includes('analytics') || src.includes('metrics') || src.includes('logging') || src.includes('prometheus') || src.includes('grafana') || src.includes('observe') || src.includes('observability') || src.includes('amplitude') || src.includes('mixpanel') || src.includes('telemetry') || src.includes('dashboard') ||
    tgt.includes('analytics') || tgt.includes('metrics') || tgt.includes('logging') || tgt.includes('prometheus') || tgt.includes('grafana') || tgt.includes('observe') || tgt.includes('observability') || tgt.includes('amplitude') || tgt.includes('mixpanel') || tgt.includes('telemetry') || tgt.includes('dashboard');

  if (isAnalytics) return '#EAB308';

  // API / HTTP by default
  return '#94A3B8';
}

const MARKER_DEFS = (
  <defs>
    <marker id="marker-slate" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M 0 0 L 0 6 L 6 3 z" fill="#94A3B8" />
    </marker>
    <marker id="marker-teal" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M 0 0 L 0 6 L 6 3 z" fill="#14B8A6" />
    </marker>
    <marker id="marker-orange" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M 0 0 L 0 6 L 6 3 z" fill="#F97316" />
    </marker>
    <marker id="marker-blue" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M 0 0 L 0 6 L 6 3 z" fill="#3B82F6" />
    </marker>
    <marker id="marker-yellow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M 0 0 L 0 6 L 6 3 z" fill="#EAB308" />
    </marker>
    <marker id="arrow-sync" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M 0 0 L 0 6 L 6 3 z" fill="#3B82F6" />
    </marker>
    <marker id="arrow-async" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M 0 0 L 0 6 L 6 3 z" fill="#F59E0B" />
    </marker>
    <marker id="arrow-stream" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M 0 0 L 0 6 L 6 3 z" fill="#10B981" />
    </marker>
    <marker id="arrow-event" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M 0 0 L 0 6 L 6 3 z" fill="#3B82F6" />
    </marker>
    <marker id="arrow-dep" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M 0 0 L 0 6 L 6 3 z" fill="#6B7280" />
    </marker>
    <marker id="arrow-default" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M 0 0 L 0 6 L 6 3 z" fill="#6B7280" />
    </marker>
    <marker id="arrow-error" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M 0 0 L 0 6 L 6 3 z" fill="#EF4444" />
    </marker>
  </defs>
);

export function EdgeMarkerDefs() {
  return (
    <svg style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }} aria-hidden="true">
      {MARKER_DEFS}
    </svg>
  );
}

export function SVGEdgeMarkerDefs() {
  return (
    <svg style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }} aria-hidden="true">
      <defs>
        <marker id="edge-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M 0 0 L 0 6 L 6 3 z" fill="#94A3B8" />
        </marker>
      </defs>
    </svg>
  );
}

/**
 * Static HTML representation of the SVG marker definitions to be included in SVG exports.
 */
export const edgeMarkerDefsHTML = `
  <defs>
    <marker id="marker-slate" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M 0 0 L 0 6 L 6 3 z" fill="#94A3B8" />
    </marker>
    <marker id="marker-teal" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M 0 0 L 0 6 L 6 3 z" fill="#14B8A6" />
    </marker>
    <marker id="marker-orange" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M 0 0 L 0 6 L 6 3 z" fill="#F97316" />
    </marker>
    <marker id="marker-blue" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M 0 0 L 0 6 L 6 3 z" fill="#3B82F6" />
    </marker>
    <marker id="marker-yellow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M 0 0 L 0 6 L 6 3 z" fill="#EAB308" />
    </marker>
    <marker id="arrow-sync" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M 0 0 L 0 6 L 6 3 z" fill="#3B82F6" />
    </marker>
    <marker id="arrow-async" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M 0 0 L 0 6 L 6 3 z" fill="#F59E0B" />
    </marker>
    <marker id="arrow-stream" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M 0 0 L 0 6 L 6 3 z" fill="#10B981" />
    </marker>
    <marker id="arrow-event" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M 0 0 L 0 6 L 6 3 z" fill="#3B82F6" />
    </marker>
    <marker id="arrow-dep" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M 0 0 L 0 6 L 6 3 z" fill="#6B7280" />
    </marker>
    <marker id="arrow-default" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M 0 0 L 0 6 L 6 3 z" fill="#6B7280" />
    </marker>
    <marker id="arrow-error" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M 0 0 L 0 6 L 6 3 z" fill="#EF4444" />
    </marker>
  </defs>
`.trim();
