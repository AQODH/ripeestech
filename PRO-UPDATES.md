# Professional update — what changed and what is still yours to do

## Changed (all permanent, in source)
- `public/pro.css` (new): readable type (no text under 11px), consistent buttons, clear keyboard focus, product-card polish, nicer enquiry form, mobile header, dark-mode polish, reduced-motion and print support. Loaded last, so it refines `style.css` safely.
- `site/index.html`:
  - Removed unverifiable claims: "99.9% uptime SLA", "50+ deployments", "<100ms latency", "Zero-Trust", "256-Bit SSL". Replaced with true statements from the company's own approach.
  - Emoji icons replaced with a clean SVG icon set.
  - Fake social links (generic github.com / linkedin.com / x.com) replaced with real channels: email and WhatsApp.
  - Removed the made-up "v1.2" download badge (real versions still show on product cards).
  - Removed a third repeated "start a project" banner; nav now has Questions and Contact.
  - Fixed squashed footer columns.
  - Fonts now load with `<link>` + `display=swap` (faster than CSS `@import`).
- `app/website/route.ts`: structured data (JSON-LD) now built from your settings and the real domain (it pointed at an old test domain). Added Open Graph/Twitter tags, HSTS, nosniff, Referrer-Policy, X-Frame-Options, COOP and `frame-ancestors`.
- New: `/robots.txt`, `/sitemap.xml`, branded 404 page. `app/layout.tsx` has proper viewport and theme colour.

## Still waiting on you
1. Add your real LinkedIn / X / GitHub / Facebook URLs to the footer `social-links` block in `site/index.html`.
2. Confirm "Registered business entity in Uganda." in the footer is true, or delete it.
3. The WhatsApp/phone/email in the FAQ and footer are typed into the template. Changing them in the admin CRM will not update those spots.
4. Run `npm ci && npm run build` on Node 24 and the tests in `tests/` before deploying. They were not run here.
5. Add real project case studies or client logos when you have permission. They will do more for trust than any design.

## Round 2 — immersive layer (Newman style)
Hero pattern: **sticky product story**. Supporting: **stacked cards** and **split-text reveal**. Chosen because trust matters for a software company, so motion stays calm.
- `public/immersive.js` + `public/immersive.css` (new). The commerce demo pins on screen and walks through Orders → Sales → Automation as you scroll. The four "how we think" steps pile up as cards. Headlines rise word by word. Cards fade up. Links glide with smooth scroll.
- `public/vendor/` (new): GSAP 3.15.1 and Lenis 1.3.28, hosted on your own site because your security rules only allow your own scripts. Licences are in `public/vendor/README.md`.
- Safe by design: switched off for visitors who ask for reduced motion, not used on phones and tablets (they keep the normal layout), and the page works with JavaScript off.
- Floating menu bar fixed so it stays on one line.

How to check: scroll the page on a laptop. The dark demo should stay still while its tabs change. If it jumps, open the browser console and send me the red error.

## Round 3 — full redesign (looks AND structure)
Hero pattern: **type-behind-object** (giant word behind a glowing core). Supporting: **sticky product story**, **horizontal product gallery**, **stacked process cards**, **bento services**, **marquee**, **word-by-word reveal**.
- `site/index.html` rewritten: floating glass nav, new hero, bento services, pinned demo story, product gallery, 4-step approach, lab orbit, about, FAQ, finale, contact, footer. All `{{settings}}` placeholders and CRM markers kept.
- `public/style.css` rewritten: new dark + lime design, Manrope and DM Sans fonts.
- `public/site.js` (new) replaces the old motion files: smooth scroll, pins, reveals. Switched off for reduced-motion visitors. Pins are off on phones.
- `app/website/route.ts`: product cards, catalogue wrapper and contact block now use the new markup. Downloads still work.
- `scripts/local-server.mjs`: now serves `/site.js` and `/vendor/*`.
- Removed old files: `motion.css/js`, `pro.css`, `immersive.css/js`, `theme-effects.js`. Your original zip still has them.
- Dark-mode toggle is gone (the new design is dark and light by section).

How to check: run the site, scroll. The hero word sits behind the core; the demo tabs change as you scroll; products slide sideways. If `/site.js` shows 404 in the browser console, the deploy missed `public/`.

## Still waiting on you (Round 3)
1. Product images: the gallery looks best with transparent cutout PNGs.
2. Same list as above (social URLs, business-entity line, hard-coded contacts, build + tests on Node 24).

## Round 4 — brand blue, newsletter, cookies, SEO
- **Colours:** whole site (and owner workspace) moved to the logo's navy and cyan. Tokens are at the top of `public/style.css` (`--night`, `--lime` = cyan accent, `--blue`). Change them there to re-colour everything.
- **Name:** public name is "RIPEES". Old saved settings that still say "Technologies Limited" are shown as "RIPEES" automatically. Legal pages keep "RIPEES Technologies Limited (trading as RIPEES)" in the contact block only. The full legal name is also in the hidden search data (JSON-LD `legalName`).
- **Hosting names removed** from the footer and services section.
- **Newsletter (opt-in only):** footer sign-up box → `/api/subscribe` → table `subscribers` (migration `0007`). Needs the box ticked. Bots are blocked by a hidden field and rate limits. Owner downloads the list at `/api/subscribers` (CSV, sign in first). Unsubscribe link for newsletters: `/api/unsubscribe?t=<token>`.
- **Cookies:** banner with "Essential only" / "Accept all". Choice kept 6 months on the visitor's device. Optional tools such as analytics must wait for the `ripees:consent` event. No analytics is installed yet.
- **SEO:** home page now served at `/` (no redirect), canonical + sitemap point to `/`, new title and keywords, richer structured data (organisation, FAQ, products list).
- **Hero** now uses the real RIPEES logo as the centrepiece.

Apply the new table: run the D1 migrations before deploying (`drizzle/0007_newsletter_subscribers.sql`).

## Still waiting on you (Round 4)
1. Run migrations, then `npm ci && npm run build` and tests on Node 24 (not run here).
2. Open Google Search Console, add the site, submit `/sitemap.xml`. This is what makes Google find you fast.
3. Admin → Settings: change "Company name" to RIPEES if it still shows the old name.
4. Update the privacy text to mention the newsletter and cookie choice (a lawyer should check it for Uganda's Data Protection and Privacy Act, 2019).
5. Pick a newsletter sender (Mailchimp, Brevo, etc.), import the CSV, and add the unsubscribe link.
6. Social links, real contact settings, product PNGs (from earlier rounds).

## Round 5 — merged with the team's latest GitHub changes
- Started from `AQODH/ripeestech` main (commit a3d09ee). The team's newest work is kept: contact details now follow the admin settings (`{{email}}`, `{{phone}}`, `{{address}}`, `{{whatsapp_url}}`), so the hard-coded contact warning from earlier is fixed.
- New admin tab **Newsletter**: see sign-ups, active count, and export the CSV. (Admin already lets you add and edit products/projects, upload app files, edit every website text and the hero image, read and manage enquiries, run the chatbot and take backups.)
- Nothing stored is removed. The only database change is one new table (`0007`). Products, settings, enquiries, admin accounts and backups are untouched.
- Checked here: type-check passes, the app builds, and the legal, CRM, contact-migration and market-readiness tests pass. `local-smoke` needs `RIPEES_ADMIN_EMAILS` set in `.env.local`, so it was not run.
- Heads-up: `npm ci` fails on the current lockfile (it is missing `@cloudflare/workers-types`). This was already true on GitHub main. Use `npm run install:ci`, or run `npm install` once and commit the updated `package-lock.json`.
