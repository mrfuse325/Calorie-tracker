# Calorie tracker: build plan

## Agreed base-release amendment

This amendment supersedes conflicting release assignments and milestone ordering below.

The base release includes manual logging, USDA search, saved custom foods, recent/repeat foods, editable targets, daily history, and versioned JSON backup/restore. Store data locally; defer accounts and cloud sync, barcode lookup, recipes, charts, and CSV export.

Additional requirements:

- Provide a save-as-custom-food action and a searchable list of saved custom foods.
- Distinguish nutrition for the entire manual entry from nutrition per 100 g or per serving. Label the basis before scaling.
- Show recorded daily nutrient totals with the count of entries missing each nutrient; do not present partial totals as complete. Apply the same rule to calories and remaining-target displays.
- Save each entry's basis quantity/unit, nutrients at that basis, and any portion conversion as well as its scaled nutrient snapshot, so later quantity edits remain accurate.
- Preserve form values on failed saves, provide retry, and report success only after persistence succeeds.
- Include labeled controls, keyboard navigation, visible focus, readable contrast, mobile touch targets, and errors that do not rely on color.
- Version IndexedDB schemas and JSON backups. Validate imports before writing, preview their impact, preserve stable UUIDs, and specify duplicate/conflict behavior without silent overwrites. Verify backup/restore round trips and schema upgrades.
- Specify the proxy cache and quota mechanism before deployment, including its free allowances. Track upstream usage, stop external searches when quotas are exhausted, and keep the local diary functional. Do not enable paid infrastructure to bypass limits.
- Before adding cloud sync, document which storage is authoritative, offline behavior, account ownership of imports, and conflict handling.

Base completion checks: add/edit/delete entries and refresh successfully; reuse a custom food and repeat an entry; browse prior days; export and restore a diary; preserve incomplete nutrient information; recover from storage and API failures; verify quantity changes against saved nutrition bases; pass keyboard/mobile checks; and deploy with documented free-tier limits.

Prepared October 8, 2026. Proposed architecture; no app repository has been identified or changed yet.

## Goal and first release

Build a mobile-friendly web app that lets you record food, track calories and protein/carbohydrates/fat, and review your daily totals. The first release should be useful without any paid AI service. Target operating cost: $0/month for a small personal prototype within provider quotas, using a free hosting subdomain.

Assumptions: personal use first, desktop and phone browsers, manual targets, and no automatic medical or weight-loss recommendations. Start with a web app before considering native mobile apps.

Success example: open the app, select lunch, find cooked rice, enter 150 grams, preview nutrients, and save. The daily totals update and the entry remains after refresh. Repeat meals should take only a few taps.

## Scope

| First release | Next release | Later, optional |
| --- | --- | --- |
| Manual food entry | Typed barcode lookup, then camera scanning | Photo-based meal estimates |
| Calories and macros by meal/day | Recipes and saved meals | Natural-language logging |
| Editable daily targets | Favorites and repeat yesterday | Campus-menu integration |
| Edit/delete entries | Seven-day charts | Weight or activity integrations |
| Local persistence | Sign-in and cross-device sync | Native mobile app |
| USDA food search | CSV export | Paid nutrition services |

Build the smallest working tracker first, then add external search. Keep quick manual entry available throughout. Do not make AI, an API key, or sign-in mandatory for the first local version.

## Suggested stack

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | React + TypeScript + Vite | Clear component structure and a simple static build |
| Styling | Plain CSS with shared tokens | Keep dependencies and styling overhead small |
| Local data | IndexedDB through a small adapter | Persist meals before cloud setup; supports structured records |
| Database and auth | Supabase Postgres + Auth, Free plan | Add cloud sync without building an auth system |
| API proxy | Cloudflare Worker in TypeScript | Keep nutrition keys server-side and handle quotas centrally |
| Hosting | Cloudflare Workers static assets | Serve frontend and proxy from one origin |
| Tests | Vitest for logic; Playwright for core journeys | Check calculations and actual logging behavior |

These are proposed choices, not a requirement to replace an existing stack. Once the real repository is available, inspect it and preserve reasonable existing choices.

Initially implement a local repository interface. Later add a Supabase implementation behind the same interface; keep calculation and provider logic independent of storage.

## Free APIs and infrastructure

Prices and limits were checked against official documentation on the preparation date; verify again when deploying.

| Service | Use | Current free allowance or access | Important limit |
| --- | --- | --- | --- |
| USDA FoodData Central | Search common foods, ingredients, and branded products | Public API with a data.gov API key; public-domain data | Default 1,000 requests/hour/IP |
| Open Food Facts | Packaged-food lookup by barcode | Open-data read API | Currently 15 product reads/minute/IP and 10 searches/minute/IP |
| Supabase Free | Account data and cloud sync | 500 MB database; 50,000 monthly active users; 5 GB egress | Two active projects; pause after one week of inactivity |
| Cloudflare Workers Free | Nutrition proxy | 100,000 Worker requests/day | 10 ms CPU time/invocation |
| Cloudflare static assets | Frontend hosting | Free, unlimited static-asset requests | Dynamic requests use the Worker quota |

USDA requires a private key in the proxy. Its DEMO_KEY has much smaller quotas and is only for initial exploration. Source: [USDA API guide](https://fdc.nal.usda.gov/api-guide/).

Open Food Facts recommends API v3 for new integrations. Include provider attribution and review its ODbL/database-content terms before redistributing a food catalog; product images have separate licensing. Keep source records distinguishable and avoid importing a combined public database in the MVP. Source: [API introduction](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/) and [licensing guide](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/license-be-on-the-legal-side/).

Infrastructure sources: [Supabase pricing](https://supabase.com/pricing), [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), and [static-asset billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/).

No OpenAI API is needed for this plan. Coding-assistant usage is a separate development expense.

## Screens and behavior

1. **Today:** date picker; calorie total and remaining amount; macro totals; breakfast/lunch/dinner/snack groups; prominent Add food button. If over target, show the amount over rather than a negative “remaining” number.
2. **Add food:** Search and Manual tabs. Search results show food name, brand if present, source, and a clearly labeled nutrition basis. Select a result, enter quantity, preview, and choose meal before saving.
3. **Entry editor:** change food name, meal, amount, date, or nutrients; delete with a short undo opportunity.
4. **Goals:** manually set calorie and macro targets; save preferences and timezone.
5. **History:** browse prior days. Add charts once stored data and calculations are stable.
6. **Account:** introduced with cloud sync. Sign in, export, and delete personal data.

Do not prefill personal calorie targets from an old conversation. Let the user choose targets. Treat unknown nutrients as “not available,” not zero.

## Architecture and API flow

Frontend → same-origin /api routes → nutrition providers.
Frontend → storage adapter → IndexedDB initially; Supabase after sign-in.

Proposed proxy routes:

- GET /api/foods/search?q=...&page=... — explicit USDA search, 20 results maximum.
- GET /api/foods/usda/:id — fetch details for the selected food.
- GET /api/foods/barcode/:code — Open Food Facts lookup in the next release.

Manual entry and diary writes do not call external nutrition APIs. Validate input at the proxy, allow only supported upstream endpoints, and never accept an arbitrary fetch URL.

Search on submit, not on every keystroke. Reuse recent results. Cache USDA searches for about 24 hours and individual food details for about seven days; these are initial app policies, adjustable later. Cache only public food data, never a private diary response.

Respect shared upstream IP quotas, not only per-user limits. Begin with conservative app quotas and timeout handling; use a shared rate limiter if multiple Worker instances can exhaust an upstream limit. On 429 or provider outage, stop retries, show an understandable message, and offer manual entry. Do not keep hammering the endpoint.

## Nutrition data contract

Normalize every provider response into:

- source: usda | open_food_facts | manual
- source_id, food_name, brand, fetched_at
- basis_quantity and basis_unit: usually 100 grams or 100 milliliters
- energy_kcal, protein_g, carbs_g, fat_g: number or null
- optional serving_label, serving_grams, and provider URL

Rules:

- Use matching nutrient identifiers and units, not array positions.
- Distinguish kilocalories from kilojoules; divide kJ by 4.184 when conversion is necessary.
- Do not assume milliliters equal grams. A volume-to-mass conversion needs a known density.
- Offer cups, pieces, or servings only when a reliable portion weight exists; otherwise use grams or the provider's stated volume basis.
- Keep raw versus cooked foods distinct in result labels.
- Missing calories do not silently become calories calculated from macros. If an estimate is offered later, label it.
- Preserve provider calories; label rounding and preparation methods can cause differences from 4/4/9 arithmetic.

Scaling: logged nutrient = nutrient at basis × entered quantity / basis quantity.

Example: 100 g contains 130 kcal and 2.7 g protein. At 150 g, log 195 kcal and 4.05 g protein. Store adequate numeric precision and round only for display.

Snapshot nutrients in the saved entry so a provider update does not change past meals.

## Data model

| Record | Fields |
| --- | --- |
| Profile | user_id, timezone, current calorie/macro targets, created_at |
| Diary entry | UUID, user_id when synced, local diary_date, meal, food_name, source/source_id, quantity/unit, nutrient snapshot, created_at, updated_at |
| Custom food | UUID, owner, name, basis quantity/unit, nutrient values |
| Favorite | owner, source/reference or custom-food ID |
| Recipe (later) | owner, name, yield, ingredient snapshots |

Use a local calendar date for diary grouping and UTC timestamps for changes. A goal-history table can preserve old targets once history charts are added.

For Supabase, enable row-level security on every private table and restrict reads/writes to the authenticated owner. Test with two accounts. Keep the service-role key out of the browser; the browser may use the publishable key with RLS.

Cloud sync starts with one-time import of selected local entries using stable UUIDs. Make imports idempotent. Show conflicts rather than silently overwriting newer cloud edits. Full offline synchronization is later work.

Use Google OAuth for the initial cloud prototype to avoid making transactional email delivery a launch dependency. Review the email-provider setup if adding email/password authentication.

## Repository and configuration

Once the repository is identified:

1. Inspect README, existing code, branch status, and any AGENTS.md instructions.
2. Confirm the remote and preserve existing work; create a development branch.
3. Add setup instructions, a dependency lockfile, .gitignore, .env.example, and documented scripts.
4. Keep .env files and credentials out of commits.
5. Add CI for lint, type checking, focused tests, and production build.
6. Document local development, API-key setup, migrations, and deployment.

Suggested folders: src/features/diary, src/features/foods, src/features/goals, src/lib/nutrition, src/lib/storage, worker/providers, supabase/migrations, tests.

Environment template:

- USDA_API_KEY — Worker secret only.
- VITE_SUPABASE_URL — needed when cloud sync is added.
- VITE_SUPABASE_PUBLISHABLE_KEY — public client key protected by RLS.
- APP_ORIGIN — allowed origin if separate development servers are used.

Only VITE-prefixed public values belong in the browser bundle. Use a Vite development proxy to the local Worker for /api.

## Build order and completion checks

| Milestone | Work | Complete when |
| --- | --- | --- |
| 1. Local tracker | Layout, manual entry, targets, persistence, edit/delete | A meal survives refresh; totals update correctly; mobile form works |
| 2. Free food search | USDA proxy, normalization, quantity preview, error states | A searched food logs correctly; missing nutrients and 429 responses are handled |
| 3. Cloud sync | Supabase schema, auth, RLS, local import | Two accounts cannot access each other's records; same account sees entries on two devices |
| 4. Convenience | Typed barcode lookup, favorites, repeat meals | Unknown barcodes fall back to manual entry; repeated meals retain their original nutrients |
| 5. Release polish | History, CSV export, responsive QA, CI, deployment | Checks pass, export matches diary, and fresh-user setup works |

Treat each milestone as a separate branch/PR. Start with milestones 1 and 2 before spending time on camera access or AI.

Meaningful tests: quantity scaling; kJ conversion; missing nutrients; cooked-food labels; date/timezone grouping; edit/delete totals; duplicate-save prevention; provider failures; and RLS isolation. One end-to-end journey should add, edit, refresh, and delete a meal.

## First development session

Implement a complete local vertical slice: dashboard → manual food form → save entry → daily totals → persistent storage → edit/delete. Use neutral sample data and no credentials. After that works, add the USDA adapter.

The next prerequisite is the actual repository URL, or an explicit decision to start a new repository. This plan does not claim that a calorie-tracker repository is already set up.
