# Crystal Pools · Growth workspace (CAC)

A customer acquisition and sales-operations pilot in **`cac/`**, inspired by [Avinmont's research-to-conversation workflow](https://avinmont.com/) and adapted for Crystal Pools' enquiries, surveys, quotations, projects and maintenance.

**It runs entirely on Supabase.** There is no application server and no local database:

| Need | Supabase feature |
|---|---|
| Records, business rules, stage gates, approvals, audit | Postgres: dedicated `cac` schema, security-definer functions, RLS |
| Staff sign-in and roles | Supabase Auth + `cac.staff` |
| Survey photos | Private Storage bucket `cac-survey-photos` |
| Durable workflow queue | `cac.job` table (`FOR UPDATE SKIP LOCKED`, checkpoints, retries) |
| AI workflow worker | Edge Function `cac-worker` (optionally woken every minute by `pg_cron`) |
| Website enquiries | Reads `public.leads` when CAC is in the website's project |

The staff app is a static React build that talks to Supabase directly.

## The eight modules

| Module (pilot plan) | Where it lives |
|---|---|
| Prospect discovery | **Prospect discovery**: commercial/referral organisations only, evidence + source URL + research date, existing-pool status, open questions, website-based duplicate key, research assistant, approval, opt-out, **convert to opportunity** |
| Outreach workspace | **Outreach**: three campaign types with cost/effort, drafts from approved research + approved portfolio only, optional campaign link, review before sending, staff send from their own WhatsApp/email and record it, opt-out blocking |
| Unified lead inbox | **Lead inbox**: manual enquiries, **website contact-form import**, converted prospects, customer replies, revision requests |
| Sales pipeline | **Sales pipeline**: 14 stages; server-side gates (human response, next action, reviewed qualification, confirmed visit, verified survey, approved+sent quote, agreement + verified advance, project handover, lost reason / deferral date) |
| Survey and quotation | **Surveys & quotes**: measurements and observations, private photos, engineer verification, quotes from approved rate cards only, paise-exact totals, engineering then commercial approval, immutable versions, revision comparison, print/PDF |
| Project handover | **Projects**: only from a Won opportunity; milestones, site updates, handover checklist, change requests with customer approval reference, billing task until invoiced |
| Maintenance and referrals | **Maintenance**: equipment, warranty, service history, next service, renewal date, referral details, renewal assistant |
| Owner dashboard | **Overview**: pipeline counts, approved quoted value, verified collections, review queue and a **What needs attention** panel (enquiries awaiting a response, opportunities without a next action, surveys awaiting estimates, revisions to estimate, quote follow-ups, unbilled changes, renewals within 30 days) |

## Engagement features (adapted from Podium's dealership platform)

Migration `0005` adds the parts of [Podium's automotive platform](https://automotive.podium.com/) that fit a pool builder, translated from dealership terms:

| Podium idea | In CAC |
|---|---|
| Speed to lead | Each enquiry has an `enquiry received` time (website leads keep their submission time). The time to the first *Human response* is measured against a target set in **Settings** (default 60 min). The overview flags enquiries past the target; **Reports** shows median response time and % within target. |
| One inbox for every channel | Activities record a channel (phone, WhatsApp, email, website, walk-in, site) and direction. A **Missed call** creates a same-day callback task. |
| Test-drive booking, reminders, no-shows, show rate | **Appointments** (consultation, site visit, service visit, handover). Each has an automatic reminder task the day before, plus confirm, reschedule, complete, no-show and cancel. A no-show creates a re-engagement task. Confirming a site visit fills the pipeline's visit gate. Reports shows the show rate. |
| First/next service, declined-service follow-up | **Service visits** on maintenance contracts: work done, water readings, recommendations and the customer's decision. Each visit is appended to the service history, and a *declined* recommendation schedules a 30-day follow-up. |
| Marketing AI (warranty, lease end, VIN recalls) | **Lifecycle lists**: warranty ending ≤60 days, AMC renewal ≤30 days, service overdue, first service after handover, dormant enquiries (14 days with no conversation), lost/deferred worth revisiting, and an equipment advisory (match a pump/filter model). Each creates one reviewed follow-up task per customer with a suggested message, skipping opted-out customers and duplicates. |
| Automated review requests | Completing a project prepares a **review request** with the Google review link from Settings. Staff send it from their own WhatsApp or email and record it, then record the rating; Reports shows the average. |
| AI Studio / trained on your policies | **Knowledge base** (FAQ, policy, process, service area, objection) in the Approved library. Approved entries go to every assistant; follow-up drafts quote matching approved answers. |
| Operator ("ask anything, it acts after approval") | **Owner assistant** (admin): ask a question on the overview. It builds a prioritised plan from live metrics only, and approving the plan creates the tasks. |
| Conversion & task reporting | **Reports**: speed to lead, show rate, reviews, conversion by source and route, lifecycle completion, campaign cost and effort. |

**Phone calls are manual only.** Staff make and receive every call themselves and log it as a *Call* or *Missed call* activity. A missed call creates a callback task for a person. CAC has no telephony connection, and no assistant places, answers or records calls.

Not adopted: autonomous 24/7 texting, a website chat widget, DMS/CRM integrations and call-recording coaching. These need WhatsApp Business API providers with customer consent, changes to the public website, or third-party systems. Autonomous replies would also bypass CAC's rule that a person approves every customer message.

## Controls (Agent studio and Settings)

- **Schedule.** The worker runs every Sunday at 9:00 AM IST (`supabase/cron.example.sql`), and whenever staff press **Run agent now** or start an assistant.
- **Paid AI switch** (Agent studio, admin): off by default. While it is off the worker uses the free rules, whatever `CAC_AI_MODE` says, so no AI credits are used. Switched on, it uses the configured provider (Claude Haiku).
- **Assistants on/off** (Agent studio, admin): a switched-off assistant cannot run by any route (workflows, uploads, Gmail, Read again). Prospect research and personalised outreach are off by default.
- **Workspace sections** (Settings, admin): the sections follow the lead flow (enquiry → qualification → call → site visit → estimate → follow-up → proposal and BOQ → negotiation → closure → execution → handover → AMC). Prospect discovery, Outreach and Lifecycle lists are hidden by default; hidden sections keep their records and can be shown again.
- **Follow-ups** follow the lead flow: Day 1, Day 3, Day 7, then a monthly reconnect (early-stage projects: day 1, then monthly).

## Project lead reports (Gmail → AI → leads)

Crystal Pools receives a monthly spreadsheet of upcoming construction projects in Pune (builder, architect, purchase manager, construction stage, possession date, amenities). **Project leads** turns each report into leads with a follow-up plan.

```text
Gmail (read-only) ──► .xlsx attachment ──► cac.lead_import (once per file, by SHA-256)
   or Upload report                          │  queues a "Lead report reader" run (cac.job)
                                             ▼
                      worker: split into project blocks ──► model extracts each project
                                             │  (demo mode: report rules, no AI cost)
                                             ▼
          contacts checked against the report text ──► stage bucket, fit, priority
                                             ▼
             cac.project_lead (matched by project + builder) ──► follow-up task
```

- **Reading.** The worker checks Gmail every 15 minutes with the saved search (default `from:prathamesh.meraki2025@gmail.com has:attachment filename:xlsx newer_than:14d`). Any attachment whose name ends in `.xlsx` is read. **Check Gmail now** on the Project leads page forces a check. Each email and each file is read once. Staff can also **Upload report**: the browser reads the .xlsx and the same worker run extracts it. Old `.xls` files are listed with a "save as .xlsx" message.
- **Extraction.** With `CAC_AI_MODE=huggingface` or `openai`, the model reads five projects per request, four requests at a time, and returns a strict JSON schema. A phone number or email that is not in that project's own block is dropped, and a pool only counts if the report lists one. Demo mode reads the standard report layout (numbered `Sr. No.` blocks with Project / Builder / Architect / Other Professional Details and the Landmark, Project Details and Product Details lines) without a model.
- **Scoring.** The construction stage sets the bucket: *early* (prelaunch, excavation), *mid* (plinth, slabs) or *late* (RCC completed, finishing). Priority: **Hot** = late, or mid with a pool listed; **Warm** = mid, or early with a pool; **Cold** = early without a pool. *Where we fit* lists swimming pool, tiles (pool or paving tiles), FRP planters and fountains (landscaped garden) and filtration equipment. Early leads belong to **Marketing · In-person outreach** (architect visits) and the rest to **Sales · Follow-ups and closing**, as on the functional chart.
- **Schedule.** Each lead has one open follow-up task at a time, in **My work** and **Tasks**. Defaults, in days from the previous step: early 7, 60, 90 (introduce Crystal Pools to the architect first); mid 3, 14, 30, 60; late 1, 3, 7, 14. Admins change them, the Gmail search and the default owners in **Settings → Lead reports**.
- **Run it by hand.** **Run agent now** on the Project leads page checks Gmail at once and reads any waiting reports; **Read again** on a report re-reads it (for example after the rules or model improve) and merges the result.
- **Duplicates.** An email already read is skipped, and the same file sent again (in another email or uploaded) is recognised by its SHA-256 fingerprint and not read twice; the Gmail status says how many were skipped. A project is matched to its saved lead by project + builder, or by the same project name with the same PIN code or a builder name that starts the same way (for example "Developers Ltd" and "Developers"). A project listed twice in one report is merged and counted as a duplicate. Merging adds new contacts, phones, emails and amenities to the lead, fills blanks for a known person, and keeps saved values the new report leaves blank; two names on one line ("A/B", "A & B") are two contacts. New contacts are noted in the lead's comments. The model is told the same rules.
- **Next month's report** updates the existing lead and adds to its *Seen in reports* history. When the stage moves to a later bucket, open follow-ups are cancelled, a *Stage advanced* call is scheduled at the faster pace, and a comment records the change. A lead you reassigned keeps its owner.
- **Working a lead.** **Log call or visit** records the outcome as a comment and schedules the next step: *No answer* retries in 2 days, *Call back later* in 7, *Reached / Meeting booked / Interested* opens the next step (or the date you choose), and *Not relevant* closes the lead. Completing the task from Tasks also opens the next step. **Convert to opportunity** creates (or reuses) the builder as a customer, plus the site, the chosen contact and a *Project lead report* opportunity in the pipeline. **Close lead** (Lost / Not relevant, with a reason) cancels follow-ups; **Reopen lead** schedules one for tomorrow.
- **Comments.** Leads, opportunities, customers and prospects have a comment thread in their detail panel. Calls, stage changes, closing and conversion appear there too.

**Connect Gmail** (once):
1. In [Google Cloud](https://console.cloud.google.com/), enable the **Gmail API**, configure the OAuth consent screen and create an **OAuth client ID** of type **Desktop app**. With Google Workspace, make the consent screen **Internal**. With a personal Gmail account, set it to **In production**: in *Testing* status Google expires the sign-in after 7 days.
2. Put `GMAIL_CLIENT_ID` and `GMAIL_CLIENT_SECRET` in `cac/.env`, then run `npm --prefix cac run gmail:auth` and sign in with the mailbox that receives the reports. This saves `GMAIL_REFRESH_TOKEN` to `cac/.env`. Access is read-only (`gmail.readonly`): CAC never changes, labels or sends mail.
3. Run `npm --prefix cac run deploy:worker` (copies the three values to function secrets) and schedule the worker (`supabase/cron.example.sql`), or keep `npm run dev` running. `npm run doctor` checks the mailbox connection.

Limits: one .xlsx up to 5 MB and 5,000 rows per sheet; 20 newest matching emails per check. A report counts as one assistant run against the daily limit. Hugging Face and OpenAI calls for a 25-project report take about 30–90 seconds, within the Edge Function time limit; very large reports are better uploaded while the local worker runs.

## Setup

Node 24+ is needed only for the build tools and setup script.

1. **Choose a Supabase project.** The website's project works: CAC keeps everything in its own `cac` schema, and website admins get no CAC access unless they are added as CAC staff. A separate project also works; website-enquiry import is then unavailable.
2. **Configure.** Copy `cac/.env.example` to `cac/.env` and fill in the URL, publishable key, session-pooler connection string and the first admin's email/password.
3. **Install and apply the schema:**
   ```powershell
   npm --prefix cac ci
   npm --prefix cac run setup
   ```
   This applies `cac/supabase/migrations/*.sql` once each, creates the first CAC admin and, with `CAC_SEED_DEMO=true`, synthetic demo records.
4. **Expose the schema to the API.** In the dashboard: *Project Settings → Data API → Exposed schemas*, add **`cac`**.
5. **Deploy the worker** (processes assistant runs, so they finish without your computer on):
   ```powershell
   npx supabase login
   npm --prefix cac run deploy:worker
   ```
   This deploys `cac-worker` and copies the AI settings from `cac/.env` into Supabase function secrets (through a temporary private file, never the command line). It also generates `CAC_WORKER_SECRET` if you have none. The function checks access itself: the caller must be active CAC staff or send the worker secret. Optionally run `supabase/cron.example.sql` to wake it every minute. Until it is deployed, `npm --prefix cac run dev` runs the same worker locally.
6. **Run the staff app:**
   ```powershell
   npm --prefix cac run dev
   ```
   Open **http://127.0.0.1:5185**. **Hosted:** the website's `npm run build` also builds CAC into `dist/cac`, so the website's Vercel project serves it at **www.crystalpools.in/cac** (noindex, `robots.txt` disallows it, website and admin output unchanged). It reuses the website's `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`, because CAC lives in the same Supabase project. Add `https://www.crystalpools.in/cac` to Supabase → Authentication → URL Configuration → Redirect URLs for password-reset emails. (`cac/vercel.json` remains for hosting CAC as its own Vercel project instead.)
7. **Check everything:** `npm --prefix cac run doctor` reports configuration, migrations, Data API exposure, admins, function exposure, worker heartbeat, stuck or failed runs, the review link and the AI provider, each with a fix. Add `-- --ping-ai` to send one tiny test request to the model.

### AI providers

`CAC_AI_MODE` chooses who writes the assistant drafts. Every provider's output is validated and trimmed to the same contract, unsourced research facts are dropped, and a person still approves everything.

| Mode | Cost | Notes |
|---|---|---|
| `demo` (default) | Free | Deterministic local rules. |
| `anthropic` | Pay-as-you-go | Claude through the official SDK with structured outputs. Default model `claude-haiku-5-5` ($0.10 / $0.50 per million tokens; about a cent per lead report). Set `CAC_ANTHROPIC_MODEL=claude-opus-5-5` for more careful reading; Opus also re-runs a declined request on Anthropic's fallback model. Key: `ANTHROPIC_API_KEY`. |
| `huggingface` | Pay-as-you-go | [Inference Providers](https://huggingface.co/docs/inference-providers) through `router.huggingface.co`. Default model `openai/gpt-oss-120b:cheapest` (about $0.25 per million output tokens at the time of writing), falling back to `Qwen/Qwen3-32B` and `meta-llama/Llama-3.3-70B-Instruct` when a model is unavailable. Survey photos use `Qwen/Qwen2.5-VL-72B-Instruct`. No web search: research may cite only the URLs saved on the prospect. |
| `openai` | Pay-as-you-go | Responses API with structured output; research uses web search and keeps only cited facts. |

**Hugging Face setup.** Free Hugging Face accounts no longer include monthly inference credits: buy credits, or use PRO ($2/month included).
1. Create a token at [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens/new?ownUserPermissions=inference.serverless.write&tokenType=fineGrained), with type **Fine-grained** and permission **Make calls to Inference Providers**.
2. In `cac/.env`, set `HF_TOKEN=<token>` and `CAC_AI_MODE=huggingface`.
3. Run `npm --prefix cac run doctor -- --ping-ai`, then restart `npm run dev`, or run `npm run deploy:worker` for the hosted worker.

**Cost and safety guards.**
- Each person may start 30 assistant runs per hour and the workspace 200 per day; admins change both in Settings.
- A bad token or missing credits stops a run at once with a clear reason, instead of retrying.
- Agent studio shows the model and token use of every run, and Reports totals the last 30 days by model.
- The key never reaches the browser, and live calls send only the selected record and bounded context.

## Security model

- Staff = Supabase Auth user **with an active `cac.staff` row**. Signing in alone grants nothing; non-staff see no rows.
- Staff may **read** `cac` tables (RLS). **No one can write tables directly**: every change goes through a `cac.*` function that checks the role, validates the record and writes everything in one transaction.
- Postgres grants EXECUTE to PUBLIC by default; migration 0004 revokes every `cac` function and grants back only the staff entry points (to `authenticated`) and worker entry points (to `service_role`). Internal helpers are not callable.
- Status, stage and approval fields are never writable through record edits. Approvals pin the record version, so a stale review cannot approve changed evidence.
- Photos: engineers upload to `<survey id>/…` in a private bucket, only for unverified surveys (12 max, 2 MB, PNG/JPEG/WebP enforced by the bucket); MIME type and size are recorded from Storage metadata, and staff view photos via 10-minute signed URLs. Photos cannot be replaced or deleted.
- Website import only **reads** `public.leads`; a `cac.lead_link` row prevents duplicates. This lets CAC sales staff see website enquiries, which on the website are visible only to super admins.
- **CAC never sends messages itself.** For an approved reply, quotation or review request, staff click **Open WhatsApp** or **Open email**. That opens their own app with the approved text and the saved phone or email. After sending, they click **Record as sent** and choose the channel. Recording blocks unapproved or opted-out messages, counts as the human response for speed to lead, and schedules one follow-up.
- Accounts created with a temporary password must choose their own at first sign-in. Staff can change their password in Settings and reset a forgotten one by email. A session ends after 12 hours without activity. Duplicate customers (same email, or the same last 10 phone digits) are blocked.

## Daily use

- **My work**: your open tasks (overdue first), opportunities you own that need a next step, your appointments this week, and the reviews waiting for your role.
- **Appointments**: a 7-day agenda above the full list.
- **Tasks** can be cancelled with a reason.
- **Admin backup**: Settings → My account → *Download backup* exports every CAC table as JSON (no passwords; photos stay in Storage). Supabase keeps its own database backups too.
- **Password reset emails** return to the app only if its address is allowed in Supabase → Authentication → URL Configuration → *Redirect URLs*. Add `http://127.0.0.1:5185` and your hosted address.

## Roles

| Role | Can create/change | Can approve |
|---|---|---|
| Admin | Everything, plus staff accounts | All review types (owner override, audited) |
| Sales | Customers, contacts, prospects, opportunities, campaigns, portfolio, activities, tasks; website import; prospect conversion | Prospect, qualification, outreach, sales brief, follow-up |
| Engineer | Sites, surveys, photos, quote drafts, activities, tasks | Survey, quotation scope, survey review |
| Commercial | Rates, quote drafts, payments, change billing, tasks | Rates, quotation price, payments, maintenance offers |
| Project | Projects, change requests, maintenance, activities, tasks | Project coordination, scope changes |
| Viewer | Read-only | None |

## Ten bounded workflows

All are steps of one persisted state machine (`cac.job`): **queued → running (claimed) → analysis saved (checkpoint) → waiting approval → completed / rejected**, with up to three attempts and backoff. `cac.complete_job` applies all side effects atomically; a business-rule failure leaves nothing behind.

1. **Research**: source-linked brief for a saved commercial prospect. Live mode keeps only facts tied to returned citations.
2. **Qualification**: proposes location, pool type, budget, timeline, decision-maker; applied only on approval and never overwriting staff-entered values.
3. **Contextual follow-up**: records the reply, pauses generic reminders, routes revisions to an estimation task with no guessed heater or price, and handles opt-outs.
4. **Outreach**: drafts from approved research and approved portfolio, optionally linked to a campaign.
5. **Sales assistant**: meeting brief.
6. **Site-survey assistant**: flags missing measurements/observations; photos are observations only.
7. **Proposal assistant**: deterministic quote from approved rates; engineering then commercial approval.
8. **Project coordination**: flags scope/cost/programme impact for a change request.
9. **Maintenance**: renewal recommendation; commercial approval controls offers and prices.
10. **Owner assistant** (admin): a prioritised plan from live metrics only; approved actions become tasks.

### Try the heating example

Sign in → **Contextual follow-up** → *Sahyadri · resort pool* → **Use the heating + December example** → Run. In Agent studio the run reaches *waiting approval*; **Lead inbox → Revision requests** shows heating and a tentative December start with a request to confirm the year; **Tasks** shows the generic reminder paused and an estimator task open; **Approvals** holds the proposed reply.

## Project layout

```text
cac/src                              React staff app (api.js = the only Supabase access layer)
cac/supabase/migrations/0001…0008    schema, rules, workflow queue, integrations, engagement, AI limits, operations, project leads
cac/supabase/functions/cac-worker    Edge Function entry point
cac/supabase/functions/_shared       Worker, analysis, lead-report reader (leads.js), .xlsx reader and Gmail client, shared with Node tests/worker
cac/scripts                          setup (migrations + admin + demo), local worker, dev runner, Gmail sign-in (gmail-auth.mjs)
cac/tests                            SQL/workflow tests and the browser smoke test
```

## Checks

```powershell
npm --prefix cac test
npm --prefix cac run build
npm --prefix cac run test:browser
npm --prefix cac run check      # all three
```

GitHub Actions runs the same checks on every push or pull request that touches `cac/` (`.github/workflows/cac.yml`), using Playwright's Chromium, with no secrets.

Tests need no Supabase project. They run the real migrations in **PGlite** (in-process Postgres) with a small stub of Supabase's `auth`/`storage` schemas and roles, and call the functions as `authenticated` with JWT claims, the way PostgREST does. The browser test drives the real app in headless Edge (`CAC_TEST_BROWSER=chrome` for Chrome), answering its Supabase Auth/RPC/function requests from that database, and writes screenshots to `cac/test-results/`.

The lead tests build real .xlsx files with synthetic data (`tests/helpers/xlsx.mjs`) and mock Gmail and the model. The AI tests mock every provider call (structured output, JSON-mode fallback, model fallback, bad token, no credits, output sanitising, photo routing), so they cost nothing.

Not covered by automated tests: Storage upload over HTTP, the deployed Edge Function, and real model calls. Use `npm run doctor -- --ping-ai` and the heating example after setup. Sign-in and the workspace load through the hosted Data API were verified against the live project on 13 Oct 2026.

## Limits

- Pilot scale: the staff app loads the whole workspace and refreshes every 5 seconds.
- Research starts from a saved prospect; market-wide sourcing needs approved regions and source providers.
- CSV imports save valid rows and report invalid ones.
- Milestones, service histories and document references are staff-entered text. Print-to-PDF uses the browser.
- Replies are linked to an opportunity by staff; there is no automatic email matching.
- Model output and cited pages are drafts for human review, not proof of a business need.

## Inputs needed next

1. Which Supabase project to use, and its connection details in `cac/.env`.
2. Crystal Pools' real service regions, lead sheet, approved project examples and staff/approval owners.
3. Two or three actual quotations, approved rate cards, exclusions and payment terms.
4. An OpenAI key (as a Supabase secret) only if live AI is wanted; email/WhatsApp provider details only when delivery integration is requested.
