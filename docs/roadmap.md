# Roadmap

Labels: bug, enhancement, documentation, needs-info, good first issue, help wanted.
Workflow: Inbox → Ready → In progress → Done. Triage new reports before scheduling.
Questions belong in Discussions; exploitable vulnerabilities use private reports.

## v0.1.0 — public preview

- **Validate clean Docker installation** (bug): start from a fresh machine/volume,
  record versions, verify health and schema setup without existing local state.
- **Verify CasaPay sandbox lifecycle** (enhancement): signing, countersigning,
  activation, payment webhook, monthly invoice and status sync with synthetic data.
  Record failures and expected retry behavior without publishing credentials.
- **Add demo walkthrough** (documentation, good first issue): one fictional unit,
  tenant and lease; sanitized screenshots and explicit sandbox-only instructions.

## v0.2.0 — reliable self-hosting

- **Validate Railway deployment and reusable template** (enhancement): follow the
  deployment guide, verify storage after restart and publish a sanitized template
  only after a fresh deployment succeeds.
- **Document and test backup restoration** (documentation, help wanted): restore
  both databases, Twenty attachments and sidecar files into an isolated deployment.
- **Integration regression coverage** (enhancement, help wanted): exercise duplicate
  webhooks, payment failures and scheduler retries without external live accounts.

These are planned tasks, not claims of completed integration validation.
