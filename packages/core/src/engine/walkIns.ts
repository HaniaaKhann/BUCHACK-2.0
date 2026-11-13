export interface WalkInsInput {
  tickets: number;
  appOrdersInSlot: number;
  ticketsIncludeAppOrders: boolean;
}

export function walkIns(input: WalkInsInput): number {
  if (!input.ticketsIncludeAppOrders) return input.tickets;
  return Math.max(0, input.tickets - input.appOrdersInSlot);
}
