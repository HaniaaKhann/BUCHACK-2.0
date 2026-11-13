# Auth and RBAC

## Authentication

Better Auth (pinned at 1.7.22) runs inside `apps/web` behind `/api/auth/*`. It uses the Prisma adapter against the `users`, `sessions`, `accounts` and `verifications` tables.

- Email and password sign-in. Passwords are hashed with scrypt by Better Auth.
- Session cookies are httpOnly and SameSite=Lax.
- `role` is an extra user field defaulting to `student`. It is not accepted as sign-up input, so a client cannot choose its own role.
- The auth instance is created lazily on first request, so `next build` does not need `BETTER_AUTH_SECRET`.

## Roles and route gates

Roles: `student`, `vendor_staff`, `vendor_owner`, `admin`. Every guarded route calls a server-side helper in `apps/web/src/server/rbac.ts`.

| Helper                                   | Passes when                                                                       |
| ---------------------------------------- | --------------------------------------------------------------------------------- |
| `requireRole(request, roles)`            | A valid session exists and its role is in `roles`.                                |
| `requireVendorAccess(request, vendorId)` | The role is a vendor role and the user has a `vendor_members` row for the vendor. |

Responses: `401` with no valid session, `403` for the wrong role or the wrong vendor, `400` for input that fails zod validation. `admin` has no implicit access to vendor routes.

Routes in place at this stage:

| Route                        | Gate                                                                        |
| ---------------------------- | --------------------------------------------------------------------------- |
| `GET /api/me`                | student                                                                     |
| `DELETE /api/me`             | student (stub, returns 501, deletion is `POST /api/auth/delete-user`)       |
| `GET /api/vendor/:id/orders` | vendor_owner or vendor_staff who is a member of `:id` (empty board for now) |
| `GET /api/admin/ping`        | admin                                                                       |

## Demo accounts

Seeded only when `DEMO_MODE=true`. All four share one fake password, defined as `DEMO_PASSWORD` in `packages/db/src/seed/accounts.ts`.

| Email                  | Role         | Vendor membership                 |
| ---------------------- | ------------ | --------------------------------- |
| `student@demo.example` | student      | none                              |
| `owner@demo.example`   | vendor_owner | owner of the first vendor by name |
| `staff@demo.example`   | vendor_staff | staff of the first vendor by name |
| `admin@demo.example`   | admin        | none                              |

Password hashes are produced by Better Auth's own `hashPassword`, so a seeded account signs in through the normal flow.

## Deleting accounts

`POST /api/auth/delete-user` is enabled and needs the current password. A `beforeDelete` hook rejects the four demo emails with 403, so a demo account cannot be removed through the app. The seed is also an upsert, so re-running it restores the accounts, their password and their vendor membership if they were removed directly in the database.

## Tests

`apps/web/tests/auth.e2e.test.ts` runs migrate and seed against the real database, signs in as each demo account through Better Auth, then calls the gated routes with the real session cookie. It checks 200 for the right role, 403 for the wrong roles, 401 without a session, the demo-account delete block, and that an ordinary user can still delete their own account. It needs `DATABASE_URL` and the `pnpm` binary on the path.

## Rate limiting

Better Auth's built-in rate limiter protects the auth endpoints. It keeps its counters in process memory, so limits reset on restart and are not shared across instances. This is acceptable for a single-container demo. A per-user token-bucket limiter for the chatbot route arrives with the chatbot milestone.
