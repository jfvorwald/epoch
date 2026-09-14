# EPOCH private beta

The private beta runs at [EPOCH staging](https://epoch-staging.jaqstudios.com/) through the [JAQ Studios App Launcher](https://jaqstudios.cloudflareaccess.com). Access uses an approved Google identity. The public game does not include beta feedback or Google-backed game saves.

## Private configuration

Tester addresses, owner contact details, Access identifiers, database bindings and email restrictions belong in the ignored `.private/staging.json` file. Use [the example](../cloudflare/staging.example.json) as a template and obtain deployment-specific values from the operator. Never commit a completed private configuration, invitation records, feedback exports or credentials.

The release helper resolves this file into a frozen deployment artifact under the ignored `.releases/` directory. It never includes the file in public game assets. Production promotion uses the already reviewed artifact and its isolated production environment; it does not read a current private override.

## Maintain access

After the owner approves an exact Gmail address:

1. Add the address to the existing EPOCH beta Cloudflare Access policy, keeping that policy attached only to EPOCH and the launcher. Preserve the separate owner-only JAQ Studios staging policy. Do not allow an entire email domain.
2. Add the same address to `vars.BETA_TESTERS` in `.private/staging.json`, preserving the owner and existing testers. Keep the roster as a comma-separated list of exact addresses.
3. Run the staging release workflow and verify the deployed Worker roster matches Access. Editing a roster does not send an invitation; send a welcome only with owner authorization and verify the exact recipient.
4. To remove access, remove the address from both places and redeploy. Keep existing reports and email delivery receipts.

Google sign-in uses only the existing basic identity scopes: `openid`, `email` and `profile`. The launcher does not grant access to every application it lists. Access protects network requests; it cannot remove game files previously cached on an authorized device.

## Feedback and owner notifications

Select **Beta feedback**, choose **Bug** or **Idea**, enter a title and details, then select **Send feedback**. Reports include the build, current level/wave when available, selected ship, signed-in email and browser details. Opening feedback pauses an active flight; closing it leaves the flight paused.

Reports persist in the staging D1 database. Testers see only their own submissions. The owner can review the full inbox and roster, mark reports New/Planned/Fixed, and read a plain-text Markdown view. Private API responses are never cached. An unsent draft lasts only for the current tab; sign in again and retry if the online session expires.

When configured, new reports queue notifications to the single approved owner destination. The email binding restricts destination and sender; release preparation derives Worker recipient/sender pins from those restrictions. The subject identifies a new bug or idea, and the plain-text body contains the report and context. User text cannot set email headers or recipients.

A database trigger writes the report and its outbox entry together. Background processing and a five-minute cron retain and retry unsent mail with bounded batches and leases. Provider acceptance does not prove inbox placement. A failure between provider acceptance and saving its receipt can cause a duplicate notification; the report ID identifies the original submission. Do not publish real report bodies or delivery logs.

## Deploy and preserve data

Use `pnpm deploy:check` and `pnpm deploy`, following [DEPLOYMENT.md](DEPLOYMENT.md). Direct Wrangler deployment does not merge the private override. Missing or invalid private settings fail before publishing an enabled beta. Production explicitly disables feedback and email and has no beta database, email binding or cron.

The migration files are [0001_beta_feedback.sql](../cloudflare/migrations/0001_beta_feedback.sql) and [0002_beta_feedback_email.sql](../cloudflare/migrations/0002_beta_feedback_email.sql). Apply migrations deliberately to the existing staging database through authorized tooling; deploying a Worker does not apply them automatically. Preserve all reports and sent outbox receipts. Do not enable remote email delivery for local development.

To pause owner email without losing reports, set the tracked staging `BETA_EMAIL_ENABLED` flag to `false` and prepare a new staging release. Restoring it resumes queued work. Changing a recipient requires owner authorization, matching private configuration and a verified provider destination.

Operational roster and invitation records are retained privately by the operator. Never recreate the database, clear reports or delete delivery receipts as a routine deployment or rollback step.
