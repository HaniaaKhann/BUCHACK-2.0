import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { focusableIn, nextFocusIndex } from '../src/ui/dashboard/focusTrap';
import { STAGGER_LENGTH, STAGGER_STEP_MS, staggerDelay } from '../src/ui/motion';
import config from '../tailwind.config';

const css = readFileSync(fileURLToPath(new URL('../src/app/globals.css', import.meta.url)), 'utf8');

describe('focus trap', () => {
  it('moves forward and wraps from the last control to the first', () => {
    expect(nextFocusIndex(0, 3, false)).toBe(1);
    expect(nextFocusIndex(2, 3, false)).toBe(0);
  });

  it('moves back and wraps from the first control to the last', () => {
    expect(nextFocusIndex(2, 3, true)).toBe(1);
    expect(nextFocusIndex(0, 3, true)).toBe(2);
  });

  it('starts at the first or last control when focus is outside, and does nothing with none', () => {
    expect(nextFocusIndex(-1, 4, false)).toBe(0);
    expect(nextFocusIndex(-1, 4, true)).toBe(3);
    expect(nextFocusIndex(0, 0, false)).toBe(-1);
  });

  it('exports a finder for focusable controls', () => {
    expect(typeof focusableIn).toBe('function');
  });
});

describe('stagger delay', () => {
  it('steps by 40 ms and starts over after 12 tiles, so a long list never waits long', () => {
    expect(STAGGER_STEP_MS).toBe(40);
    expect(staggerDelay(0)).toBe('0ms');
    expect(staggerDelay(3)).toBe('120ms');
    expect(staggerDelay(STAGGER_LENGTH)).toBe('0ms');
    expect(staggerDelay(STAGGER_LENGTH - 1)).toBe(`${(STAGGER_LENGTH - 1) * STAGGER_STEP_MS}ms`);
  });
});

describe('motion is plain CSS and switches off on request', () => {
  const extend = (config.theme?.extend ?? {}) as {
    keyframes?: Record<string, unknown>;
    animation?: Record<string, string>;
  };

  it('defines the three animations in the Tailwind config and no library', () => {
    expect(Object.keys(extend.keyframes ?? {}).sort()).toEqual(['bump', 'fade-up', 'grow']);
    expect(Object.keys(extend.animation ?? {}).sort()).toEqual(['bump', 'fade-up', 'grow']);
    const manifest = readFileSync(
      fileURLToPath(new URL('../package.json', import.meta.url)),
      'utf8',
    );
    expect(manifest).not.toMatch(/framer-motion|motion"|gsap|animejs|react-spring|auto-animate/);
  });

  it('only moves and fades, so no animation changes the layout', () => {
    const keyframes = JSON.stringify(extend.keyframes);
    expect(keyframes).not.toMatch(/width|height|margin|padding|top|left|right|bottom/);
  });

  it('ends every animation and transition at once for people who ask for less motion', () => {
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('animation-duration: 0.01ms !important');
    expect(css).toContain('transition-duration: 0.01ms !important');
  });
});
