# Theme

All colour comes from one file, `apps/web/src/theme.ts`. `apps/web/tailwind.config.ts` reads it and defines only these colours, so a class from outside the palette does nothing, and a test fails if one is used.

| Name    | Hex       | Role                                                                            |
| ------- | --------- | ------------------------------------------------------------------------------- |
| `navy`  | `#384671` | Text, headers, selected chips, verified ticks                                   |
| `cream` | `#E9F4C9` | Quiet fills, tiles, text on navy                                                |
| `sky`   | `#3EADFF` | A thin accent line only, never small text                                       |
| `berry` | `#BB205C` | Main actions (Add to cart, Pay, Sign in), errors, the rush state                |
| `cocoa` | `#8B3A17` | Warnings, the demo-data banner, "Not verified" chips                            |
| `white` | `#FFFFFF` | Card surfaces                                                                   |
| `muted` | `#566286` | Secondary text. A 15% tint of navy toward white, so it stays within the palette |
| `paper` | `#FAFCF2` | The page surface: cream at 25% over white                                       |
| `blush` | `#F0E5E1` | The demo banner and warning chips: brown at 13% over white                      |
| `mist`  | `#D8EFFF` | A soft blue surface for an outlet tile: blue at 20% over white                  |

## How the colour is used

Roughly 60% white and the very light `paper` tint for surfaces, 30% navy for text and chrome, and 10% raspberry for the main action. Blue appears only as a thin accent line under the header and on the sign-in page. Light tints (`paper`, `blush`, `mist`) are allowed for surfaces because every text pair on them is in the contrast test below.

- **Header:** a white bar with a thin navy border, navy text and the logo straight on it, with no plate.
- **Sign in, sign up and the landing page:** no hero block. The logo sits straight on the light page (it has a transparent background), with the tagline in navy and a white form card with a soft shadow.
- **Profile and first-time setup:** a white page with thin dividers instead of boxes, small section headings, and chips with a light outline that fill navy when selected. First-time setup says "Set up your profile". Only the settings view says "Your profile" and offers account deletion.

## Contrast

Small text needs 4.5:1 and large text 3:1 (WCAG AA). `apps/web/tests/theme.test.ts` calculates the ratio for every pair declared in `theme.ts` and fails below those limits.

| Text on background | Ratio | Use                             |
| ------------------ | ----- | ------------------------------- |
| navy on cream      | 7.99  | Body text on the page           |
| navy on white      | 9.20  | Body text on cards              |
| muted on cream     | 5.23  | Secondary text on the page      |
| muted on white     | 6.02  | Secondary text on cards         |
| cream on navy      | 7.99  | Header, buttons, selected chips |
| white on berry     | 6.04  | Main action buttons             |
| cream on berry     | 5.25  | Raspberry tiles                 |
| berry on white     | 6.04  | Error text on cards             |
| berry on cream     | 5.25  | Error text on the page          |
| white on cocoa     | 7.73  | Warning banners                 |
| cream on cocoa     | 6.72  | Brown tiles                     |
| cocoa on cream     | 6.72  | Warning text on the page        |
| cocoa on white     | 7.73  | Warning text on cards           |
| navy on paper      | 8.88  | Body text on the page           |
| muted on paper     | 5.81  | Secondary text on the page      |
| berry on paper     | 5.83  | Tile initials, error text       |
| cocoa on blush     | 6.26  | The demo banner, warning chips  |
| navy on blush      | 7.45  | Text on a brown tint            |
| navy on mist       | 8+    | Text on a blue tint             |
| navy on sky        | 3.78  | Large text only: a tile initial |

White and cream small text is never placed on `sky` (2.43 and 2.12), and `sky` is never used for text or a border on cream or white. Control borders are navy at 60%, which is at least 3:1 against white and cream.

## Photos and the logo

The photos and the logo are our own, taken on campus. Nothing is downloaded, and no caterer's brand, logo or photo is reused.

- **Logo:** put `apps/web/public/logo.svg` in place. Every header has a 44 pixel slot that shows the emblem straight on the white bar, next to the "UniBowl" text. The sign-in, sign-up and landing pages show the whole logo, with its wordmark, at 128 pixels on phones and 176 pixels on laptops, and the "UniBowl" heading (from `brand.ts`) stays in the page for screen readers only. When the file does not exist the slots stay empty and the large "UniBowl" text shows instead. The logo file itself is never changed: the crop is done in CSS.
- **Outlet photos:** put one JPEG per outlet in `apps/web/public/outlets/`, named from the outlet name in lower case with every run of other characters turned into one hyphen. Any outlet without a file keeps a navy, raspberry, brown or blue tile with the outlet's initial. The card shows the photo as a banner across its top, 16 by 9, and reserves that space either way, so adding a photo moves nothing. The photo's alt text is the outlet name. A 1280 by 720 JPEG is a good size.
- **Rebuild:** the files are read when the page is served, so with Docker rebuild the web image after adding them.

| Outlet                                        | File                                                                |
| --------------------------------------------- | ------------------------------------------------------------------- |
| Main Canteen                                  | `apps/web/public/outlets/main-canteen.jpg`                          |
| Books 'n Bites                                | `apps/web/public/outlets/books-n-bites.jpg`                         |
| Café@CVA Commons                              | `apps/web/public/outlets/cafe-cva-commons.jpg`                      |
| Deli                                          | `apps/web/public/outlets/deli.jpg`                                  |
| Bistro NTT                                    | `apps/web/public/outlets/bistro-ntt.jpg`                            |
| BU Fiesta (closed for renovation, not listed) | `apps/web/public/outlets/bu-fiesta.jpg`                             |
| Harmony Cafeteria                             | `apps/web/public/outlets/harmony-cafeteria.jpg`                     |
| Harmony Lounge                                | `apps/web/public/outlets/harmony-lounge.jpg`                        |
| iCafe                                         | `apps/web/public/outlets/icafe.jpg`                                 |
| H.F.C. (Hot Food Counter) @ Scholars Court    | `apps/web/public/outlets/h-f-c-hot-food-counter-scholars-court.jpg` |
| Nan Yuan                                      | `apps/web/public/outlets/nan-yuan.jpg`                              |
| JCCC UG/F Cafe                                | `apps/web/public/outlets/jccc-ug-f-cafe.jpg`                        |
| JCCC G/F Cafe                                 | `apps/web/public/outlets/jccc-g-f-cafe.jpg`                         |

## Layout spaces kept free

- Every header has a fixed-size slot (`data-logo-slot`) and every outlet card a 16 by 9 banner slot (`data-image-slot`), so adding a logo or a photo moves nothing.

## Filter panel

- On a phone (under 1024 pixels) the filters are a bottom sheet. It slides up over a backdrop, keeps keyboard focus inside while it is open, closes with Escape, the backdrop or the Done button, and gives focus back to the "Filters and sorting" button. The page behind does not scroll while it is open.
- On a laptop (1024 pixels and up) the filters are a column that is open by default. The same button collapses it with a short slide and brings it back. A closed panel is `inert`, so it cannot be reached with the keyboard or a screen reader.

## Motion

All motion is plain CSS in `apps/web/tailwind.config.ts` and a few Tailwind classes, with no library. It only fades and moves, so it never changes the layout.

| Where                       | Effect                                                                |
| --------------------------- | --------------------------------------------------------------------- |
| Dish tiles and outlet cards | Fade up as they appear, staggered by 40 ms for the first 12 on screen |
| Cards and buttons           | A slight lift on hover and a small press-down on click                |
| Cart count in the header    | A short bump each time it changes                                     |
| Landing page                | The hero and the sign-in card fade up, and the blue stripe grows      |
| Filter panel                | The slide described above                                             |

For anyone whose device asks for reduced motion (`prefers-reduced-motion: reduce`), every animation and transition ends at once, and everything still works. The browser tests run with reduced motion by default, and `tests/e2e/panel.spec.ts` runs the panel and the animations with motion on, with a check that the page does not shift while they play.

## Tab and home screen icons

`apps/web/src/app/icon.png` (64 by 64) and `apps/web/src/app/apple-icon.png` (180 by 180) were made from the emblem part of the logo, on a white square so they read on a dark tab strip. The web manifest lists both.
