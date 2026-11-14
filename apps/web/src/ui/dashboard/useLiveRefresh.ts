'use client';

import { useEffect, useRef } from 'react';

const REFRESH_EVENTS = ['snapshot', 'queue', 'order', 'notification', 'resync'] as const;
const DEBOUNCE_MS = 500;
const FALLBACK_REFRESH_MS = 60_000;

export function useLiveRefresh(onRefresh: () => void, url = '/api/sse/me'): void {
  const latest = useRef(onRefresh);
  latest.current = onRefresh;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refreshSoon = (): void => {
      clearTimeout(timer);
      timer = setTimeout(() => latest.current(), DEBOUNCE_MS);
    };

    const source = new EventSource(url);
    for (const name of REFRESH_EVENTS) source.addEventListener(name, refreshSoon);

    const onVisible = (): void => {
      if (document.visibilityState === 'visible') refreshSoon();
    };
    document.addEventListener('visibilitychange', onVisible);
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') latest.current();
    }, FALLBACK_REFRESH_MS);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      source.close();
    };
  }, [url]);
}
