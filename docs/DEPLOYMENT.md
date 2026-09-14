# EPOCH deployment

## Current production release

[epoch.jaqstudios.com](https://epoch.jaqstudios.com/) runs the **Beyond the Signal** release, promoted with owner authorization on **14 September 2026 at 15:15 UTC**. Release: **`77f326db3cf3372c`**. Build: **`1.0.0 / 94e88c74bcb0`**. Production Cloudflare version: **`dd803c20-ff52-4db2-9d52-49e970c9d96f`**. Read the [formal patch notes](PATCH_NOTES.md).

Promotion used the exact reviewed staging artifact, without rebuilding. All 41 public production files matched it byte-for-byte. Normal Chrome verified the updated menu, 50-level Signal Map and default-off Training Wheels after one ordinary reload. Chrome and iPhone-profile WebKit passed offline launch with the origin stopped, 41 cached assets, no runtime errors and network-only private APIs. Detailed validation is in [VALIDATION.md](VALIDATION.md).

Production and its public provider fallback return 404 for beta session, feedback, notification and Markdown endpoints. Production has no beta database, email binding or cron. Private staging still requires Cloudflare Access. Operator-only artifacts, receipts and evidence remain under the ignored `.releases/<release-id>/` directory.

## Environments

| Environment | Address | Worker |
| --- | --- | --- |
| Private staging | https://epoch-staging.jaqstudios.com | `jaq-epoch-staging` |
| Production | https://epoch.jaqstudios.com | `jaq-epoch` |

Staging is the default release target. Ordinary update requests authorize private staging; production promotion requires explicit owner authorization of the reviewed release. Protect every staging path with Access and keep its provider fallback and preview URLs disabled. Staging and production must use separate data, identity and email configuration.

## Local setup and private settings

Install the lockfile dependencies with `pnpm install --frozen-lockfile`. Use the project's installed Wrangler through the release scripts. Authenticate through the official Cloudflare login flow with only the existing account, user, Workers-script, Workers-route and zone permissions needed to deploy. Credentials stay outside source control.

Copy [cloudflare/staging.example.json](../cloudflare/staging.example.json) to `.private/staging.json` and replace placeholders with the approved operator values. This ignored file contains exact beta identities and Access, D1 and restricted email settings. Keep its file permissions private. The release helper accepts a narrow staging-only override, checks completeness and isolation, and derives email recipient/sender pins from the restricted binding. It rejects attempts to override production, routes, Worker names or enable flags.

A public checkout can build and test without private settings. Preparing an enabled-beta staging deployment requires valid private settings. Use the release helper: a direct `wrangler deploy` cannot merge the private file. Do not use a direct deployment to bypass validation. See [BETA.md](BETA.md) for access maintenance, owner notifications and migration safeguards.

## Stage, review and promote

```sh
pnpm deploy:check
pnpm deploy
```

Both commands run tests and a production-mode build. Staging freezes public assets, the Worker, resolved configuration and migrations in `.releases/<release-id>/`. A successful upload records its receipt. A dry run does not count as a staged release. Never commit `.private/`, `.releases/`, authentication files, private feedback or invitation records.

Review the staging URL using the approved sign-in. Its visible STAGING label includes the version and build. Review menus, gameplay and saved progress as appropriate to the change. An existing tab may show its old game until an ordinary reload; never clear player storage to load a release.

After explicit approval of that release:

```sh
pnpm deploy:production:check <release-id>
pnpm deploy:production <release-id>
```

Promotion verifies the successful staging receipt, artifact digests and Wrangler version, then publishes the frozen artifact through its production environment. It does not rebuild the checkout or merge a newer private configuration. Public game assets are identical; the hostname controls the staging indicator and beta interface. Git pushes do not automatically deploy this app.

The source repository is public. Keep operational contact records in ignored private storage and review every commit before an upstream push. Removing private data from a later commit does not remove it from earlier history; unpublished commits containing those records must not become ancestors of a public push. Retain any recovery copies locally.

## Saved progress, caching and verification

The service worker precaches a complete release before activation. Existing flights keep running until the player reloads. Navigations fetch current online HTML and fall back to the completed offline cache; static assets use the active release cache. Private API and Access routes always go to the network. The document and service worker revalidate, while hashed assets are immutable. Saves remain in the existing browser-origin local storage.

After promotion, verify the custom domain and provider fallback, asset hashes, build metadata, service-worker cache headers, disabled private endpoints, staging protection and a normal browser load. `node scripts/verify-production.mjs` checks offline launch in isolated Chrome/WebKit contexts. `node scripts/verify-update.mjs` checks migration from an old cache-first release while preserving saved progress. These simulations do not replace physical-device or human difficulty testing.

On iPhone, finish an online load in Safari, then use **Share → Add to Home Screen**. Staging and production saves are separate because they use different origins. A Google identity used for beta access does not synchronize game saves.

## Rollback and recovery

Use the previous verified deployment in Cloudflare's `jaq-epoch` deployment history or promote another explicitly approved retained artifact. The production version preceding this campaign release is `50143e98-1e40-4959-abeb-31c374c1ac2e`; its loader only accepts the original five levels. Review save compatibility before restoring it. Prefer a corrected release retaining current campaign and save rules.

Never clear player storage or recreate staging D1 as a rollback step. Keep reports and sent email receipts. Preserve the current private roster when preparing a replacement staging release; older frozen artifacts may contain older access lists.

A DNS or TLS navigation error is distinct from an old cached game. Check normal name resolution and hosting without disabling Access or browser protections. For an old menu, finish or pause the current flight, reload online, allow the new cache to complete, then reload once more if prompted. Keep saved progress intact.
