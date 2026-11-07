import { describe, expect, it } from 'vitest';
import { resolveNodeIcon } from '../nodeIconResolver';

const icon = (label: string) => resolveNodeIcon({ label }).icon;

describe('icons picked from a card label', () => {
  it('gives each kind of component its own icon (a messaging system, as an agent draws it)', () => {
    expect(icon('Load Balancer')).toBe('arch-load-balancer');
    expect(icon('Media CDN')).toBe('arch-cdn');
    expect(icon('Chat Servers')).toBe('arch-chat');
    expect(icon('In-memory Cache')).toBe('arch-cache');
    expect(icon('Offline Queue')).toBe('arch-message-queue');
    expect(icon('Notification Service')).toBe('arch-notification');
  });

  it('reads a generically named store as a database', () => {
    expect(icon('User & Group DB')).toBe('arch-database');
    expect(icon('Message Store')).toBe('arch-database');
  });

  it('reads an app named by its user as a mobile client, and a web app as web', () => {
    expect(icon('Sender App')).toBe('arch-mobile');
    expect(icon('Recipient App')).toBe('arch-mobile');
    expect(icon('Web App')).toBe('arch-web');
  });

  it('reads APNs / FCM as push notifications', () => {
    expect(icon('APNs / FCM')).toBe('arch-notification');
  });
});
