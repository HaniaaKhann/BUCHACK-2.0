import { ORDER_MAX_TOTAL_HKD } from '@app/core';
import { z } from 'zod';

const name = z.string().trim().min(1).max(80);
const category = z.string().trim().min(1).max(40);
const price = z.number().int().min(1).max(ORDER_MAX_TOTAL_HKD);

export const newMenuItemSchema = z.object({ name, priceHkd: price, category }).strict();

export const menuItemEditSchema = z
  .object({ name: name.optional(), priceHkd: price.optional(), category: category.optional() })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: 'nothing to change' });

export type NewMenuItem = z.infer<typeof newMenuItemSchema>;
export type MenuItemEdit = z.infer<typeof menuItemEditSchema>;
