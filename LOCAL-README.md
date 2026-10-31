# RIPEES local platform

## Open the running service

- Website: http://127.0.0.1:4173/website
- Owner workspace: http://127.0.0.1:4173/admin

On the local sign-in page, click **Enter local owner workspace**. This simulates the owner for local testing; it is separate from your hosted site's ChatGPT sign-in.

## Start it again

On this computer, double-click **START-RIPEES.cmd** in this folder. Keep that terminal window open while testing.

Or, in a terminal opened in this folder:

    npm run local

If you move the source to another computer, install Node.js 22.13 or later (Node.js 24 is recommended), then run:

    npm run install:ci
    npm run local

The running copy on this computer uses the already installed project dependencies. Downloadable source archives exclude installed dependencies.

## Try the functionality

1. In **Products**, add a product as Draft. It will remain hidden from the website.
2. Change it to Coming soon or Available and save. Refresh the local website to see it.
3. In **Website editor**, change a section heading or contact information, save, then refresh the local website.
4. Submit a project enquiry on the local website. Open **Enquiries** to see it, change its status and add private follow-up notes.
5. Open **Chatbot**. Add a question and approved answer, save, and ask that question through the website's **Ask RIPEES** button.
6. Ask **Compare SaaS and custom software** or name two published products to test comparison tables.
7. Use **Backups** to download a JSON copy. Importing a backup updates matching records and adds new ones without deleting unrelated records.

## Where your data is saved

The local database is:

    .local/ripees.sqlite

This is a file on your computer. Data survives browser refreshes and service restarts. Your browser is not the main data store. Local changes do not update the hosted website or its online database.

Keep backups of your data. Source ZIP files include code and database migrations, not your private database records.

## Chatbot mode

The local service currently runs in **knowledge mode**:
- Uses public website content, published products and your approved answers.
- Supports formatted paragraphs, lists and comparison tables.
- Excludes draft products, unpublished answers and private enquiry records.
- States when external product information is not verified.
- Does not make external AI calls or browse the web.

The local runner can load a securely configured key from ignored .env.local. AI assistance supports streamed replies and knowledge fallback. This computer currently uses approved-answer mode because the verified provider response reported billing_not_active. Activate the selected API project’s billing, then choose AI assisted in the CRM Chatbot tab and verify a live reply. Keys and private data are excluded from the source archive.

## Testing and limits

- The application passed 15 CRM checks, 19 readiness checks and 15 live local HTTP integration checks.
- Chat requests are limited to 15 per visitor per minute and 500 total per day.
- This is a loopback-only local test service, not an internet production login system.
- Local owner sessions reset when the server restarts.
- Font loading may use Google Fonts; system-font fallbacks work without it.
- Email links open your email application. No automatic outgoing-email service is configured.
- Use **Ctrl+C** in the server terminal to stop it.

## Main code

- app/admin/ — owner workspace, website editor and chatbot controls
- app/api/ — product/content management, enquiries and chat
- lib/ — shared content, chatbot rules and server helpers
- public/ — website styles, browser scripts and logo
- db/ and drizzle/ — database schema and migrations
- scripts/local-server.mjs — local server and file-backed database
- tests/local-smoke.mjs — local HTTP integration checks

The hosted application code remains available in this source tree. The local runner uses the same application handlers with a local database and local owner session.


## Reply pacing

The assistant shows animated typing dots for at least three seconds before a successful reply. Slower requests do not receive an additional three-second wait. Replies appear gently, and messages mentioning frustration or urgency receive a short supportive acknowledgement. Reduced-motion preferences disable the animations.


## Launch polish

The inbox supports search, status filters, 50-row pages and complete CSV exports. Streamed JSON backups include all records. Restore limits: 10 MB, 1,000 products and 10,000 enquiries. The hero image and alternative text are editable in the Website editor. Approved phone/WhatsApp: +256 750 676139. See RIPEES-launch-readiness.md next to this source folder for release limits.


## Chatbot release — 31 October 2026

Helpful/not-helpful feedback uses per-answer receipts. Full transcripts are not stored automatically. Customers can explicitly share a question; common emails, numbers and key formats are redacted. Owner insights show seven-day usage, topic gaps, feedback and provider status. Metadata follows a 30-day retention policy and is cleaned during use; inactive deployments should schedule cleanup before public operation. Customer-reviewed summaries can open an enquiry or a WhatsApp draft without automatic sending. Prepared reply delay is configurable; generated AI replies stream immediately. API limits default to 100 generation attempts/day and 1,200 output tokens/request, plus public visitor limits; configure provider billing caps separately. New ephemeral chat metrics are not included in the customer-content backup.
