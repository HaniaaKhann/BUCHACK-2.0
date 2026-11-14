import { ORDER_MAX_LINES, ORDER_MAX_QTY_PER_LINE } from '@app/core';
import { z } from 'zod';

const line = z
  .object({
    menuItemId: z.string().uuid(),
    qty: z.number().int().min(1).max(ORDER_MAX_QTY_PER_LINE),
  })
  .strict();

const pickup = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('asap') }).strict(),
  z.object({ kind: z.literal('scheduled'), slotStart: z.number().int().positive() }).strict(),
]);

export const placeOrderSchema = z
  .object({
    vendorId: z.string().uuid(),
    items: z.array(line).min(1).max(ORDER_MAX_LINES),
    pickup,
  })
  .strict()
  .refine(
    (order) => new Set(order.items.map((item) => item.menuItemId)).size === order.items.length,
    'each item may appear once',
  );

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;
