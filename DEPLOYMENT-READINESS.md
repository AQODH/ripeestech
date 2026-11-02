# Release gates and operations

The readiness fixes do not constitute production sign-off.

## Owner identity

Owner access now fails closed unless RIPEES_TRUST_IDENTITY_HEADERS is the literal string true. Local tests set this explicitly. Set it in production only after verifying the host strips or overwrites client-supplied oai-authenticated-* headers and all raw origin routes are protected. Also configure RIPEES_ADMIN_EMAIL for the real owner. Never publish the local owner simulator.

## Retention

The Worker has a scheduled cleanup handler and the build configuration requests a daily 02:17 UTC trigger. Check the deployed configuration actually retains that trigger. Test deletion of expired telemetry in staging. Cleanup also runs with chat and insights access. Lead records remain manually managed.

## Production rollout

Back up the database, apply migrations including 0003 and 0004, verify protected owner sign-in, then update the saved company contacts to info@ripees.com, +256 787 947343 and WhatsApp 256787947343. Saved database values override defaults. Location: Kampala, Uganda; no street address has been supplied.

Keep AI off until a real provider response, representative answer evaluation, spending limits and outage fallback have passed. The previous billing failure is historical and requires current verification. Assign an inbox owner and check new enquiries daily; automatic email alerts are not yet configured. Rehearse protected offsite backup restoration and rollback.

## Remaining engineering gates

The affected framework and validation dependencies have been upgraded. The production dependency scan reports no critical/high findings and two moderate findings requiring triage. CI checks types, lint, functional tests and builds. Complete real-device accessibility/performance and hosted security checks. No launch certification is implied by local functional checks.

## Policy content

The supplied October 30 policy is included with company spelling standardized to the existing website name, the confirmed Kampala location and company email/phone. A separate November 3 operational note explains actual chatbot processing. No new contractual promises or legal compliance verification were invented.
