import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { APP_NAME, APP_TAGLINE } from '../src/brand';
import { AuthShell } from '../src/ui/AuthShell';
import { AppHeader } from '../src/ui/primitives';

const css = readFileSync(fileURLToPath(new URL('../src/app/globals.css', import.meta.url)), 'utf8');

describe('landing hero', () => {
  const html = renderToStaticMarkup(
    <AuthShell title="Get started">
      <p>content</p>
    </AuthShell>,
  );

  it('keeps the app name from brand.ts as a heading, and the tagline', () => {
    const flat = html.replace(/\s+/g, ' ');
    expect(flat).toContain('data-hero-name');
    expect(flat).toMatch(/<h1[^>]*data-hero-name[^>]*> ?UniBowl ?<\/h1>/);
    expect(APP_NAME).toBe('UniBowl');
    expect(html).toContain(APP_TAGLINE);
  });

  it('shows the tagline in bold italic navy and has no blue line under it', () => {
    expect(html).toMatch(/<p[^>]*text-lg font-bold italic text-navy[^>]*>/);
    expect(html).not.toContain('bg-sky');
  });

  it('puts everything on one white card of at most 420 pixels over a navy-covered backdrop, with a divider above the form', () => {
    expect(html).toContain('data-auth-card');
    expect(html).toContain('max-w-[420px]');
    expect(html).toMatch(/data-auth-card[^>]*bg-white|bg-white[^>]*data-auth-card/);
    expect(html).toContain('bg-navy/60');
    expect(html).toContain('<hr');
    expect(html.indexOf('<hr')).toBeLessThan(html.indexOf('Get started'));
    expect(html.indexOf('Get started')).toBeLessThan(html.indexOf('content'));
  });

  it('loads the campus photo as a priority, compressed, cover image', () => {
    expect(html).toContain('campus%2Fhkbu-landing.jpg');
    expect(html).toContain('q=70');
    expect(html).toContain('object-cover');
    expect(html).toMatch(/rel="preload" as="image"/);
  });

  it('has a hero logo slot of 208 pixels on a phone and 240 from tablet up, hidden from screen readers', () => {
    expect(html).toContain('data-logo-hero');
    expect(html).toContain('h-52 w-52');
    expect(html).toContain('sm:h-60 sm:w-60');
    expect(html).toMatch(
      /data-logo-hero[^>]*aria-hidden="true"|aria-hidden="true"[^>]*data-logo-hero/,
    );
  });
});

describe('header logo slot', () => {
  it('is 44 pixels, empty, and hidden from screen readers, next to the title', () => {
    const html = renderToStaticMarkup(<AppHeader left={<h1>{APP_NAME}</h1>} />);
    expect(html).toContain('data-logo-slot');
    expect(html).toContain('h-11 w-11');
    expect(html).toContain(`<h1>${APP_NAME}</h1>`);
    expect(html).not.toContain('data-logo-hero');
  });
});

describe('logo styles', () => {
  it('only show the logo, straight on the page with no plate, and the hidden heading when the logo file exists', () => {
    expect(css).toMatch(/\[data-logo-hero\]\s*\{\s*display:\s*none/);
    expect(css).toContain('[data-logo] [data-logo-slot]');
    expect(css).toContain("url('/logo.svg')");
    expect(css).not.toMatch(/\[data-logo\] \[data-logo-slot\] \{[^}]*background-color/);
    expect(css).not.toMatch(/\[data-logo\] \[data-logo-slot\] \{[^}]*padding/);
    expect(css).toMatch(/\[data-logo\] \[data-hero-name\][\s\S]*clip: rect\(0 0 0 0\)/);
  });

  it('never edits the logo file, only crops it with CSS', () => {
    expect(css).toContain('background-size: 165%');
    expect(css).toContain('background-size: contain');
  });
});
