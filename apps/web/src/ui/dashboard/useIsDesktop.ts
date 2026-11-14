import { useSyncExternalStore } from 'react';

const QUERY = '(min-width: 1024px)';

function subscribe(notify: () => void): () => void {
  const list = window.matchMedia(QUERY);
  list.addEventListener('change', notify);
  return () => list.removeEventListener('change', notify);
}

export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
