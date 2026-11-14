# API

Every route is a Next.js route handler under `apps/web/src/app/api`. This page lists the routes that exist. Request bodies are validated with `zod`: an unknown field or a wrong type returns `400 {"error":"invalid_request"}`.

## Conventions

- **Sign-in** is by session cookie. Send `origin` equal to the site's address on `POST` requests to the auth routes.
- **Errors** are JSON: `{ "error": "<code>" }`, with extra fields where noted.
  - `401 unauthenticated`: no session.
  - `403 forbidden`: the wrong role, or not a member of that vendor, or a staff member calling an owner-only action.
  - `400 invalid_request`: the body, query or id did not validate.
- **Times** are milliseconds since the epoch on the **demo clock**, not the wall clock, unless a field says otherwise.
- **Roles:** `student`, `vendor_staff`, `vendor_owner`, `admin`. "Vendor member" below means a staff member or owner of the vendor in the URL. "Owner" means a vendor owner of it.

## Auth (Better Auth)

`/api/auth/*` is handled by Better Auth. The app uses:

| Route                          | Purpose                                                                                                                                               |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/auth/sign-up/email` | Create a student account (`email`, `password`, `name`). A new account gets the starting demo credit of HK$300.                                        |
| `POST /api/auth/sign-in/email` | Sign in (`email`, `password`).                                                                                                                        |
| `POST /api/auth/sign-out`      | Sign out.                                                                                                                                             |
| `GET /api/auth/get-session`    | The current session.                                                                                                                                  |
| `POST /api/auth/delete-user`   | Delete the signed-in user's own account (`password`). Returns 403 for a demo account and 409 while the student has an active order. See `PRIVACY.md`. |

## Student

All of these need the `student` role.

| Route                           | What it does                                                                                                                                                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/me`                   | `{ user, onboardingComplete, profile }`. `profile` is `null` until the student has saved one.                                                                                                                                  |
| `PATCH /api/me`                 | Create or change the profile. Any of `dietTags`, `allergens`, `goal` (or `null`), `eatMinutes` (0 to 60), `chatLanguage` (`en`, `zh_HK`, `zh_CN`), `currentBuildingId` (or `null`). Returns `{ onboardingComplete, profile }`. |
| `GET /api/buildings`            | `{ buildings: [{ id, campus, name }] }`.                                                                                                                                                                                       |
| `GET /api/free-windows`         | `{ windows }`: the student's free gaps.                                                                                                                                                                                        |
| `PUT /api/free-windows`         | Replace all free gaps: `{ windows: [{ weekday 0 to 6, startMinute, endMinute, prevBuildingId, nextBuildingId }] }`.                                                                                                            |
| `DELETE /api/free-windows/:id`  | Delete one of their own gaps (404 for anyone else's).                                                                                                                                                                          |
| `GET /api/vendors`              | `{ now, vendors }`: each outlet with open and paused state, busy state, today's hours, walking time, and the wait range for a reference order.                                                                                 |
| `GET /api/menu-items`           | `{ items, meta }`: the ranked menu with waits, fit, leave-at times and why-chips. Returns `409 onboarding_required` before a profile exists. Query parameters below.                                                           |
| `GET /api/slots/:vendorId`      | Pickup slots for an outlet with capacity and free state. `?items=<menuItemId>:<qty>,...` makes the earliest slot depend on the cart.                                                                                           |
| `GET /api/wallet/me`            | `{ balanceHkd, entries }` (the 20 latest wallet rows).                                                                                                                                                                         |
| `POST /api/orders`              | Place an order. Body below. Returns `201 { order }`.                                                                                                                                                                           |
| `GET /api/orders`               | `{ orders }`: their 30 latest orders.                                                                                                                                                                                          |
| `GET /api/orders/:id`           | `{ order }` for their own order, 404 otherwise.                                                                                                                                                                                |
| `PATCH /api/orders/:id/cancel`  | Cancel while the order is still `placed`. The wallet is refunded and any slot released. Otherwise `409 not_cancellable`.                                                                                                       |
| `PATCH /api/orders/:id/pick-up` | Mark picked up from accepted, preparing or ready. Otherwise `409 not_ready`. Repeating it is allowed.                                                                                                                          |
| `GET /api/notifications`        | `{ notifications, unread }`: the latest 20 and the unread count.                                                                                                                                                               |
| `PATCH /api/notifications`      | Mark read: `{ "all": true }` or `{ "ids": [uuid, ...] }` (1 to 50). Returns `{ marked, notifications, unread }`.                                                                                                               |
| `GET /api/sse/me`               | Server-Sent Events for this student. Event names: `order`, `snapshot`, `queue`, `notification`, `resync`. Events carry ids and a status, never items or prices.                                                                |

### `GET /api/menu-items` query

| Parameter             | Meaning                                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------- |
| `diet`                | Comma list of `vegetarian, vegan, halal, no_pork, no_beef, gluten_free, dairy_free`. Overrides the profile. |
| `allergens`           | Comma list of `nuts, peanuts, seafood, shellfish, egg, soy, sesame, dairy, gluten`.                         |
| `maxPrice`, `maxWait` | Whole numbers: HK$ and minutes (the top of the wait range).                                                 |
| `fits`, `openNow`     | `1` to keep only items that fit before the next class, or only open outlets.                                |
| `vendor`              | Comma list of vendor ids.                                                                                   |
| `sort`                | `best_match` (default), `lowest_wait`, `lowest_price`.                                                      |
| `off`                 | Comma list of `diet`, `allergens`, `goal`: profile filters to switch off for this request.                  |

When any diet or allergen filter is on, items whose tags are not verified are left out. Halal is never assumed: it matches only items an owner has confirmed.

### `POST /api/orders` body

```json
{
  "vendorId": "<uuid>",
  "items": [{ "menuItemId": "<uuid>", "qty": 1 }],
  "pickup": { "kind": "asap" }
}
```

`pickup` is `{ "kind": "asap" }` or `{ "kind": "scheduled", "slotStart": <ms> }`. One to 8 lines, each quantity 1 to 5, total at most HK$500.

| Status | `error`                                                                                                                                             |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 402    | `insufficient_balance` (with `balanceHkd` and `totalHkd`)                                                                                           |
| 400    | `total_too_high`                                                                                                                                    |
| 409    | `vendor_unavailable`, `vendor_paused`, `vendor_closed`, `item_unavailable` (with `menuItemIds`), `slot_invalid`, `slot_full` (with `nextSlotStart`) |
| 429    | `rate_limited`: at most 5 orders per minute per student                                                                                             |

## Vendor

`:id` is a vendor id.

| Route                                           | Who           | What it does                                                                                                                                                                                        |
| ----------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/vendor/:id/status`                    | vendor member | `{ status: { name, paused, busyState, busyUntil, now } }`.                                                                                                                                          |
| `GET /api/vendor/:id/orders`                    | vendor member | `{ vendorId, orders }`: active orders (items, total, times, scheduled slot). No student identity.                                                                                                   |
| `PATCH /api/vendor/:id/orders/:orderId/:action` | vendor member | `action` is `accept`, `preparing`, `ready` or `picked-up`. Each is allowed from one status only (`picked-up` only from `ready`); a repeat is a no-op and a wrong state is `409 wrong_state`.        |
| `PATCH /api/vendor/:id/busy`                    | vendor member | `{ "state": "quiet" \| "normal" \| "rush" }`. Rush ends after 30 clock minutes.                                                                                                                     |
| `PATCH /api/vendor/:id/pause`                   | vendor member | `{ "paused": true \| false }`. A paused outlet refuses new orders.                                                                                                                                  |
| `GET /api/vendor/:id/menu`                      | vendor member | `{ items }`: every dish with price, category, stock and tag state.                                                                                                                                  |
| `POST /api/vendor/:id/menu`                     | owner         | Add a dish: `{ name (1 to 80), priceHkd (1 to 500), category (1 to 40) }`. It starts with no tags and `Not verified`. `409 name_taken` if the outlet already has that name. Returns `201 { item }`. |
| `PATCH /api/vendor/:id/menu/:itemId`            | owner         | Change any of `name`, `priceHkd`, `category` (at least one). Renaming a dish sets its tags back to unverified. Returns `{ item }`.                                                                  |
| `PATCH /api/vendor/:id/menu/:itemId/stock`      | vendor member | `{ "inStock": true \| false }`.                                                                                                                                                                     |
| `POST /api/vendor/:id/menu/:itemId/verify-tags` | owner         | Confirm a dish's tags, optionally with edited `dietTags` and `allergens` from the allowed lists. This is the only way a tag becomes verified, and who and when are recorded. Halal is never preset. |
| `GET /api/sse/vendor/:id`                       | vendor member | Server-Sent Events for that outlet: `order`, `queue`, `snapshot`, `resync`.                                                                                                                         |

There is no route to delete a dish or to change slot capacity.

## Admin

| Route                    | What it does                                                                                                                                                                                                                                                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/admin/ping`    | `{ ok: true }`: a plain check that the caller is an admin.                                                                                                                                                                                                                                                                          |
| `GET /api/admin/clock`   | `{ clock: { mode, speed, nowMs, demoMode } }`.                                                                                                                                                                                                                                                                                      |
| `PATCH /api/admin/clock` | Change the demo clock: `{ kind: "speed", speed: 0 \| 1 \| 10 \| 60 }`, `{ kind: "jump", minutes: 15 \| 60 \| 1440 }`, `{ kind: "set", timeMs }` or `{ kind: "start" }` (back to the demo start, paused). Returns `403 demo_mode_off` unless the server runs with `DEMO_MODE=true`. The change locks the clock row in a transaction. |

## Not built

Routes for deleting dishes, slot capacity, a stopwatch-samples import and a separate accuracy API are not built. The accuracy page reads `apps/web/public/accuracy.json` and the orders table directly.
