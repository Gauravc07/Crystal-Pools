# Crystal Pools workspace (CAC)

A small staff app with two parts:

- **Requirement forms and the FRP quotation agent.** Staff who visit customers fill a requirement form; the agent turns it into a priced proposal in the Crystal Pools fiberglass proposal format, and the office approves and prints it.
- **Drawings vault.** Numbered drawings with checked and approved revisions.

It runs entirely on Supabase, in its own `cac` schema of the website's project. There is no application server, no background worker and no AI model: the agent is SQL rules and an FRP price list, so it uses **no AI credits**. One quotation takes about 20 ms of database work and about 4 KB of storage, so it adds nothing to the Supabase bill beyond the plan the website already uses.

| Need | Supabase feature |
|---|---|
| Records, rules, the FRP agent, approvals, audit | Postgres: `cac` schema, security-definer functions, row-level security |
| Staff sign-in and roles | Supabase Auth + `cac.staff` |
| Drawing files | Private Storage bucket `cac-drawings` |

The `cac` schema holds ten tables: `staff`, `event` (audit log), `doc_counter` (document numbers), `schema_migrations`, `drawing`, `drawing_revision`, `frp_price`, `frp_config`, `frp_requirement` and `frp_quote`.

## Requirement forms and the FRP quotation agent

- **Field staff login.** Settings → People & permissions → Add staff member, role *field (customer visits)*. Field staff see only **Requirements** and their own account: their own requirements, and the proposals made from them once approved, with the remark the office sent. They never see prices or any other record or file (row-level security closes every table to them).
- **The form** (Requirements → New requirement → type *FRP (fiberglass) pool*): customer name, phone and site location (optionally email, address, visit date and who referred the customer), pool length, width and depth in feet, tile print colour and size, equipment, a 7" chemical dispenser, the optional upgrades the customer asked about, and notes for the office. Every equipment choice defaults to *Agent decides*. A live summary shows what the agent will prepare (office staff also see the package price).
- **What the agent does** on submit (requirement `REQ/<FY>/0001`, proposal `FRP/<initials of the person who took it>/<yy>/<Mon>/<nn>`):
  - water depth = depth − 0.4 ft; fiberglass surface = L×W + 2(L+W)×depth; volume = L×W×water × 29 L per cu ft (the convention in the Crystal Pools quotes)
  - filtration flow = volume ÷ 4-hour turnover; 650Ø sand filter up to 16 m³/h, otherwise 700Ø (20 m³/h), with a note asking an engineer to size anything larger
  - filter media 100 kg (650Ø) or 250 kg (700Ø); pump 1.5 hp up to 9 m³/h, otherwise 2 hp
  - one RGB light per 90 sq ft of water surface (at least 2, an even number); 1 skimmer (2 above 450 sq ft); 1 jet (2 above 50,000 L); 1 drain; 1 ladder; 9 m hose up to 30 ft long, 11 m up to 40 ft, else 15 m
  - every line is priced from the FRP price list; the package price is rounded to ₹10 and paid 50 / 40 / 10 %
- **Review** (admin or commercial, Quotations or Requirements): the proposal shows what the agent did and the internal price build-up.
  - **Edit prices** changes any rate on the quotation, package items and optional upgrades, for this customer only (the FRP price list does not change). The screen then asks you to **Regenerate quotation**: the agent prepares a new version (`-R1`, `-R2`) and lists what changed from the previous one. Office prices stay with the requirement, so later versions keep them until you choose *Back to price-list rates*.
  - **Approve and send** dates the quotation today and sends it to the person who took the requirement, with an optional remark (prefilled with what changed, without internal rates). They see it under Requirements.
  - **Special price** sets a negotiated package price with a reason; **Send back** returns the requirement to the person who took it with a note; **Re-run agent** reprices it from the current price list. Changing a requirement also prepares a new version and supersedes the previous one.
- **Printing.** *Open proposal → Print / save PDF* prints 4 A4 pages named like `Quotation_Mr_Nilesh_Shukla_Mahabaleshwar_FRP_30x12_Proposal.pdf`. A proposal that is not approved carries a *DRAFT · NOT YET APPROVED* mark.
- **FRP price list** (Settings, admin or commercial): rates before GST for every package item and optional upgrade (blank shows *Price on request*), proposal terms (validity, delivery, payment stages, warranty), the company details printed on the proposal, and the agent's constants. **Saving confirms the list.** Proposals cannot be approved until it is confirmed, and a proposal priced before the latest change must be re-run first.
- **Default rates.** Where the Vishal Lakhani (Dec 2025) and Nikhil Kulkarni (Jan 2026) quotations priced an item, the default comes from them; the rest are estimates and are marked as such. The shell rate (₹735.86 per sq ft) is set so that the Mr Nilesh Shukla requirement (30 × 12 × 4.4 ft) comes to ₹7,28,680 with the other defaults. Check every rate before approving a real proposal.

## Drawings vault

- **Drawings** (numbered `DRG/26-27/0001`) name their client or site and can be linked to an FRP requirement (the client then defaults to its customer and site). Each has a discipline: Architectural, Structural (RCC), Filtration & plumbing, Electrical, Tiling & finishes, FRP, Landscape, Shop drawing, As-built or Other.
- **Revisions** R0, R1, … are files in the private Storage bucket `cac-drawings` (PDF, DWG, DXF, PNG, JPEG, WebP; up to 50 MB). Type and size are taken from Storage, not the browser. Staff open files through 10-minute signed links; there is no public access.
- **Workflow:** draft → submit → approved or rejected. One open revision at a time. Engineers check (admins may too), and nobody approves a revision they uploaded. Approving a revision supersedes the previous approved one. Revision files cannot be replaced or deleted.

## Roles

| Role | Can create or change | Can approve |
|---|---|---|
| Admin | Everything, plus staff accounts and backups | Everything |
| Sales | Requirement forms, drawings | None |
| Commercial | Requirement forms, the FRP price list | FRP proposals (approve, special price, send back, re-run) |
| Engineer | Drawings | Drawing revisions |
| Project | Drawings | None |
| Field | Their own requirement forms | None |
| Viewer | Read-only | None |

## Setup

Node 20.6 or later.

1. **Supabase project.** CAC uses the website's project and keeps everything in its own `cac` schema; website admins get no CAC access unless they are added as CAC staff.
2. **Configure.** Copy `cac/.env.example` to `cac/.env` and fill in the URL, publishable key, session-pooler connection string and the first admin's email and password.
3. **Install and apply the schema:**
   ```powershell
   npm --prefix cac ci
   npm --prefix cac run setup
   ```
   This applies `cac/supabase/migrations/*.sql` once each and creates the first CAC admin.
4. **Expose the schema to the API.** In the dashboard: *Project Settings → Data API → Exposed schemas*, add **`cac`**.
5. **Run the staff app:** `npm --prefix cac run dev`, then open **http://127.0.0.1:5185**. **Hosted:** the website's `npm run build` also builds CAC into `dist/cac`, served at **www.crystalpools.in/cac** (noindex; `robots.txt` disallows it). Add the app addresses to Supabase → Authentication → URL Configuration → Redirect URLs for password-reset emails.
6. **Check everything:** `npm --prefix cac run doctor` reports configuration, migrations, admins, function exposure, the FRP price list and Data API exposure, each with a fix.
7. **Confirm the FRP price list** (Settings, as admin or commercial) before approving the first proposal.

### Try it without Supabase

`npm --prefix cac run sandbox` starts the real app at http://127.0.0.1:5190 against an in-memory database with every migration and one login per role (password `cac-test-password`): `admin@cac.test`, `commercial@cac.test`, `sales@cac.test`, `engineer@cac.test` and the field user `sagar@cac.test`. Nothing reaches your Supabase project, and stopping it discards everything. Drawing file uploads need a real project.

## Security model

- Staff = Supabase Auth user **with an active `cac.staff` row**. Signing in alone grants nothing; non-staff see no rows. Field staff read nothing directly and get only their own requirements through `cac.workspace_state()`.
- Office staff may **read** `cac` tables (RLS). **No one writes tables directly**: every change goes through a `cac.*` function that checks the role, validates the input and writes everything in one transaction. Internal helpers (including the agent itself) are not callable.
- Accounts created with a temporary password must choose their own at first sign-in. A session ends after 12 hours without activity.
- **Admin backup:** Settings → My account → *Download backup* exports every CAC table as JSON (no passwords; drawing files stay in Storage).

## Project layout

```text
cac/src                              React staff app: main.jsx (shell, sign-in, settings, drawings vault), frp.jsx (requirements,
                                     proposals, price list, the printable proposal), api.js (the only Supabase access layer)
cac/supabase/migrations/0001…0014    schema history; 0012 adds the FRP agent, 0013 removes everything but the vault and the agent,
                                     0014 adds office price edits, remarks and "Referred by"
cac/scripts                          setup (migrations + first admin), doctor (checks), sandbox (local try-out)
cac/tests                            SQL tests (agent, vault, access) and the browser smoke test
```

## Checks

```powershell
npm --prefix cac test
npm --prefix cac run build
npm --prefix cac run test:browser
npm --prefix cac run check      # all three
```

Tests need no Supabase project. They run the real migrations in **PGlite** (in-process Postgres) with a small stub of Supabase's `auth` and `storage` schemas, and call the functions as `authenticated` with JWT claims, the way PostgREST does. The browser test drives the real app in headless Edge (`CAC_TEST_BROWSER=chrome` for Chrome), answers its Supabase requests from that database, and writes screenshots and a sample proposal PDF to `cac/test-results/`.
