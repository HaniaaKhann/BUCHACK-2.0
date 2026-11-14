# Auth and access control

## Authentication

Better Auth (pinned at 1.7.22) runs inside `apps/web` behind `/api/auth/*`. It uses the Prisma adapter against the `users`, `sessions`, `accounts` and `verifications` tables.

- Email and password sign-in. Passwords are hashed with scrypt by Better Auth.
- Session cookies are `httpOnly` and `SameSite=Lax`. A session lasts 7 days.
- `role` is an extra user field defaulting to `student`. It is not accepted as sign-up input, so a client cannot choose its own role.
- A new student account gets the starting demo credit of HK$300 in the wallet.
- The auth instance is created lazily on first request, so `next build` does not need `BETTER_AUTH_SECRET`.

## Roles and route gates

Roles: `student`, `vendor_staff`, `vendor_owner`, `admin`. Every guarded route calls a server-side helper in `apps/web/src/server/rbac.ts`.

| Helper                                                  | Passes when                                                                        |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `requireRole(request, roles)`                           | A valid session exists and its role is in `roles`.                                 |
| `requireVendorAccess(request, vendorId)`                | The role is a vendor role and the user has a `vendor_members` row for that vendor. |
| `requireVendorAccess(request, vendorId, { ownerOnly })` | As above, and the membership role is `owner`. Staff get 403.                       |

Responses: `401` with no valid session, `403` for the wrong role, the wrong vendor or a staff member on an owner-only action, and `400` for input that fails `zod` validation. `admin` has no implicit access to vendor routes, and vendors have no access to student or admin routes.

| Area    | Gate                                                                                                                                            |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Student | `student` only: profile, free gaps, vendors, menu, slots, wallet, orders, notifications, and the student stream.                                |
| Vendor  | A member of that vendor. Adding or editing a dish and confirming tags need the owner. Stock, busy, pause and order steps are open to staff too. |
| Admin   | `admin` only: the demo clock and the accuracy page. Clock changes also need `DEMO_MODE=true`.                                                   |

The full route list, with every gate, is in `API.md`.

## Demo accounts

Seeded only when `DEMO_MODE=true`. All four share one fake password, defined as `DEMO_PASSWORD` in `packages/db/src/seed/accounts.ts`: `demo-password-1`. These are demo logins only, with no real credentials.

| Email                  | Role         | Vendor membership                 | Lands on                                       |
| ---------------------- | ------------ | --------------------------------- | ---------------------------------------------- |
| `student@demo.example` | student      | none                              | `/` (onboarding first, if there is no profile) |
| `owner@demo.example`   | vendor_owner | owner of the first vendor by name | `/vendor`                                      |
| `staff@demo.example`   | vendor_staff | staff of the first vendor by name | `/vendor`                                      |
| `admin@demo.example`   | admin        | none                              | `/admin`                                       |

Password hashes are produced by Better Auth's own `hashPassword`, so a seeded account signs in through the normal flow. The seed is an upsert, so running it again restores the accounts, their password and their vendor membership if they were removed directly in the database.

## Deleting an account

A student deletes their own account from the profile page (the **Profile** link in the dashboard header). The page shows what will be deleted, asks for the current password and an explicit tick, then calls Better Auth's `POST /api/auth/delete-user`.

- It deletes the user, the credential account and every session, the profile, free gaps, notifications, wallet rows and all orders with their items.
- **Past orders are deleted, not anonymised.** See `PRIVACY.md` for why.
- An account with an active order (placed, accepted, preparing or ready) is refused with 409 until the order is finished or cancelled.
- The four demo accounts are refused with 403, so a visitor cannot break the demo.
- The route takes no user id, so a signed-in user can only ever delete themselves.
- `DELETE /api/me` does not exist.

## Tests

`apps/web/tests/auth.e2e.test.ts` and `apps/web/tests/accountDeletion.e2e.test.ts` run migrate and seed against the real database and use real sessions. They check 200 for the right role, 403 for the wrong roles, 401 without a session, the demo-account delete block, that a user cannot delete another user, that the right rows disappear and the others stay, and that an active order blocks deletion. They need `DATABASE_URL` and the `pnpm` binary on the path. The Playwright account spec repeats the delete flow in a browser at 1280 and 390 pixels.

## Rate limiting

Better Auth's built-in limiter protects the auth endpoints, and an in-memory token bucket limits order placement to 5 per minute per student. Both keep their counters in process memory, so limits reset on restart and are not shared across instances. That is acceptable for a single-container demo. The chat assistant has no server route, so it has nothing to limit.
