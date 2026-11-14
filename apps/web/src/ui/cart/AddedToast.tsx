'use client';

import { useEffect, useState } from 'react';

export const TOAST_MILLISECONDS = 3000;

export interface ToastMessage {
  id: number;
  text: string;
}

export function AddedToast({
  toast,
  onView,
  onDone,
}: {
  toast: ToastMessage | null;
  onView: () => void;
  onDone: () => void;
}): React.JSX.Element {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (toast === null || paused) return;
    const timer = setTimeout(onDone, TOAST_MILLISECONDS);
    return () => clearTimeout(timer);
  }, [toast, paused, onDone]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-x-4 bottom-20 z-50 flex justify-center sm:bottom-6"
    >
      {toast ? (
        <div
          data-toast
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
          className="pointer-events-auto flex max-w-full items-center gap-3 rounded-xl bg-navy px-4 py-3 text-sm text-cream shadow-lg"
        >
          <span className="min-w-0 truncate">{toast.text}</span>
          <button
            type="button"
            data-toast-view
            onClick={onView}
            className="shrink-0 rounded-md bg-cream px-3 py-1.5 text-sm font-semibold text-navy hover:bg-white"
          >
            View cart
          </button>
        </div>
      ) : null}
    </div>
  );
}
