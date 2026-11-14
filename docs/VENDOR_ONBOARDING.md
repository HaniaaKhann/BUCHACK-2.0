# Vendor onboarding

This page describes what a vendor can do in the app today and how an outlet gets into it. Anything not built is listed at the end.

## How an outlet gets in

Outlets are not created in the app. The twelve HKBU outlets that are open (name, campus, building, floor, opening hours, official dietary options, with a source link and retrieval date) come from the seed data in `packages/db/seed-data/outlets.json`, built from HKBU's public pages. See `DATA.md`. The seed creates the outlets, a simulated menu for each, and the demo vendor accounts.

Today a vendor account is a user with the `vendor_owner` or `vendor_staff` role and a `vendor_members` row that ties them to one outlet. There is no sign-up or invitation screen for vendors: those rows are created by the seed, or by a database change. There is no way yet for an owner to add their own staff in the app.

The demo accounts are `owner@demo.example` and `staff@demo.example`, both attached to Bistro NTT. The password is in `AUTH.md`.

## What a vendor can do

Signing in as an owner or staff member opens the order board at `/vendor`.

**Order board** (owner and staff)

- Three columns: New, Accepted and Preparing, updated live. Below them, **Done today** lists the orders marked ready today, as waiting for pickup or completed.
- One button per order moves it forward: Accept, Start preparing and Mark ready. Ready is the last step: the student taps I picked it up, or the order completes by itself 30 minutes after it was ready on the demo clock. Each button works from one status only, and repeating a tap does nothing.
- A scheduled order shows its pickup time and the time to start by.
- If the vendor does not accept an order, the worker accepts it after 60 seconds.
- A sound toggle plays a short beep when a new order arrives. It is off by default.

**Kitchen status** (owner and staff)

- Busy level: Quiet, Normal or Rush. It changes the wait students are shown (a hand-set rule, see `WAIT_TIME_ENGINE.md`), and Rush ends by itself after 30 minutes of demo time.
- Pause orders: a paused outlet refuses new orders, and the page shows a "Paused" badge.

**Menu and stock** at `/vendor/menu`

- Stock switch for each dish (owner and staff).
- **Owner only:** add a dish (name, price in HK$, category) and edit the name, price or category of any dish. A new dish starts with no diet or allergen tags and shows **Not verified**. Renaming a dish sets its tags back to unverified, because it may now be a different dish.
- **Owner only:** review and confirm a dish's diet and allergen tags. Imported or simulated tags are never trusted: students see a tick for a diet only on a dish whose owner confirmed it, the app records who confirmed it and when, and halal is never set unless the owner ticks it.

Staff can change stock, busy level and pause, and can move orders along. They cannot add or edit dishes or confirm tags: the server answers 403 whatever the screen shows.

## What the vendor never sees

The board shows each order's items, total and times, but not which student placed it. Students' diets, allergens and profiles are not shown to vendors.

## Not built

- Vendor sign-up, invitations and adding staff in the app.
- Deleting a dish, uploading menu photos or importing a menu.
- Setting pickup-slot capacity (it is worked out from the outlet's estimated capacity, see `WAIT_TIME_ENGINE.md`).
- Syncing with an outlet's existing ordering or payment system. `PlatformAdapter` is an interface with no implementation.
- Reports beyond the owner's sales page, and any export.

These are on the Roadmap in the README.
