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

Implemented: manual logging by meal and date; quantity-scaled calories and macros; incomplete-total indicators; manual targets; edit/delete with undo; browser persistence; responsive forms. Entries preserve their original nutrition basis when quantities change. Targets apply to every viewed day until goal history is added.

Not implemented yet: USDA search, saved custom foods, recent/repeat foods, JSON backup/restore, or cloud sync. Use the same browser and origin to access your diary. Browser data clearing removes entries. Local dates follow the device timezone; configurable timezone preferences are deferred.

## Run locally

Requires Node.js 22 or newer. There are no packages to install.

```sh
npm run dev
```

Open http://127.0.0.1:5173 in your browser. This server listens only on your computer. Keep the hostname consistent because browser storage is scoped to the origin.

## Verification

```sh
npm run check
npm test
```

With the local server running, `npm run test:browser` exercises add, edit, scaling, missing nutrients, targets, refresh, delete, undo, and mobile overflow using a disposable Chrome profile. The default executable is macOS Google Chrome; set `CHROME_PATH` on other systems. CI runs syntax and logic checks. Browser smoke execution is currently unverified here because the environment rejects local server listening with EPERM.

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

Milestone 1 implementation is ready for review. Automated logic and syntax checks pass; browser verification remains required.
