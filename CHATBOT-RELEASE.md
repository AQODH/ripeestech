# RIPEES chatbot release — 31 October 2026

## Implemented locally

- Published answers take priority for FAQs, prices, availability, named products, contact information and comparisons. Typo handling and focused follow-up wording were improved.
- AI assistance uses the Responses API with streamed text, cancellation, a 35-second provider deadline, bounded output, approved public context and no action-taking tools. The browser safely renders Markdown after completion.
- An interrupted or failed AI reply is replaced with approved knowledge and an explicit fallback notice. Repeated provider failures trigger a 60-second cooldown.
- Prepared-reply pacing is editable: immediate, 0.8 seconds, 1.5 seconds or the existing three-second pause. AI output streams as it arrives.
- Customers can mark replies Helpful or Not helpful. Feedback uses a private per-answer receipt. A question is shared with the owner only after the customer chooses Share my question; common emails, numbers and credential formats are redacted.
- Contact the team opens an editable summary of the visitor’s questions. The visitor reviews it before opening the enquiry form or a WhatsApp draft. No message is sent automatically.
- CRM → Chatbot includes seven-day reply counts, helpfulness feedback, topic gaps, average latency, token usage and last provider status. Full chat transcripts are not stored automatically.
- New migration 0003_sharp_liz_osborn.sql adds ephemeral chat telemetry. Customer-content backups still include settings, products and enquiries; telemetry is intentionally excluded.

## AI connection: action still required

A new key named Codex was saved securely to the approved, ignored .env.local file. The picker selected Personal / Default project, with a 30-day key expiration. No credential is included in source exports or the GitHub checkout.

The live verification reached OpenAI and returned HTTP 429 with billing_not_active. The account needs API billing activated before live generated replies can be verified. Approved-answer mode is therefore active locally. After activating billing, choose AI assisted in CRM → Chatbot, save, and verify actual responses and provider status. The configured model is gpt-5-mini; availability and account limits must still be confirmed by a successful request.

Billing: https://platform.openai.com/settings/organization/billing

## Verification

- 13 additional release checks passed, using a mocked provider: receipts, feedback consent, redaction, owner-only insights, priority answers, stream completion, usage recording, provider failure, interrupted streams, cooldown, daily limits and common spelling errors.
- 20 readiness checks and 15 CRM integration checks passed against isolated SQLite databases.
- 15 live local HTTP checks passed; temporary enquiry/product/FAQ fixtures were removed and original settings restored.
- TypeScript check passed. The framework build passed for the new endpoints and owner components.
- Browser verification covered a formatted comparison, persisted Helpful feedback, reviewed handover summary, prefilled enquiry without automatic submission, and owner usage/status insights. The browser viewport override did not take effect during this run, so a new mobile rendering check could not be confirmed.

63 functional checks passed. Mocked-provider tests do not establish real model answer quality, live streaming performance or worldwide traffic capacity. Live generation evaluation remains blocked by API billing.

## Operating limits and privacy

Default public limits remain 15 chat requests per visitor per minute and 500 site-wide per day. AI generation is additionally limited to 100 attempts per day and 1,200 output tokens per request. Failed attempts consume the daily attempt allowance conservatively. These controls do not guarantee a currency spending cap; configure provider-side billing controls as well.

Metadata and opted-in questions follow a 30-day retention policy. Cleanup runs during normal use and owner insights access; schedule cleanup for inactive production deployments. Automatic redaction is not a guarantee that every kind of sensitive information is detected. No advertising analytics were added. Owner alert delivery and live competitor research are not configured.

## Local review

Website: http://127.0.0.1:4173/website

Owner workspace: http://127.0.0.1:4173/admin → Chatbot

The hosted Site and GitHub remote were not changed. Updated source is supplied separately; deploy the migration and configure secrets in the production host before enabling AI there.

