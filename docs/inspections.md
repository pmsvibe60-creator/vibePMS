# Move-in and move-out inspections

Create a private checklist link for the tenant, or complete the walkthrough together. Both roles can fill the same checklist, attach photos and save progress. Each role confirms the submitted content separately. Once both confirm, its content is locked.

[Try the fictional handover demo](https://pmsvibe60-creator.github.io/vibePMS/inspection-demo.html). It runs in browser memory, provides demo-only role switching and uses the browser's print/save-as-PDF function. It does not send invitations, store a real report or connect to the backend.

## Run the feature

Update and restart the sidecar after the normal repository setup. The migration creates an `inspections` table in PostgreSQL. Configure `PUBLIC_URL` to the HTTPS address of your sidecar, and set a strong `ADMIN_TOKEN`. No Twenty schema changes are required specifically for inspections. Property and lease identifiers link reports logically; this release does not validate those identifiers against Twenty or automatically attach reports to Twenty records.

The existing [finance MCP connection](finance-mcp.md) now also exposes:

- `create_inspection`: property and lease IDs, address, participant names, date, type, mode, checklist and expiry. Requires `approved: true` after explicit operator approval. Returns separate tenant and operator URLs once.
- `list_inspections`: latest 100 report IDs and statuses.
- `revoke_inspection_links`: invalidates both links while preserving the report. Requires explicit approval.

Example prompt:

> Prepare a move-in inspection for Flat 4, 24 Willow Mews on 1 September 2027. Find the correct property and lease IDs in Twenty. Tenant Alex Morgan, operator Sam Parker. Include living-room walls and flooring, kitchen appliances, electricity and water readings, and two sets of keys. We'll complete it together. Show me the checklist before creating links. Keep the operator link private; do not send either link without my instruction.

The same feature is available through authenticated HTTP endpoints. Use an `Authorization: Bearer <ADMIN_TOKEN>` header; never place an admin credential in a URL.

`POST /admin/inspections` accepts:

```json
{
  "property": "Flat 4, 24 Willow Mews, London, UK",
  "propertyId": "YOUR_TWENTY_UNIT_ID",
  "leaseId": "YOUR_TWENTY_LEASE_ID",
  "tenantName": "Alex Morgan",
  "operatorName": "Sam Parker",
  "date": "2027-09-01",
  "kind": "move-in",
  "mode": "together",
  "expiresInDays": 30,
  "checklist": [
    { "room": "Living room", "label": "Walls and floor", "kind": "condition" },
    { "room": "Kitchen", "label": "Oven", "kind": "inventory" },
    { "room": "Hallway", "label": "Electricity reading", "kind": "meter" },
    { "room": "Entrance", "label": "Keys", "kind": "keys" }
  ]
}
```

Choose `tenant-led` or `together`. Both permit contributions through either role's separate link; mode communicates how you plan to perform the inspection, not a different permission model. These are shared drafts with explicit saves and stale-edit rejection, not real-time collaborative editing. Reload the saved version after the other person makes changes.

Use `GET /admin/inspections` to list reports, `GET /admin/inspections/:id` for the retained record, `GET /admin/inspections/:id/report.pdf` to export it, and `POST /admin/inspections/:id/revoke` to invalidate both links. Admin retrieval works after expiry/revocation. Protect the database and admin token accordingly.

## Complete, review and confirm

1. Share only the tenant URL with the tenant. Keep the operator URL separate. No tenant account is required.
2. Complete each item's condition. Enter meter readings with units and key quantities, or explicitly mark an item not applicable. Add comments and flag disagreements.
3. Add PNG/JPEG photos and **Save progress**. The browser converts images to bounded PNG files, reducing resolution and stripping original metadata. Retain original evidence separately if needed. Maximum 100 checklist items and 20 photos, each encoded image at most 400,000 characters and 1600 pixels per dimension; the browser compresses more conservatively. Draft photo additions are not uploaded until saved.
4. Submit for review. Draft content freezes. Both parties can read the same report and download its PDF.
5. Each role types the name shown and acknowledges reviewing the report, including disagreements. The report records the role, self-attested name, UTC timestamp and content SHA-256 hash. It locks after both confirmations. Confirmation is acknowledgement, not resolution of a dispute or authorization to charge.
6. Before both confirmations, the operator can reopen with a reason. This clears prior confirmations and requires both to review and confirm again.

PDFs include checklist content, photos, baseline observations when present, disagreements, confirmation hashes and event history. Each export is rendered from the saved report; the content hash identifies structured report content, not the PDF bytes. PDF generation can produce different bytes on successive exports. Draft exports are labelled DRAFT.

## Move-out and amendments

For a move-out report, set `kind: "move-out"` and `baselineId` to a confirmed move-in report for the same property and lease. The baseline's stable checklist IDs are copied automatically, overriding the submitted checklist. It shows earlier condition, values, comments and photos alongside the new observations. No damages are assessed and no tenant invoice or deposit deduction is created.

For a correction after confirmation, create a report with `amendsId` referencing the confirmed report, with the same property, lease and inspection type. It starts a new draft and retains the prior report unchanged. Its confirmations are independent; the original is not deleted or silently replaced. Review the copied content and explain the correction in general notes. Listing or retrieving an amendment exposes its link to the original; this release does not automatically mark the original superseded.

## Privacy and operational scope

- Links contain 256-bit random tokens in the URL fragment. Requests carry the token in an authorization header; the database stores token hashes. Do not log request bodies, authorization headers or shared URLs in added proxies/analytics.
- Links expire after 1–90 days (30 by default) and can be revoked. There is no link rotation/reissue tool yet. Choose an expiry long enough to finish review; retain admin access to records. Confirmed reports are still retrievable by valid shared links until expiry/revocation.
- Anyone possessing a link can act in its assigned role. These are self-attested acknowledgements, not verified identities or a qualified electronic-signature service. The operator creating links can access both; this is not independent identity proof.
- One trusted workspace per sidecar. There is no per-staff authorization model. The audit history records actions and reasons, not every historical draft's full contents. Confirmed report content and amendment copies are retained.
- Photos and reports are stored in PostgreSQL. Back up that database and establish your own retention and access policy. There is no automated retention deletion or email invitation delivery.
- Creation is not idempotent. After a timeout, inspect the latest report list before retrying.

## Validation

Unit tests cover required fields, stale edits, role-specific confirmation, content hashes, disputes, reopening, immutable confirmation, expiry, image checks, baseline/amendment validation and PDF rendering. PostgreSQL and HTTP integration tests exercise authorization, token hashing, concurrent writes, PDF download and revocation. These run in CI with the disposable finance test database.

The public demo shares the production page and interaction code but uses a simplified fictional backend in browser memory. Run `node scripts/build-inspection-demo.mjs` and `python3 scripts/version-site-assets.py` after changing its source in `sidecar/src/inspections/public`.
