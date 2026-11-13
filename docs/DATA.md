# Data sources

Living document. Every claim below is traceable to a public URL or marked as demo.

## HKBU outlets (seeded)

Source: [HKBU Estates Office — Catering Services](https://eo.hkbu.edu.hk/eo-services/services-facilities/Catering-Services.html).

The following outlets will be seeded with campus, location, food type, dietary options, opening hours, and `source_url` (the outlet's own detail page on `eo.hkbu.edu.hk`). All fields verified on **2026-11-13**:

- Main Canteen (BURC, Level 5 Dr. Wu Yee Sun Building — formerly AAB)
- Books 'n Bites (BURC, G/F Jockey Club Academic Community Centre)
- Café@CVA Commons (BURC, G/F Lee Shau Kee Communication and Visual Arts Building)
- Deli (BURC, Level 1 Communication and Visual Arts Building)
- Bistro NTT (BURC, G/F Dr. Ng Tor Tai International House)
- BU Fiesta (BURC, G/F Undergraduate Halls) — **closed for renovation**; listed as `closed_for_renovation`.
- Harmony Cafeteria (HSHC, Level 4 Sir Run Run Shaw Building)
- Harmony Lounge (HSHC, Level 4 Sir Run Run Shaw Building)
- iCafe (SHAW, Level 3 The Wing Lung Bank Building for Business Studies)
- H.F.C. (Hot Food Counter) @ Scholars Court (SHAW, Level 2 David C. Lam Building)
- Nan Yuan (SHAW, Level 2 David C. Lam Building) — sit-down restaurant, `pickup_enabled: false`.
- JCCC UG/F Cafe (JC3, Upper Ground Floor)
- JCCC G/F Cafe (JC3, Ground Floor)

Resolved during verification:

- **AAB renamed to Dr. Wu Yee Sun Building** — confirmed on the Main Canteen outlet page itself ("formerly known as Academic and Administration Building").
- **Books 'n Bites location** — the Estates Office detail page places it at JCACC, not Lee Shau Kee CVA. We use the current page.
- **Café@CVA Commons Sat/Sun/public-holiday hours** — the outlet page states Mon–Fri hours only; we seed Sat/Sun/PH as closed and flag that as an assumption.
- **Harmony Lounge food type** — not explicitly stated on the outlet page; we seed as "Café" (consistent with its halal/vegetarian/vegan listing).

## HKBU buildings (seeded)

Primary source would be the HKBU Glossary of Campuses and Buildings PDF
(`cmc.hkbu.edu.hk/.../5_hkbu_glossary_campuses_and_buildings.pdf`).
**That URL returned HTTP 410 Gone as of 2026-11-13** — the document has been withdrawn, and no equivalent public listing of building codes was found on `hkbu.edu.hk`, `eo.hkbu.edu.hk`, or `ar.hkbu.edu.hk`.

Per the project rule "use a building code only where an official HKBU source shows it", buildings without a current verifiable code are seeded with the name and an empty `code`. Buildings confirmed via outlet detail pages (section 14B.2) or the Estates Office "Contact Us" page (which locates the Estates Office in Oen Hall Building West Wing) are seeded with their verified names.

Seed behaviour:

- Every building is seeded with an empty `code`. No current official source for codes was reachable.
- `source` on each building records where the name came from: `outlet_page` (named on an outlet detail page), `estates_office_contact` (Estates Office contact page) or `glossary_2020` (the withdrawn glossary, name only, not re-verified).
- Deli's page says "Communication and Visual Arts Building"; it is seeded in the same building row as Café@CVA Commons.

## Walk times

HKBU does not publish walking times between buildings. All walk times at seed time have `source: "estimate"`. The team swaps measured values with `source: "measured"` before the demo video. The UI shows "est." next to any estimated walk time.

## Academic calendar 2026-27 (seeded)

Source: [HKBU Academic Registry — Academic Calendar 2026-27](https://ar.hkbu.edu.hk/f/upload/6370/Academic_Calendar_2026-27__2026.07.08_.pdf), verified 2026-11-13.

Teaching weeks:

- Semester 1 classes: 2026-09-01 to 2026-11-28
- Semester 1 examinations: 2026-12-07 to 2026-12-19
- Semester 1 ends: 2027-01-09
- Semester 1 make-up examinations: 2027-01-15 to 2027-01-21
- Semester 2 classes: 2027-01-11 to 2027-04-24
- Semester 2 examinations: 2027-05-03 to 2027-05-17
- Semester 2 make-up examinations: 2027-06-11 to 2027-06-17

No dedicated reading week is listed in the 2026-27 calendar.

Public holidays inside the academic year (all from the same PDF):

| Date                     | Holiday                                   |
| ------------------------ | ----------------------------------------- |
| 2026-09-26               | Day following Chinese Mid-Autumn Festival |
| 2026-10-01               | National Day                              |
| 2026-10-19               | Day following Chung Yeung Festival        |
| 2026-12-25 to 2026-12-26 | Christmas                                 |
| 2027-01-01               | First day of January                      |
| 2027-02-06 to 2027-02-09 | Lunar New Year                            |
| 2027-03-26 to 2027-03-29 | Easter (Good Friday – Easter Monday)      |
| 2027-04-05               | Ching Ming                                |
| 2027-05-01               | Labour Day                                |
| 2027-05-13               | Buddha's Birthday                         |
| 2027-06-09               | Tuen Ng (Dragon Boat)                     |
| 2027-07-01               | HKSAR Establishment Day                   |

## Menus (demo)

Every menu item, price, order, ticket count and wait time is simulated. Item-level diet and allergen tags are suggested by keyword rules; vendor owners verify them in-app before they ever appear as "Verified".

### Kaggle dataset — "Uber Eats USA Restaurants and Menus"

Status: not yet downloaded (download runs out-of-band, estimated 4 hours).

Rules for import (land in M3):

1. First command, `data:inspect`, streams every CSV in `data/raw/`, prints headers, row counts and the license text. User reviews before import runs.
2. `data:map` generates `mapping.proposed.json` which the user edits and saves as `mapping.confirmed.json`.
3. `data:import` refuses to run without `mapping.confirmed.json`. Streams the CSVs, strips restaurant names and brand mentions, converts USD to HKD at a fixed rate recorded here (set at import time), outputs `packages/db/seed-data/menus.json`.
4. Whether `menus.json` is committed is decided by the license text reported in step 1; if unclear, the generic fallback stands alone.

### Generic fallback menu

Hand-written in `packages/db/seed-data/menus_generic.json` (lands in M3). Enough for a full P0 demo without Kaggle data:

- Main Canteen, Harmony Cafeteria, H.F.C., Deli, Books 'n Bites — Hong Kong-style dishes.
- Bistro NTT — burger, steak, pasta.
- iCafe, Café@CVA Commons, Harmony Lounge, JCCC cafes — coffee, salad, cake, pastries.
- Nan Yuan — dim sum sampler (pickup disabled per the Estates Office listing).

## USD→HKD rate

Set at Kaggle import time. Current placeholder: not yet set.
