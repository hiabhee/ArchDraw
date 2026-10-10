import { resolveNodeIconVisibility, type NodeIconMode } from '../nodeIconVisibility';

describe('resolveNodeIconVisibility', () => {
  describe('with explicit node override', () => {
    it('respects showIcon=true regardless of mode', () => {
      expect(resolveNodeIconVisibility('all', true, false)).toBe(true);
      expect(resolveNodeIconVisibility('normal', true, false)).toBe(true);
      expect(resolveNodeIconVisibility('off', true, false)).toBe(true);
      expect(resolveNodeIconVisibility('all', true, true)).toBe(true);
      expect(resolveNodeIconVisibility('normal', true, true)).toBe(true);
      expect(resolveNodeIconVisibility('off', true, true)).toBe(true);
    });

    it('respects showIcon=false regardless of mode', () => {
      expect(resolveNodeIconVisibility('all', false, false)).toBe(false);
      expect(resolveNodeIconVisibility('normal', false, false)).toBe(false);
      expect(resolveNodeIconVisibility('off', false, false)).toBe(false);
      expect(resolveNodeIconVisibility('all', false, true)).toBe(false);
      expect(resolveNodeIconVisibility('normal', false, true)).toBe(false);
      expect(resolveNodeIconVisibility('off', false, true)).toBe(false);
    });
  });

  describe('without node override', () => {
    it('shows all icons in "all" mode', () => {
      expect(resolveNodeIconVisibility('all', undefined, false)).toBe(true);
      expect(resolveNodeIconVisibility('all', undefined, true)).toBe(true);
    });

    it('shows all icons in "normal" mode (manual icons are intentional)', () => {
      expect(resolveNodeIconVisibility('normal', undefined, false)).toBe(true);
      expect(resolveNodeIconVisibility('normal', undefined, true)).toBe(true);
    });

    it('hides all icons in "off" mode', () => {
      expect(resolveNodeIconVisibility('off', undefined, false)).toBe(false);
      expect(resolveNodeIconVisibility('off', undefined, true)).toBe(false);
    });
  });

  describe('icon source consistency', () => {
    const modes: NodeIconMode[] = ['all', 'normal', 'off'];

    modes.forEach((mode) => {
      it(`${mode} mode treats auto-detected and manual icons consistently`, () => {
        const autoDetected = resolveNodeIconVisibility(mode, undefined, false);
        const manual = resolveNodeIconVisibility(mode, undefined, true);
        
        if (mode === 'off') {
          expect(autoDetected).toBe(false);
          expect(manual).toBe(false);
        } else {
          // Both 'all' and 'normal' should show icons
          expect(autoDetected).toBe(true);
          expect(manual).toBe(true);
        }
      });
    });
  });
});
