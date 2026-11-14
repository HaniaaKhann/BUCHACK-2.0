# Theme

All colour comes from one file, `apps/web/src/theme.ts`. `apps/web/tailwind.config.ts` reads it and defines only these colours, so a class from outside the palette does nothing, and a test fails if one is used.

| Name    | Hex       | Role                                                                            |
| ------- | --------- | ------------------------------------------------------------------------------- |
| `navy`  | `#384671` | Text, headers, selected chips, verified ticks                                   |
| `cream` | `#E9F4C9` | Page background, quiet fills, text on navy                                      |
| `sky`   | `#3EADFF` | Decoration only: the header stripe, outlet tiles, never small text              |
| `berry` | `#BB205C` | Main actions (Add to cart, Pay, Sign in), errors, the rush state                |
| `cocoa` | `#8B3A17` | Warnings, the demo-data banner, "Not verified" chips                            |
| `white` | `#FFFFFF` | Card surfaces                                                                   |
| `muted` | `#566286` | Secondary text. A 15% tint of navy toward white, so it stays within the palette |

## Contrast

Small text needs 4.5:1 and large text 3:1 (WCAG AA). `apps/web/tests/theme.test.ts` calculates the ratio for every pair declared in `theme.ts` and fails below those limits.

| Text on background | Ratio | Use                               |
| ------------------ | ----- | --------------------------------- |
| navy on cream      | 7.99  | Body text on the page             |
| navy on white      | 9.20  | Body text on cards                |
| muted on cream     | 5.23  | Secondary text on the page        |
| muted on white     | 6.02  | Secondary text on cards           |
| cream on navy      | 7.99  | Header, buttons, selected chips   |
| white on berry     | 6.04  | Main action buttons               |
| cream on berry     | 5.25  | Raspberry tiles                   |
| berry on white     | 6.04  | Error text on cards               |
| berry on cream     | 5.25  | Error text on the page            |
| white on cocoa     | 7.73  | Warning banners                   |
| cream on cocoa     | 6.72  | The demo-data banner, brown tiles |
| cocoa on cream     | 6.72  | Warning text on the page          |
| cocoa on white     | 7.73  | Warning text on cards             |
| navy on sky        | 3.78  | Large text only: a tile initial   |

White and cream small text is never placed on `sky` (2.43 and 2.12), and `sky` is never used for text or a border on cream or white. Control borders are navy at 60%, which is at least 3:1 against white and cream.

## Photos and the logo

The photos and the logo are our own, taken on campus. Nothing is downloaded, and no caterer's brand, logo or photo is reused.

- **Logo:** put `apps/web/public/logo.svg` in place. Every header has a fixed-size slot that shows it when the file exists and stays empty when it does not.
- **Outlet photos:** put one JPEG per outlet in `apps/web/public/outlets/`, named from the outlet name in lower case with every run of other characters turned into one hyphen. Any outlet without a file keeps a navy, raspberry, brown or blue tile with the outlet's initial. The card reserves a 48 by 48 pixel box either way, so adding a photo moves nothing, and the photo's alt text is the outlet name.
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

- Every header has a fixed-size slot (`data-logo-slot`) and every outlet card a 48 pixel image slot (`data-image-slot`), so adding a logo or a photo moves nothing.
