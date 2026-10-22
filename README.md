# vibePMS

[Website](https://pmsvibe60-creator.github.io/vibePMS/) · [Launch kit](marketing/README.md) · [Roadmap](https://github.com/users/pmsvibe60-creator/projects/1)

**An open-source property management starter kit for vibe coders, built on Twenty CRM. Self-host it, customize it, and make it your own.**

Public preview for builders worldwide. Adapt contract templates, rental rules and integrations to your market.

MIT-licensed sidecar code; third-party services retain their own licenses.
End-to-end sandbox payment and Railway deployment validation are still pending.
Use fictional data while evaluating.

A rental-management foundation for landlords and builders.
**Twenty CRM** (self-hosted) is the database + UI; a small **sidecar** service adds contracts, e-signing,
CasaPay rent/deposit collection, utility re-billing and scheduling.

```
pms.example.com      → Twenty (operator UI)                ┐
api.example.com  → sidecar (/sign, /webhooks, /files)  ┘ Cloudflare tunnel "vibepms"
```

## Move-in and move-out inspections

Create separate private tenant/operator links, complete a room checklist with photos, meter readings and keys, then confirm a shared report. Move-out reports compare against confirmed move-in observations. Locked content, linked amendments, PDF export and MCP creation are included.

[Inspection setup and limits](docs/inspections.md) · [Try the handover demo](https://pmsvibe60-creator.github.io/vibePMS/inspection-demo.html)

## Reconcile rent through your AI assistant

Import a CSV statement through your own MCP-enabled AI client, review suggested invoice matches, and approve partial or split payments. Track owner costs and tenant cost shares awaiting billing, with a persistent ledger and correction history. No bank-feed subscription is required.

[Connect the finance MCP tools](docs/finance-mcp.md) · [Try the sample-data demo](https://pmsvibe60-creator.github.io/vibePMS/#finance) (Follow the money)

This first release supports bank-backed costs and separate bank reconciliation fields in Twenty. It excludes provider-managed/deposit invoices and does not move money. The shared engine and PostgreSQL/MCP flow are tested; a live Twenty deployment has not yet been verified.

## How it works

| You do (in Twenty) | The system does |
|---|---|
| Create **Unit**, **Person** (tenant), **Lease** (rent, deposit, start date…) | — |
| Set Lease status → **Ready to sign** | Renders the English contract PDF, hashes it, e-mails the tenant a signing link |
| — | Tenant signs (typed name + drawn signature) → landlord gets a countersign link |
| Countersign | Seals PDF with signature page + audit trail (time, IP, UA, SHA-256), e-mails both, Lease → **Signed** |
| — | Creates CasaPay move-in checkout (pro-rated first rent + deposit/guarantee), e-mails tenant; Lease → **Awaiting payment** |
| — | On payment webhook: Lease → **Active**, Unit → Occupied, stores CasaPay agreement + **utility e-mail alias** |
| Forward utility bills (building management, electricity, water…) to the lease's **Utility invoice email** | CasaPay parses & bills the tenant; hourly sync imports them as Invoice type *Utilities* |
| — | Daily 08:05: issues monthly rent invoices (PDF + CasaPay invoice with due date & payment reference) |
| — | Hourly: syncs paid/partial/overdue + payout status; payment failures noted + tenant reminded |

Manual-signed lease? Set status straight to **Signed** — CasaPay activation still runs.

## Data model (Twenty custom objects, provisioned by `pnpm setup`)

- **Unit** — address, apartment no., m², rooms, status, Building management contact, meters, inventory
- **Lease** — unit, tenant (Person), status pipeline, dates, rent, due day, deposit + mode, CasaPay agreement type,
  utilities policy, notice period, language, contract PDF, signing link, CasaPay ids + e-mail alias
- **Invoice** — lease, unit, type (Rent / Move-in / Utilities / Other), status, number, payment reference, period,
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
pnpm test          # payment references, pro-rating, webhook HMAC, PDFs, lease validation
pnpm typecheck
docker compose up -d --build sidecar   # from repo root
```

Contract wording lives in `sidecar/templates/lease.en.md` (Handlebars + minimal markdown) — have it
reviewed by a lawyer before first use.

## Deployment defaults

- English documents and messages; UTC scheduling by default. Set `TZ` for your operating timezone.
- Lease wording is a starter template. Configure notice periods, taxes, deposit terms, governing law, and dispute resolution for your market before use.
- Invoices do not assume a tax exemption or calculate tax. Adapt invoicing before charging taxable amounts.
- The bundled CasaPay integration uses EUR; other currencies and payment providers require integration changes.
- Signing records typed names, drawn signatures, timestamps, and document hashes. Review the signing requirements for your market.
- On existing Twenty workspaces, move building-management data into the new fields and update the contract-language selection to English; schema setup preserves existing fields.
