import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ClockView } from '../src/server/clockAdmin';
import { ClockPanel } from '../src/ui/admin/ClockPanel';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}));

const NOW = Date.UTC(2026, 10, 17, 4, 15);

function panel(overrides: Partial<ClockView> = {}): string {
  return renderToStaticMarkup(
    <ClockPanel initial={{ mode: 'demo', speed: 0, nowMs: NOW, demoMode: true, ...overrides }} />,
  );
}

describe('ClockPanel', () => {
  it('shows the Hong Kong time, the speed and every control', () => {
    const html = panel();
    expect(html).toContain('Tue, 17 Nov 2026');
    expect(html).toContain('12:15:00');
    expect(html).toContain('Speed: Paused');
    for (const speed of [0, 1, 10, 60]) expect(html).toContain(`data-speed="${speed}"`);
    for (const minutes of [15, 60, 1440]) expect(html).toContain(`data-jump="${minutes}"`);
    expect(html).toContain('data-start');
    expect(html).toContain('data-set-time');
    expect(html).not.toContain('data-clock-locked');
  });

  it('shows the speed when playing', () => {
    expect(panel({ speed: 60 })).toContain('Speed: 60x');
  });

  it('disables the controls and says why when the demo mode is off', () => {
    const html = panel({ demoMode: false });
    expect(html).toContain('data-clock-locked');
    expect(html).toContain('Demo mode is off');
    expect(html.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(9);
  });
});
