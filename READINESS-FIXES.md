# Readiness fixes — 3 November 2026

Implemented in the local working folder and repository checkout:

- Added complete Terms of Service and Privacy Policy pages, footer/form links and one shared short privacy dialog. Standardized company spelling to RIPEES Technologies Limited, and filled Kampala, Uganda, info@ripees.com and +256 787 947343. Included a separate dated operational chatbot disclosure.
- Fixed privacy, identity, human escalation, support, location, greetings and prohibited-request intent handling. Protected answers bypass AI; typo-normalized commercial routing and bounded context preserve company constraints.
- Upgraded the affected framework and validation dependencies, migrated Zod record parsing, and added typed database/environment boundaries.
- Fixed owner UI loading/ref patterns. Type check passes. Lint: zero errors, five existing non-blocking warnings.
- Added fail-closed owner access: production must explicitly configure RIPEES_TRUST_IDENTITY_HEADERS=true only after verifying its gateway protection. Local sessions continue to work.
- Added scheduled daily telemetry deletion and verified the built worker includes the cron trigger. Added an existing-data contact migration preserving other content.
- Added CI and regression checks.

Verification: 23 chatbot release checks, 19 readiness checks, 15 isolated CRM checks, 15 local HTTP checks, 3 policy checks and 1 saved-contact migration check passed (76 total). AI provider tests are mocked. Production build and type check pass. Browser verification covered the full Privacy Policy, owner dashboard, enquiry inbox and chatbot insights.

Production dependency lockfile scan: zero critical, zero high, two moderate findings. These remaining entries require reachability review. This is not a certification of deployed security.

Still required before an unrestricted launch: verified live hosting identity boundary, production configuration and migrations, live AI evaluation/account access, monitoring and owner notifications, protected offsite backup/restore procedures, and broader real-device/accessibility/performance evaluation. The daily cron is present in the built configuration; its deployed operation still requires verification. Keep AI mode off until live evaluation passes.

Local server uses the patched dependencies; earlier source/dependencies are retained under .readiness-backup.
