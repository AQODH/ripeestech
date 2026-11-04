# RIPEES local platform

## Open the running service

- Website: http://127.0.0.1:4173/website
- Administrator sign-in: http://127.0.0.1:4173/admin/login

The local owner-workspace mock has been replaced with administrator accounts and password sign-in. No email sender, Resend account, or other authentication API is required.

1. Create a fresh secret of at least 32 characters. For example, run `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` and keep the result private.
2. In the project root, create the ignored `.env.local` file with your administrator emails and secret:

       RIPEES_ADMIN_EMAILS=admin1@example.com,admin2@example.com
       RIPEES_AUTH_PEPPER=paste-a-new-random-secret-here

   Use real addresses you control. Never reuse the pepper previously shared in chat, and do not commit `.env.local`.
3. Start the server with `npm run local`, then in another terminal run:

       node scripts/provision-admin.mjs --local admin1@example.com

4. Open the one-use setup link printed in the terminal and choose a password of at least 12 characters. Save the recovery codes somewhere private. Setup links expire after 30 minutes.
5. To set up another allowlisted administrator, run the provisioning command for that address.

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

The repository’s chatbot updates are retained: optional streamed AI replies, feedback, reviewed handover and owner insights. AI mode requires a configured provider and available billing; approved-answer mode works without it. No credentials are included in this checkout. See CHATBOT-RELEASE.md for the retained release details.

## Testing and limits

- The application passed 15 CRM checks, 19 readiness checks and 15 live local HTTP integration checks.
- Chat requests are limited to 15 per visitor per minute and 500 total per day.
- The local service binds to loopback. Administrator passwords are PBKDF2-hashed, and browser sessions expire after 12 hours.
- Sign out using the **Sign out** button. Sessions are stored in the local database and survive service restarts until they expire or are revoked.
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

The hosted application code remains available in this source tree. The local runner uses the same password-authentication handlers with a file-backed local database. No authentication email is sent; operators share short-lived setup links privately.


## Reply pacing

The assistant shows animated typing dots for at least three seconds before a successful reply. Slower requests do not receive an additional three-second wait. Replies appear gently, and messages mentioning frustration or urgency receive a short supportive acknowledgement. Reduced-motion preferences disable the animations.


## Launch polish

The inbox supports search, status filters, 50-row pages and complete CSV exports. Streamed JSON backups include all records. Restore limits: 10 MB, 1,000 products and 10,000 enquiries. The hero image and alternative text are editable in the Website editor. Approved phone/WhatsApp: +256 787 947343. See RIPEES-launch-readiness.md next to this source folder for release limits.
