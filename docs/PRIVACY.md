# Privacy

This page lists what the app stores, why, who can see it and how long it stays. It describes a hackathon demo: the data is demo data, the wallet is demo money, and nothing here is a legal compliance statement.

## In short

- The app stores a student's building choice, diet and allergen filters, goal, language and free gaps between classes. It never stores GPS, camera data, course names or class times.
- The chat assistant stores nothing. Its history lives in the page and disappears on reload, and no question text is sent to the server.
- The web app makes no calls to third parties: no analytics, no advertising, no external fonts or scripts.
- A student can delete their account in the app. That deletes their profile, free gaps, notifications, wallet and all of their orders, past and present.
- Vendors see the items, totals and times of orders for their own outlet. They do not see which student placed an order.

## What is stored, field by field

### Account and sign-in (`users`, `accounts`, `sessions`, `verifications`)

| Table           | Field                                                                                                                                                                                        | Why                                                                                                           | How long                                                                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `users`         | `name`, `email`                                                                                                                                                                              | Sign in and show who is signed in.                                                                            | Until the account is deleted.                                                                                                                    |
| `users`         | `role` (`student`, `vendor_staff`, `vendor_owner`, `admin`)                                                                                                                                  | Decide what each person may do.                                                                               | Until the account is deleted.                                                                                                                    |
| `users`         | `id`, `email_verified`, `image`, `created_at`, `updated_at`                                                                                                                                  | Bookkeeping. `image` is never set.                                                                            | Until the account is deleted.                                                                                                                    |
| `accounts`      | `user_id`, `password` (a hash made by Better Auth), `account_id`, `provider_id`, `access_token`, `refresh_token`, `id_token`, `access_token_expires_at`, `refresh_token_expires_at`, `scope` | Email and password sign-in. Token columns are empty because there is no social sign-in.                       | Until the account is deleted.                                                                                                                    |
| `sessions`      | `user_id`, `token`, `expires_at`, `ip_address`, `user_agent`, timestamps                                                                                                                     | Keep a person signed in. Better Auth records the IP address and browser string when the request carries them. | A session lasts 7 days (the Better Auth default). The app has no job that purges expired rows. Sessions are deleted when the account is deleted. |
| `verifications` | all                                                                                                                                                                                          | Defined by Better Auth for email verification. The app has no such flow.                                      | Nothing is written to it.                                                                                                                        |

The session cookie is `httpOnly` with `SameSite=Lax`.

### Student profile and timetable (`student_profiles`, `free_windows`)

| Table              | Field                                                                           | Why                                                                                                              | How long                      |
| ------------------ | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `student_profiles` | `diet_tags`, `allergens`                                                        | Filter and rank the menu. They are never shown to vendors.                                                       | Until the account is deleted. |
| `student_profiles` | `goal`                                                                          | Optional health goal used only as one ranking input.                                                             | Until the account is deleted. |
| `student_profiles` | `eat_minutes`                                                                   | How long the student wants to eat, used by the "leave at" time.                                                  | Until the account is deleted. |
| `student_profiles` | `chat_language`                                                                 | The language of the chat assistant. The rest of the app is English.                                              | Until the account is deleted. |
| `student_profiles` | `current_building_id`                                                           | A building picked from a list, used for walking times. It is not a location reading.                             | Until the account is deleted. |
| `free_windows`     | `weekday`, `start_minute`, `end_minute`, `prev_building_id`, `next_building_id` | Work out what fits before the next class. Only the free gaps and the buildings on either side of them are saved. | Until the account is deleted. |

When a student adds classes in onboarding, the app turns them into free gaps in the browser and sends only the gaps. Course names and class times are not sent and not stored.

### Orders and money (`orders`, `order_items`, `wallet_ledger`)

| Table           | Field                                                                                                           | Why                                                                                                                   | How long                                 |
| --------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `orders`        | `student_id`, `vendor_id`, `status`, `total_hkd`                                                                | Run the order.                                                                                                        | Until the student deletes their account. |
| `orders`        | `placed_at`, `accepted_at`, `fire_at`, `slot_start`, `ready_at`, `picked_up_at`, `cancelled_at`                 | Show progress, start scheduled orders on time, and measure real preparation time.                                     | Until the student deletes their account. |
| `orders`        | `predicted_point`, `predicted_low`, `predicted_high`, `predicted_base`, `backlog_at_placement`, `model_version` | Keep the wait estimate that was shown, so accuracy can be checked honestly and the engine can learn from the outcome. | Until the student deletes their account. |
| `order_items`   | `menu_item_id`, `qty`, `price_hkd_snapshot`, `prep_prior_snapshot_min`                                          | What was ordered, at the price paid.                                                                                  | Deleted with the order.                  |
| `wallet_ledger` | `delta_hkd`, `reason` (`seed`, `pay`, `refund`), `ref_order_id`, `created_at`                                   | Demo wallet. The balance is the sum of the rows. There is no balance column and no real payment.                      | Until the account is deleted.            |

### Notifications (`notifications`)

`kind`, `title`, `body`, `link`, `created_at`, `read_at`: the order updates and leave-now reminders in the bell, with the time they were made and read (both on the demo clock). Kept until the account is deleted. A demo reset clears all notifications.

### Vendor and outlet data (not personal)

`vendors`, `buildings`, `walk_times`, `menu_items`, `pickup_slots`, `busy_events`, `ticket_counts`, `engine_snapshots`, `academic_weeks`, `public_holidays` and `system_clock` describe outlets, buildings, menus, queues, the calendar and the demo clock. They hold no student data. `ticket_counts` and the history behind `engine_snapshots` are simulated. Vendor staff and owners are ordinary `users` with a `vendor_members` row that ties them to one outlet.

### Defined but not written

`search_events` (anonymous search analytics) and `real_observations` (stopwatch samples) exist in the schema, but no code writes to them, so they are empty.

## Who can see what

- **A student** sees their own profile, orders, wallet and notifications. Every student route is scoped to the signed-in user on the server.
- **A vendor** sees, for their own outlet only, each order's items, total and times, and the menu. The board does not include the student's name, email or id.
- **An admin** sees the demo clock and the accuracy page, which shows aggregate backtest figures and an average over completed in-app orders. The admin screens show no student profile or order list.
- **Other students** see nothing about each other. A chat question about someone else's order is refused, and the chat can only read the signed-in student's own data.

## Simulated people

The demo history contains 220 simulated students with fictional `@sim.invalid` addresses, no password and no profile. They exist only to give the wait engine something to learn from. They are not real people.

## Deleting an account

Students delete their account from the profile page. The page asks for the current password and an explicit tick before it sends the request to Better Auth's delete route. The server then removes, in one go:

- the user, the credential account and every session
- the student profile and free gaps
- all notifications
- all wallet rows
- all orders and their items, past and present

**Past orders are deleted, not anonymised.** This keeps nothing that could point back to the person. The cost is that the vendor's order history and the engine's learning samples lose those orders. Estimates already stored in `engine_snapshots` stay until the next snapshots replace them; they contain no student identifier.

Two guards apply. An account with an active order (placed, accepted, preparing or ready) cannot be deleted until the order is finished or cancelled. The four demo accounts cannot be deleted at all. Only the signed-in user's own account can be deleted: the route takes no user id.

## Not built

There is no data export, no automatic retention or purge job, and no consent log. The cut and kept items are in the Roadmap section of the README.
