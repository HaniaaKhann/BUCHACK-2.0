# Chat assistant

The assistant is a set of rules. It has no model, no external service, no key and no server route. It runs in the student's browser, keeps its history only in the page, and only reads the student's own data through the existing `GET` endpoints. The code is in `packages/core/src/chat` and `apps/web/src/ui/chat`, and a test scans both folders for storage, network writes and secrets.

## What happens to a question

1. **Normalise.** The text is lower-cased, punctuation and apostrophes are removed, hyphens become spaces, and a letter repeated three or more times is cut to two ("hellooo" becomes "helloo"). Chinese text and prices such as `HK$35` are kept as they are.
2. **Fix spelling.** Each English word that is not already known is compared with a vocabulary of diets, allergens, dishes and cuisines, outlet words and command words, using an edit distance in which one swap of two letters counts as one edit.
   - Words under 4 letters are never fixed, except stretched greetings such as "heyyy".
   - A word of 4 to 6 letters may differ by one edit and must start with the same letter. A word of 7 or more letters may differ by two edits.
   - Ordinary words that look like a dish ("nice", "main", "meal") are protected.
   - A word that is equally close to two different entries is left alone.
   - Chinese text is not touched.
3. **Read the meaning.** Time, price, diet, allergen, dish, "cheap" and "quick" are read from the fixed text, and a question is matched to one intent with a synonym list per intent.
4. **Answer.** The reply is built from the data the page just read.

## Safety rules

- A diet or allergen word is never fixed silently. When one is corrected the reply starts with "I read this as halal." (or the corrected word), and adds that the match was loose and that no dish is being called safe. Check the dish tags before ordering.
- An allergen the assistant is not sure about is never guessed. If a word is two edits away from an allergen, if it could be two allergens, if it follows "no" or "without" and is one the assistant does not recognise but is close to an allergen, or if it follows "allergic to", "allergy" or "avoid" and is not an allergen it knows, the assistant asks "Which allergen do you mean?" and shows a button for each possible allergen. It does not search until the student chooses. A wheat allergy, which the app cannot filter, is asked about in the same way.
- A diet word that could be two things is asked about the same way.
- Diet and allergen filters still use only tags the vendor owner has confirmed. Halal is never assumed, and the dashboard's halal sentence is used word for word.
- Nothing typed is put into a request. A request holds only numbers (minutes, price) and the fixed values of the existing filters and sort orders. Dish words filter the answer in the browser.

## What it understands

| Intent            | Examples of wording                                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Open outlets      | "what's open", "any place open", "which canteens are open"                                                                                                          |
| Wait at an outlet | "how busy is Deli", "queue at Harmony", "is Main Canteen crowded", "wait time at Bistro NTT"                                                                        |
| Food              | "what should I eat", "I'm hungry", "recommend something cheap", "noodles please", "do you have pasta", "quick lunch", "under $30", "something before my next class" |
| My order          | "where is my food", "is my food ready", "track order", "order ready yet"                                                                                            |
| Wallet            | "my balance", "how much credit", "money left"                                                                                                                       |
| How to order      | "how do I buy", "how does this work"                                                                                                                                |
| Leave time        | "when should I leave"                                                                                                                                               |
| Help              | "help me", "what can you do", "good morning", "hello"                                                                                                               |
| Thanks            | "thanks", "thank you", "thx", "cheers" (and 謝謝, 多謝, 唔該)                                                                                                       |
| Small talk        | "how are you", "who are you", "bye"                                                                                                                                 |

"Cheap", "cheapest" and "budget" sort the list by price. "Quick" and "fast" sort it by wait. Dish words such as noodles, rice, pasta, burger, coffee, tea and dessert keep only the dishes whose names match.

## When it does not understand

It says "I could not match that to anything I can answer", says what it can answer, and shows four example questions to tap. It does not guess an answer.

## Known limits

- Spelling is fixed for English words only. Chinese questions use the existing phrase lists in Traditional and Simplified Chinese.
- It cannot filter by spice, because the menu data has no spice information, and says so.
- Dish matching uses the dish name only. There is no cuisine field in the data.
- A very mangled word that is far from every known word is not understood, and gets the plain fallback above.
