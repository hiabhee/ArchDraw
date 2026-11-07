import { describe, expect, it } from 'vitest';
import { shouldResumeEditor, type LandingRequest } from '../returningVisitor';

const base: LandingRequest = {
  method: 'GET',
  cookie: '1',
  fetchSite: 'none',
  searchParams: new URLSearchParams(),
};

describe('shouldResumeEditor', () => {
  it('sends a returning visitor who types the address to the editor', () => {
    expect(shouldResumeEditor(base)).toBe(true);
  });

  it('also does so for a link from another site', () => {
    expect(shouldResumeEditor({ ...base, fetchSite: 'cross-site' })).toBe(true);
  });

  it('shows the landing page to a new visitor', () => {
    expect(shouldResumeEditor({ ...base, cookie: undefined })).toBe(false);
  });

  it('shows the landing page when the visitor clicks a link inside ArchDraw', () => {
    expect(shouldResumeEditor({ ...base, fetchSite: 'same-origin' })).toBe(false);
  });

  it('always shows the landing page for /?home', () => {
    expect(shouldResumeEditor({ ...base, searchParams: new URLSearchParams('home') })).toBe(false);
  });

  it('ignores anything but GET', () => {
    expect(shouldResumeEditor({ ...base, method: 'HEAD' })).toBe(false);
  });
});
