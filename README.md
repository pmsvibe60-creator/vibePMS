# vibePMS

**An open-source property management starter kit for vibe coders, built on Twenty CRM. Self-host it, customize it, and make it your own.**

Public preview, with rental workflows currently oriented toward Estonia.

MIT-licensed sidecar code; third-party services retain their own licenses.
End-to-end sandbox payment and Railway deployment validation are still pending.
Use fictional data while evaluating.

Rent management for apartments owned/let through an Estonian OÜ.
**Twenty CRM** (self-hosted) is the database + UI; a small **sidecar** service adds contracts, e-signing,
CasaPay rent/deposit collection, utility re-billing and scheduling.

```
pms.example.com      → Twenty (operator UI)                ┐
api.example.com  → sidecar (/sign, /webhooks, /files)  ┘ Cloudflare tunnel "vibepms"
```

## How it works

| You do (in Twenty) | The system does |
|---|---|
| Create **Unit**, **Person** (tenant), **Lease** (rent, deposit, start date…) | — |
| Set Lease status → **Ready to sign** | Renders the ET/EN contract PDF, hashes it, e-mails the tenant a signing link |
| — | Tenant signs (typed name + drawn signature) → landlord gets a countersign link |
| Countersign | Seals PDF with signature page + audit trail (time, IP, UA, SHA-256), e-mails both, Lease → **Signed** |
| — | Creates CasaPay move-in checkout (pro-rated first rent + deposit/guarantee), e-mails tenant; Lease → **Awaiting payment** |
| — | On payment webhook: Lease → **Active**, Unit → Occupied, stores CasaPay agreement + **utility e-mail alias** |
| Forward utility bills (KÜ, Elektrum…) to the lease's **Utility invoice email** | CasaPay parses & bills the tenant; hourly sync imports them as Invoice type *Utilities* |
| — | Daily 08:05: issues monthly rent invoices (PDF + CasaPay invoice with due date & 7-3-1 reference) |
| — | Hourly: syncs paid/partial/overdue + payout status; payment failures noted + tenant reminded |

Manual-signed lease? Set status straight to **Signed** — CasaPay activation still runs.

## Data model (Twenty custom objects, provisioned by `pnpm setup`)

- **Unit** — address, apartment no., m², rooms, status, KÜ contact, meters, inventory
- **Lease** — unit, tenant (Person), status pipeline, dates, rent, due day, deposit + mode, CasaPay agreement type,
  utilities policy, notice period, language, contract PDF, signing link, CasaPay ids + e-mail alias
- **Invoice** — lease, unit, type (Rent / Move-in / Utilities / Other), status, number, 7-3-1 reference, period,
  amount, paid, due date, payout status, payment link, PDF
- **Person** + `personalCode`, `kycStatus`

## Railway hosting

For a hosted installation that stays online when your computer is off, see the
[Railway deployment guide](deploy/railway/README.md). It includes service configuration,
storage, owner setup and the steps to create a reusable deployment template.
The deployment files are prepared; live validation and a published one-click template
are still pending.

## First-time setup (local Docker)

1. `cp .env.example .env` and fill secrets (`openssl rand …` hints inside) and `OWNER_*` company details.
2. `docker compose up -d db redis server worker` (Twenty at http://localhost:3020). The tunnel is optional.
3. Open Twenty, sign up (first user creates the workspace).
4. Twenty → Settings → APIs & Webhooks:
   - create an **API key** → `TWENTY_API_KEY`
   - create a **webhook** → `<PUBLIC_URL>/webhooks/twenty`, copy its secret → `TWENTY_WEBHOOK_SECRET`
5. CasaPay dashboard (sandbox first) → Developers:
   - API key → `CASAPAY_API_KEY` (`sk_test_…`)
   - webhook `<PUBLIC_URL>/webhooks/casapay`, all `gateway.*` events → secret → `CASAPAY_WEBHOOK_SECRET`
6. `docker compose up -d --build sidecar && docker compose exec sidecar pnpm setup` (creates objects/fields; safe to re-run).
7. In Twenty, add a Kanban view on Leases grouped by **Status** (and on Invoices by **Status**).
8. Recommended: Cloudflare Access (e-mail OTP) policy on `pms.example.com`. Leave `pms-api` public — its routes
   are protected by HMAC signatures/tokens.

## Public URLs and optional tunnel

The default URLs are local-only. For remote signing and provider webhooks, configure
HTTPS endpoints you control, update `SERVER_URL` and `PUBLIC_URL`, and restart services.
The example.com domains below are documentation placeholders, not hosted services.

To use the optional Cloudflare tunnel, replace the placeholder tunnel ID and hostnames
in `cloudflared/config.yml`, save your tunnel credentials outside Git, set
`CLOUDFLARED_CREDENTIALS` to their absolute path, then run
`docker compose --profile tunnel up -d`. Never commit the credentials file.

## Community and license

Use Issues for bugs and feature requests, Discussions for questions, and the private
Security reporting form for vulnerabilities. See [CONTRIBUTING.md](CONTRIBUTING.md),
[SECURITY.md](SECURITY.md), [roadmap](docs/roadmap.md), [MIT license](LICENSE) and
[third-party notices](THIRD_PARTY_NOTICES.md). Hosting and external payment/email
services are separate from the open-source code and may incur costs.

## Admin API (for Twenty workflow "HTTP request" buttons or curl)

`Authorization: Bearer $ADMIN_TOKEN`

| Endpoint | Purpose |
|---|---|
| `POST /admin/leases/:id/send-for-signing` | (Re)send contract for signing |
| `POST /admin/leases/:id/activate` | (Re)create move-in checkout for a Signed lease |
| `POST /admin/leases/:id/rent-invoice?period=2026-11` | Issue one month's rent now |
| `POST /admin/invoices/:id/void` | Cancel unpaid invoice's checkout (→ Refund needed if money already moved) |
| `POST /admin/jobs/monthlyRent` · `/admin/jobs/syncInvoices` | Run a job now |
| `POST /admin/pricing-preview` `{cover_amount, first_payment_amount}` | CasaPay deposit vs guarantee pricing |

## Development

```bash
cd sidecar
pnpm install
pnpm test          # 7-3-1 refs, pro-rating, webhook HMAC, PDFs, lease validation
pnpm typecheck
docker compose up -d --build sidecar   # from repo root
```

Contract wording lives in `sidecar/templates/lease.{et,en}.md` (Handlebars + minimal markdown) — have it
reviewed by a lawyer before first use.

## Notes

- The OÜ must own the apartment or hold it under a (sub)lease to let it. Confirm accounting treatment with your accountant.
- Typed-name + drawn signatures are simple e-signatures with an audit trail. For a stronger evidential position use
  Smart-ID/ID-card (DigiDoc) and set the lease to *Signed* manually.
- Residential rent is VAT-exempt (KMS § 16 lg 2 p 1); deposit is capped at 3 months' rent (VÕS § 300) and validated.
