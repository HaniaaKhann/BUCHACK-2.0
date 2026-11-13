export interface PlatformMenuItem {
  readonly externalId: string;
  readonly name: string;
  readonly priceHkd: number;
  readonly category: string;
  readonly available: boolean;
}

export interface PlatformTicketCount {
  readonly vendorExternalId: string;
  readonly slotStart: Date;
  readonly count: number;
}

export interface PlatformOrder {
  readonly externalId: string;
  readonly items: ReadonlyArray<{ externalMenuItemId: string; qty: number }>;
  readonly slotStart: Date | null;
}

export interface PlatformAdapter {
  fetchMenu(vendorExternalId: string): Promise<ReadonlyArray<PlatformMenuItem>>;
  handleWebhook(payload: unknown, signature: string): Promise<void>;
  pushOrder(order: PlatformOrder): Promise<void>;
  fetchTicketCounts(since: Date): Promise<ReadonlyArray<PlatformTicketCount>>;
}
