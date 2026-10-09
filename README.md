# Calorie tracker

A mobile-friendly, local-first calorie and macro tracker built around free nutrition APIs. Target operating cost: $0/month for personal use within provider quotas.

## Base release

- Manual food logging, quantity preview, edit/delete, and persistent daily totals.
- USDA food search through a server-side proxy.
- Saved custom foods, recent foods, and quick repeat.
- Editable calorie and macro targets and daily history.
- Versioned JSON backup and restore.
- Accessible mobile and desktop forms, explicit incomplete totals, and recoverable save failures.

Cloud sync, barcode lookup, recipes, charts, and AI features follow in separate releases.

## Current implementation

The first local slice is implemented with dependency-free JavaScript, plain CSS, and IndexedDB. This environment cannot download frontend packages, so React/TypeScript/Vite remain a planned migration. Calculation and storage modules are separate from the UI. No API key, account, external service, or paid dependency is needed to run this milestone.

Implemented: manual logging by meal and date; quantity-scaled calories and macros; incomplete-total indicators; manual targets and a personal goal calculator; USDA food search with automatic lookup while typing; edit/delete with undo; browser persistence; responsive forms. Entries preserve their original nutrition basis when quantities change. Targets apply to every viewed day until goal history is added.

Not implemented yet: saved custom foods, recent/repeat foods, JSON backup/restore, or cloud sync. Use the same browser and origin to access your diary. Browser data clearing removes entries. Local dates follow the device timezone; configurable timezone preferences are deferred.

## Run locally

Requires Node.js 22 or newer. There are no packages to install.

```sh
npm run dev
```

Open http://127.0.0.1:5173 in your browser. This server listens only on your computer. Keep the hostname consistent because browser storage is scoped to the origin.

Restart the server after updating code or changing `.env`, then refresh the page.

## Goal calculator

Choose **Calculate targets**, enter age, the equation's sex coefficient, height, weight, and typical activity, and select a macro split. Both metric and US units are supported. Calculate first, then explicitly choose **Use these daily targets**. Inputs and targets are saved together locally; personal measurements are not sent to an API. Targets can still be edited manually.

This initial calculator estimates maintenance calories for generally healthy adults ages 19–80 using [Mifflin–St Jeor](https://pubmed.ncbi.nlm.nih.gov/2305711/), multiplied by approximate activity factors from 1.2 to 1.9. The starting 20% protein / 50% carbs / 30% fat split is an app default, not a uniquely personalized prescription. Users can change it within adult [dietary reference ranges](https://www.ncbi.nlm.nih.gov/books/NBK208874/): protein 10–35%, carbs 45–65%, fat 20–35%, totaling 100%. The result also shows calorie-based ranges and the 0.8 g/kg adult protein reference. It does not reproduce every Calculator.net mode, prescribe a weight-loss deficit, or cover pregnancy, breastfeeding, children, or medical nutrition needs.

## Free food lookup

In **Add food**, type at least two characters; after an 800 ms pause the app searches USDA. You can also press **Search foods** or Enter in the food-name field. Select the closest match, checking raw/cooked preparation, enter grams eaten, review the scaled preview, and save. This uses a representative USDA food record, rather than averaging incompatible foods or brands. Nutrition and source are snapshotted into the entry. Changing the selected food name clears its old nutrient values; manually overriding nutrients changes the source to manual. USDA selections use grams; choose manual entry for known volume/serving nutrition.

The Node server proxies USDA; keys never reach the browser. With no configuration, it uses USDA's limited `DEMO_KEY` for initial testing. For regular use, obtain a **free** [USDA API key](https://fdc.nal.usda.gov/api-guide/) and place it in an ignored `.env` file:

```sh
cp .env.example .env
```

Set `USDA_API_KEY` in `.env`, then restart `npm run dev`. Do not commit or share the populated file. No paid API or AI service is used.

The local proxy searches generic Foundation, SR Legacy, and FNDDS records (up to 20 results); brand/barcode lookup is deferred. It preserves missing nutrients and uses nutrient IDs/units rather than array positions. Identical in-flight searches are deduplicated. Public search results are cached in memory for 24 hours, capped at 100 queries. Cache and counters reset on server restart.

USDA documents demo limits of 30 requests/hour and 50/day per IP, and a default full-key limit of 1,000/hour/IP. This app caps demo calls at 25/hour and 40/day; personal-key calls at 800/hour and 5,000/day. A USDA 429 blocks new upstream calls for an hour, and requests time out after eight seconds without automatic retries. Other programs sharing the IP/key can exhaust quotas earlier. On failure, lookup explains the issue and manual logging remains available. These controls are for a single local server; hosted/multi-instance deployment still requires shared quota handling. Search requires internet access; the calculator and manual diary do not call external APIs.

## Verification

```sh
npm run check
npm test
```

With the local server running, `npm run test:browser` exercises diary CRUD/persistence, calculator targets and input restoration, mocked USDA lookup, source snapshots, stale-search rejection, lookup failure, and mobile overflow using a disposable Chrome profile. The default executable is macOS Google Chrome; set `CHROME_PATH` on other systems. CI runs syntax, logic, and Chrome smoke checks. The browser script mocks USDA to avoid requiring a key or spending quotas. All 22 logic/provider tests and the full browser smoke passed in [GitHub CI](https://github.com/mrfuse325/Calorie-tracker/actions/runs/37866041078). Live USDA access remains unverified here; local execution is blocked by this sandbox's networking restrictions.

Manual QA: log cooked rice with 130 kcal and 2.7 g protein per 100 g, leave carbs blank, and enter 150 g. Expect 195 kcal, 4.1 g displayed protein, and an incomplete carbs total. Edit to 200 g, refresh, set a target, delete, and undo. Check keyboard focus and narrow-screen forms. To check a failed save, disable storage in browser settings and verify that the form stays available and no success appears.

## Planned stack

React, TypeScript, Vite, plain CSS, IndexedDB, and Cloudflare Workers for hosting and nutrition proxying. Supabase is deferred until cloud sync.

## Build sequence

1. Complete the local manual-entry journey, including persistence and edit/delete.
2. Add reusable custom foods, recent/repeat logging, history, and backup/restore.
3. Add USDA search, normalization, caching, quota handling, and manual fallback.
4. Verify the base release and deploy within free allowances.

See [the build plan](docs/build-plan.md) for the detailed contract and acceptance checks. The agreed base-release amendment at the top supersedes the original release ordering.

## Status

The local tracker, personal goal calculator, and USDA lookup are implemented. Automated logic, syntax, and browser smoke checks pass. Live-provider verification and manual accessibility review remain required before release.
