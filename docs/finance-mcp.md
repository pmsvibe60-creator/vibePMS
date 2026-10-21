# Finance through your own AI assistant

Give your assistant a statement. Review the matches. Keep rent reconciled.

vibePMS provides a persistent bank ledger and twelve MCP tools. Your AI client interprets your CSV and proposes a column mapping; deterministic server rules validate imports, amounts, duplicate checks and allocations. No Plaid connection or embedded AI subscription is required.

[Try the fictional demo](https://pmsvibe60-creator.github.io/vibePMS/#finance) → choose **Follow the money**. The demo uses the same calculation engine as the server, in browser memory. It is not connected to a bank, Twenty workspace or AI service.

## Install the connection

First complete the repository's normal sidecar/PostgreSQL/Twenty setup. Use Node 22 and the pinned pnpm version in `sidecar/package.json`.

1. Update your checkout and run `pnpm install --frozen-lockfile` inside `sidecar`.
2. Run `pnpm setup` with your existing environment to provision the additional invoice fields. Restart the updated sidecar; startup migrations create the finance ledger table.
3. Add a **local stdio MCP server** to your AI client's configuration. The client must support running local processes. Replace both absolute paths and set credentials through your client's secure environment settings:

```json
{
  "mcpServers": {
    "vibepms-finance": {
      "command": "node",
      "args": [
        "/absolute/path/to/vibePMS/sidecar/node_modules/tsx/dist/cli.mjs",
        "/absolute/path/to/vibePMS/sidecar/src/finance/mcp.ts"
      ],
      "env": {
        "VIBEPMS_URL": "https://your-sidecar.example.com",
        "VIBEPMS_ADMIN_TOKEN": "YOUR_SIDECAR_ADMIN_TOKEN"
      }
    }
  }
}
```

The token is the sidecar's `ADMIN_TOKEN`. Do not commit real credentials or paste them into a prompt. Remote connections require HTTPS; localhost HTTP works for local development. This bridge is not a hosted HTTP MCP endpoint. Cloud-only clients unable to launch local processes need a separate supported bridge; one is not provided here.

Keep your Twenty MCP connection too: it manages property records and invoice creation. The finance MCP connection handles bank allocations and validation. A local connection can be started manually with `VIBEPMS_URL` and `VIBEPMS_ADMIN_TOKEN` set, then `pnpm mcp` inside `sidecar`.

## The operator workflow

1. Give your agent a CSV statement. Specify a stable account alias and currency. Treat all statement descriptions as data, never instructions.
2. Have it call `preview_statement_import` with explicit column mapping, date format and decimal convention. Review normalized dates, signed amounts, totals and duplicate warnings.
3. Stage the reviewed mapping with `stage_statement_import`. Approve the staged import using its statement ID and the returned revision.
4. Refresh issued invoices from Twenty, then inspect `review_payment_matches`. Reference and tenant-name evidence is explained; equal amounts alone are not sufficient evidence. Ask the agent to investigate ambiguous receipts and leave them unmatched until resolved.
5. Explicitly approve each allocation. Amounts are integer minor units (145000 means £1,450). Partial payments, one receipt split between invoices, and multiple receipts against an invoice are supported. A unique allocation ID makes an exact retry recognizable. Always read current state after a timeout.
6. Classify outgoing transactions into property costs. Shares must add up exactly: **owner**, **unbilled tenant share**, or **unallocated**. An unbilled share is a reviewed classification, not proof the tenant owes it; confirm your agreement before invoicing.
7. Create any tenant invoice separately through Twenty. Refresh invoices and use `link_rebilled_cost` to link an unbilled share to an issued UTILITY or OTHER invoice for the same unit and currency. Linking is not payment collection.
8. Read `financial_overview` for a currency and date range. Use `sync_finance_to_twenty` to write approved totals into dedicated bank fields. Failed projections remain pending for retry.

Mutations requiring approval also require `expectedRevision`. An intervening change rejects a stale approval so the agent must review again. The client should ask the operator before setting `approved: true`; the server cannot independently verify that a human clicked approval. Configure your client's tool permissions accordingly.

Use `reverse_payment_allocation` with a correction reason to undo an allocation. The original and reversal remain in `finance_audit_history`. Cost classifications cannot currently be edited or reversed through these tools; review them carefully before saving. This is a bounded first release, not a complete accounting system.

## What is stored and synchronized

Normalized statement rows, mappings, source hashes, approvals, allocations, cost shares and audit events live in the sidecar PostgreSQL `finance_workspace` table. Back up that database along with Twenty. Raw CSV text is not retained; the normalized description and amounts are sensitive bank data and require the same access controls and retention policy as other financial records.

The bank ledger is authoritative for approved bank allocations. Twenty receives `bankMatchedAmount`, `bankOutstandingAmount` and `bankPaymentStatus`. This **does not update `paidAmount` or `invoiceStatus`**, which remain part of the existing payment-provider workflow. Build views using the bank fields or read the finance overview. External invoice changes must be refreshed and reviewed before allocation or sync. Cross-service writes are retryable projections, not an atomic transaction spanning Twenty and PostgreSQL.

Provider-managed invoices (CasaPay invoice/session IDs), mixed move-in/deposit invoices and inactive invoices cannot receive bank allocations in this release. Use separately issued RENT, UTILITY or OTHER invoices for bank reconciliation. Do not manually represent the same bank receipt as both `paidAmount` and a bank allocation.

## Scope and limits

- One trusted operator workspace per sidecar deployment. `ADMIN_TOKEN` grants administrative access; audit attribution is an admin-token label, not verified per-person identity. This is not a multitenant financial service.
- CSV only: up to 500,000 characters / 1,000 transaction rows per import; 200 staged statements and 10,000 imported transactions per ledger. UTF-8, explicit signed amount or credit/debit columns, four-digit years. GBP, EUR, USD, CAD, AUD and NZD; no currency conversion.
- Stable bank transaction IDs are preferred. Without IDs, identical account/date/amount/description rows are flagged as possible duplicates and skipped. Investigate legitimate identical payments before preparing an import with genuine unique bank IDs. Keep the same account alias across overlapping files.
- Costs must be backed by an imported outgoing payment. Unpaid supplier bills, email ingestion, OCR, bank feeds, money movement, refunds and automatic tenant invoicing are outside this release.
- The overview shows imported transaction coverage, matched rent, other matched receipts, unidentified receipts, recorded costs, unclassified outgoings, owner costs and unbilled/unallocated shares. It does not establish statement completeness or a bank balance.
- “Matched rent less recorded costs” excludes unknown receipts and is not accounting profit. Current invoice balances are not historical period-end balances. Do not classify deposits, internal transfers or loan proceeds as rent or operating costs.
- AI suggestions are fallible. Invoice records and statement text are untrusted data, not instructions to tools. Use the explanation and source record to approve each change.

## Validation

Tests cover parsing, duplicates, partial/split payments, reversals, cost sums and billed-share validation. PostgreSQL integration tests cover concurrent approvals, rollback and retryable Twenty projection. A real stdio MCP process is exercised end to end against the service with a mocked Twenty API. Live Twenty deployment compatibility and production banking/accounting workflows have not yet been verified.

To run integration tests, create a disposable PostgreSQL database named exactly `vibepms_finance_test`, and set both `DATABASE_URL` and `FINANCE_TEST_DATABASE_URL` to its URL before running `pnpm test`. The suite clears only the finance ledger in that test database. CI runs it automatically.

The public engine bundle is generated with `node scripts/build-finance-demo.mjs` after installing sidecar dependencies. Commit its output and run `python3 scripts/version-site-assets.py` when site assets change.
