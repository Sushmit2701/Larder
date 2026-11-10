# Larder

A grocery app for personal recipes, suggestions and diet tracking. It runs in your browser, works offline, and needs no account.

It has four parts: Pantry, Shopping list, Recipes (with suggestions from your pantry and weekend prep notes), and Today (daily calorie and protein targets).

## Run it

Open `index.html` in Safari or Chrome on your Mac. You can double-click it in Finder, or run:

```bash
open index.html
```

No install or build step. No internet connection is needed.

## Where your data is stored

Everything is saved in your browser's `localStorage` under the key `larder.v1`, on this Mac only.

- Each browser keeps its own copy, so Safari and Chrome will each have separate data.
- Clearing your browser's website data for this file will delete it.
- Nothing is sent anywhere.

The first time you open the app it loads **example data**, dated from today so you can see the expiry warnings. Use **Clear and start fresh** in the green banner to remove it. Clearing removes everything, so do it before you add your own items.

## What it does

**Pantry**
- Add items with name, quantity, unit, category and a use-by date. Quick buttons set the date for you (+3 days, +1 week and so on).
- Items are sorted with the soonest date first. Anything due within 7 days, or already past its date, is marked and listed under **Use soon** at the top.
- Tap the circle to mark an item as used up. It moves to the **Used up** history, and you can put it back from there.
- Tap an item to edit or delete it.

**Shopping list**
- Type an item into the box, for example `Milk 2 L weekly`, or use **Paste a list** to add your whole weekly list at once (one item per line).
- The app reads the quantity, unit and how often you buy it (weekly, every 2 weeks, every 2–3 weeks) and guesses a category.
- Items you already have at home are marked with what's in the pantry, so you don't buy twice.
- Tap the circle when you've bought something. It moves into the pantry, and the message lets you set its use-by date.
- Bought items wait under **Bought**. If you set how often you buy them, they come back onto the list on their own when they're due. You can also tap **Add back**.

**Recipes**
- Add your own recipes with a title, servings, prep and cook time, ingredients, method steps and per-serving macros (calories, protein, carbs, fat). Macros are entered by hand.
- Type ingredients one per line, such as `500 g chicken thighs`, `2 cloves garlic` or `½ tsp salt`. The app splits each line into quantity, unit and name. Fractions like `1/2` and `1 1/2` work too.
- Type the method one step per line. Numbers like `1.` or `Step 2:` at the start are removed, since the app numbers the steps for you.
- Each recipe can have a weekend prep note: what to chop, cook or portion ahead, and how long it keeps. It's plain text you can edit.
- Opening a recipe shows its times (prep, cook and total), macros per serving, ingredients, method and prep note.
- Search matches recipe titles and ingredients.

**Suggestions from your pantry**
- Each recipe shows how many of its ingredients you have and what's missing. Salt, pepper and water always count as available.
- Ingredients are matched to pantry items by name: plurals match ("Egg" and "Eggs"), and so does a shorter name inside a longer one ("Rice" matches "Basmati rice").
- With the **Best match** sort, recipes that use items due within 7 days come first, then the ones that need the least shopping. Items already past their date still count, but rank lower than ones due soon.
- Filter by total time, protein per serving, or calories per serving. **Fits what I have left today** uses your Today numbers.
- On a recipe, each ingredient is marked as at home (with its date if it's due soon) or missing. **Add missing to shopping list** adds the missing ones in one tap.

**Today**
- Set daily calorie and protein targets with **Targets**. The defaults are 2,000 kcal and 120 g of protein.
- Log a recipe (choose the number of servings) or a quick entry with calories and protein. You can also log a serving from any recipe page.
- The bars show what you've eaten against each target and how much is left.
- **Fits the … kcal you have left** lists recipes whose single serving fits in the calories left, highest protein first.
- Each day starts fresh. Past days stay in the saved data for a history view later.

## Code layout

| File | What it holds |
| --- | --- |
| `index.html` | The page shell |
| `css/styles.css` | All styling, including light and dark themes |
| `js/logic.js` | All app logic as plain functions (dates, expiry, list parsing, state changes). It never touches the page, so it can be reused when the app moves to iPhone. |
| `js/storage.js` | Load and save. Replace this file to move to IndexedDB or native storage later. |
| `js/seed.js` | Example data for the first run |
| `js/app.js` | Drawing the screens and handling taps |

The scripts are plain `<script>` files, not ES modules, so the app works when opened straight from disk.
