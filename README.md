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

## Planned stack

React, TypeScript, Vite, plain CSS, IndexedDB, and Cloudflare Workers for hosting and nutrition proxying. Supabase is deferred until cloud sync.

## Build sequence

1. Complete the local manual-entry journey, including persistence and edit/delete.
2. Add reusable custom foods, recent/repeat logging, history, and backup/restore.
3. Add USDA search, normalization, caching, quota handling, and manual fallback.
4. Verify the base release and deploy within free allowances.

See [the build plan](docs/build-plan.md) for the detailed contract and acceptance checks. The agreed base-release amendment at the top supersedes the original release ordering.

## Status

Repository and plan initialized. Application implementation has not started.
