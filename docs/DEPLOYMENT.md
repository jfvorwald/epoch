# Cloudflare deployment

EPOCH is configured for **https://epoch.jaqstudios.com** in the domain owner’s Cloudflare account. Hosting uses **Workers Static Assets**, serving the Vite output directly without an application server, database, or paid Workers runtime.

Cloudflare recommends Workers for new projects. Static asset delivery is free and unlimited under its current static-hosting terms; custom domains receive managed DNS and TLS certificates. [Product guidance](https://developers.cloudflare.com/pages/get-started/), [static asset billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/), [custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).

## Published deployment

- Current gameplay release, **11 September 2026**: source commit `3c8d642`, Cloudflare version `a212189c-1ed7-47f1-88f9-d71d4af39cb1`. Includes the ship hangar and Manta unlock, sector multishot and weapons, denser waves and distinct guardians, three-hit hulls, and visible destruction before defeat.
- All **40 public production files** matched the local build after this release. Chrome and iPhone-profile WebKit passed live hangar, locked-Manta, three-hull, seven-wave first sector, launch, pause/resume, and service-worker checks with no runtime or HTTP errors. Production ignores `?playtest=1` and exposes no development controls.
- Published on **11 September 2026** to **https://epoch.jaqstudios.com/**.
- Application: `jaq-epoch`; initial version: `9787b439-b97c-4c85-bb27-78d93fdaa665`.
- Workers plan confirmed in the account dashboard: **Free ($0)**. No paid upgrade, backend binding, or DigitalOcean resource was created.
- Cloudflare also assigned `https://jaq-epoch.epoch-browser.workers.dev`. Use the custom domain as the player-facing address so saves remain on one origin.
- All 35 public production files matched the local build after upload. HTTPS certificate validation, content types, cache headers, and exclusion of `/_headers` were checked. Initial DNS negative caching on the development Mac delayed normal hostname access; the first file audit used the authoritative address with normal TLS hostname validation.

Browser and physical-device coverage is recorded in [VALIDATION.md](VALIDATION.md).

## First authorization

```sh
pnpm install --frozen-lockfile
pnpm exec wrangler login --scopes account:read user:read workers_scripts:write workers_routes:write zone:read
```

Approve the official Cloudflare authorization page using the account that owns `jaqstudios.com`. Wrangler stores the resulting authorization locally outside the repository. Do not paste tokens into source or commit local authentication files.

## Publish or update

```sh
pnpm deploy:check
pnpm deploy
```

`deploy:check` compiles the complete production game and validates Cloudflare packaging without uploading. `deploy` rebuilds and publishes it. `wrangler.jsonc` defines the `jaq-epoch` application, the `dist/` asset directory, and the custom domain. Only `epoch.jaqstudios.com` is attached; the apex domain, `www`, and mail records are not changed by this configuration.

These commands use the existing local checkout, so review its changes before deploying. The source repository is `jfvorwald/epoch`; automatic deployment on Git pushes is not configured. A future Cloudflare Git integration can run `pnpm build` and then `pnpm exec wrangler deploy` using this same configuration.

## Caching and iPhone installation

`public/_headers` asks browsers to revalidate the document and service worker while caching Vite’s content-hashed assets immutably. Unhashed art and fonts use Cloudflare’s normal revalidation behavior.

The offline cache excludes `_headers` and `_redirects` because Cloudflare consumes those control files instead of serving them. Every build gets a new service-worker revision. It activates once its complete offline cache is ready, even if old game tabs remain open. Existing flights keep their loaded document; refresh to load the updated game. Subsequent updates show a brief refresh notice.

Page navigations request the latest online HTML and fall back to the complete precached shell if the server is unavailable. Static assets use the current revision's cache, and activation removes obsolete game caches. Saves and settings in local storage are retained. `node scripts/verify-update.mjs` checks legacy-worker migration in Chrome and WebKit; `node scripts/verify-production.mjs` checks offline launch with the origin stopped.

After HTTPS is live, open the game in iPhone Safari, finish its first online load, and use **Share → Add to Home Screen**. Saves belong to this HTTPS origin, so development saves at localhost or a Wi-Fi address do not automatically transfer.

## Verification and rollback

After deployment, check the custom domain’s HTTPS response, title, asset loading, `/sw.js` cache policy, and manifest. Verify service-worker activation and offline reload in a browser. A newly registered domain or new TLS certificate may need time to become active.

For a rollback, open **Cloudflare → Workers & Pages → jaq-epoch → Deployments**, select the previous known-good deployment, and roll back. Refresh the game to load it. When rolling back to a release predating the cache-update fix, close all game tabs and reopen if its worker is waiting to activate.

DigitalOcean remains suitable for future server-backed services. This static game does not require adding or modifying any DigitalOcean resources.
