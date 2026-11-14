import type { AppEvent } from './notifications';

export type EventFilter = (event: AppEvent) => boolean;
export type EventHandler = (event: AppEvent) => void;

export interface EventHub {
  subscribe(filter: EventFilter, handler: EventHandler): () => void;
  publish(event: AppEvent): void;
  subscriberCount(): number;
}

interface Subscriber {
  filter: EventFilter;
  handler: EventHandler;
}

export function createEventHub(): EventHub {
  const subscribers = new Set<Subscriber>();
  return {
    subscribe(filter, handler) {
      const subscriber = { filter, handler };
      subscribers.add(subscriber);
      return () => {
        subscribers.delete(subscriber);
      };
    },
    publish(event) {
      for (const subscriber of [...subscribers]) {
        if (event.kind !== 'resync' && !subscriber.filter(event)) continue;
        try {
          subscriber.handler(event);
        } catch (error) {
          process.stderr.write(`[events] subscriber failed ${String(error)}\n`);
        }
      }
    },
    subscriberCount: () => subscribers.size,
  };
}

export function studentFilter(studentId: string): EventFilter {
  return (event) =>
    event.kind === 'snapshot' ||
    event.kind === 'queue' ||
    (event.kind === 'order' && event.studentId === studentId);
}

export function vendorFilter(vendorId: string): EventFilter {
  return (event) => event.kind !== 'resync' && event.vendorId === vendorId;
}
