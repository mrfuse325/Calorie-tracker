# Open the tracker on your phone without Terminal

The app needs a hosted HTTPS URL. This repository is prepared for Cloudflare Workers on the free plan, using a free `workers.dev` subdomain. Cloudflare serves the static app and USDA proxy together. A SQLite-backed Durable Object coordinates the upstream quotas across hosted requests and preserves counters after restarts; only public food lookup and quota counters reach the server. The diary and personal calculator inputs remain in IndexedDB on each device.

## Browser-only setup

1. Create or sign in to a [Cloudflare account](https://dash.cloudflare.com/) on the free plan.
2. In Workers & Pages, create a Worker from a Git repository and connect `mrfuse325/Calorie-tracker` through Cloudflare's GitHub integration.
3. Choose the branch containing these files (currently `feature-weight-loss-servings-phone`; use `main` after the implementation PRs are merged). Use the repository root directory and Worker name `calorie-tracker`, matching `wrangler.jsonc`.
4. Set build command to `npm run build` and deploy command to `npx wrangler deploy`. Use Node 22 or newer. Cloudflare's own build runner executes these commands; you do not run Terminal on your phone.
5. Deploy. Cloudflare reads the Worker entry point, static assets, and SQLite Durable Object migration from `wrangler.jsonc` and provides a real HTTPS URL. Open that returned URL on your phone. No custom domain is needed.
6. For regular food searches, obtain a free USDA key and add `USDA_API_KEY` as a Worker runtime **secret** in Settings → Variables and Secrets. Redeploy after setting it. Do not put it in a public frontend variable or GitHub file. Initial testing can use the built-in limited demo key.

These steps follow [Cloudflare Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/) and [build/deploy configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/). Keep the account on the free plan; [SQLite Durable Objects are available within its free allowances](https://developers.cloudflare.com/durable-objects/platform/pricing/). If a free allowance is exhausted, lookup should fail gracefully; the app does not switch to paid infrastructure. Review the deployment logs if a build fails. The local development server is not the hosted server.

## Use it like an app

- iPhone: open the hosted URL in Safari, use Share → Add to Home Screen.
- Android: open it in Chrome and choose Add to Home Screen from the browser menu.

The manifest launches it as a standalone page where supported. The Mac can be off once the app is hosted. Internet is required to initially load the app and search USDA; offline app-shell caching is not implemented.

Each hostname/device/browser has a separate diary. Mac localhost entries do not automatically appear on the hosted URL or your phone. Export/import and account sync remain future features; do not clear browser data if you want to retain entries.

## Deployment status

Hosting code and instructions are prepared. The Cloudflare Worker bundle dry-run and browser journey passed in [GitHub CI](https://github.com/mrfuse325/Calorie-tracker/actions/runs/37869488361). No Cloudflare account is connected in this session, so there is no live phone URL yet. Repository publishing and CI verification do not deploy this app.
