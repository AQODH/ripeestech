# Release gates and operations

## Owner authentication

The Worker restricts private routes to the exact configured owner hostname and accepts either an allowlisted, database-backed administrator session or a verified Cloudflare Access identity. Access assertions are checked for issuer, application audience, expiry, application token type and owner email. Private responses use private, no-store. The loopback simulator is a separate development entry point.

Configure one Access application and an explicit allow policy for the owner. Verify the application audience and token on the intended hostname. Access protection for a workers.dev Worker covers the Worker URL, including its public routes. Keep it disabled for the public staging workers.dev site; the admin workspace is instead protected by its database-backed password session. For production, configure Access on the intended owner hostname and protect the private path families under the same audience. Keep public site, enquiry and knowledge-chat routes available. Test denied alternate origins, anonymous access, another identity, forged and expired assertions, sign-out and valid owner access.

## Isolated staging

Use an independent Worker and D1 database, synthetic records, separate account configuration and the non-production hostname. Staging has no production credentials or data. The production profile disables workers.dev and version preview URLs. Both profiles keep AI disabled.

After authorization, provision the staging Worker and D1 database. For the public workers.dev staging site, do not enable Workers.dev Access protection or create a Zero Trust application for that hostname. The Worker still requires an administrator password session for private routes. Set RIPEES_PROD_DATABASE_ID as well if a production database already exists so the generator can reject reuse.

- RIPEES_STAGE_DATABASE_ID
- RIPEES_STAGE_HOST, in the form ripees-staging.<account-subdomain>.workers.dev
- RIPEES_STAGE_ADMIN_EMAIL

The staging config generator accepts optional Access settings only as a pair: RIPEES_STAGE_ACCESS_ISSUER and RIPEES_STAGE_ACCESS_AUDIENCE. Do not set either for public workers.dev staging, and do not use placeholder values. The production config continues to require both.

From the checkout root on Node 24:

```powershell
npm ci --include=dev --include=optional
npm run build
node tests/worker-built-local.mjs
node scripts/prepare-worker-config.mjs staging
node node_modules/wrangler/bin/wrangler.js deploy --dry-run --config dist/server/wrangler.staging.json
```

The preparation script writes config locally. Use the generated profile with the correct account and resource IDs. The default generated Wrangler file contains a local-only database ID.

The following commands require staging authorization and verified isolation:

```powershell
node node_modules/wrangler/bin/wrangler.js d1 migrations list ripees-staging --remote --config dist/server/wrangler.staging.json
node node_modules/wrangler/bin/wrangler.js d1 migrations apply ripees-staging --remote --config dist/server/wrangler.staging.json
node node_modules/wrangler/bin/wrangler.js deploy --config dist/server/wrangler.staging.json
```

Verify the daily 02:17 UTC retention cron, database-backed /api/health, public pages and legal/favicon assets, owner access, all CRM writes, backup recovery, knowledge chat and D1 resource metrics. Local workerd tests use synthetic signed assertions and do not establish hosted gateway or quota behavior.

## Data and recovery

Migrations 0000 through 0004 remain unchanged. Migration 0004 updates saved contact fields if the website row exists. For a fresh database, apply the schema before loading data. Before applying pending migrations to an existing database, record a recovery bookmark, make an encrypted consistent export, rehearse restoration and review the expected contact changes. Saved values can override defaults. Preserve existing contact choices unless the principal approves the update.

The app's logical JSON and CSV exports are capped at 4,000 matching enquiries. Filter CSV exports for larger datasets. Application imports are bounded to 1.5 MB including the request envelope. Use authorized D1 backups for complete or larger datasets, migration history and all tables. Logical exports read across pages, so use a D1-level snapshot for consistent recovery. Retain a previous Worker version and its matching database configuration. Preserve recent accepted writes before any database rollback.

## Production approval

Complete the hosted staging matrix, verify Zoho delivery and the authoritative zone, and obtain principal approval before production work. The production profile takes the corresponding RIPEES_PROD_ variables and uses ripees.com as the canonical owner hostname. Prepare it separately with node scripts/prepare-worker-config.mjs production. Verify environment IDs are distinct. Cloudflare routing, DNS delegation and production migration are separate approved actions.

Monitor health status, Worker errors, CPU, D1 quotas, cron and inbox follow-up. The pilot uses knowledge chat. A separate RIPEES_ENABLE_AI=true setting, model, secret, spending controls and live answer evaluation are required to enable the paid provider. Assign an inbox owner for daily checks.

## Policy content

The supplied October 30 policy includes the confirmed Kampala location and company contacts. The November 3 operational note describes chatbot processing and retention.
