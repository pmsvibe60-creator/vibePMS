# Railway deployment

Status: deployment files prepared; a live Railway deployment and reusable template
have not been verified or published yet. There is no working one-click button yet.
This guide is for the first template maintainer. Once tested and saved as a Railway
template, subsequent owners can deploy the same services from its generated URL.

## Create the project

Use an empty Railway project and these exact service names (the variable references
in the adjacent example files depend on them):

- `Postgres`: a Railway PostgreSQL database for Twenty.
- `PmsPostgres`: a separate PostgreSQL database for sidecar state. This avoids needing
  the local Docker initialization script to create another database.
- `Redis`: a Railway Redis database. Use `noeviction` as its max-memory policy;
  preserve the database service's authentication when adjusting its start settings.
- `Twenty`: image `twentycrm/twenty:v2.45.8`.
- `Worker`: the same Twenty image; start command `yarn worker:prod`.
- `Sidecar`: this GitHub repository, root directory `/sidecar`, Dockerfile `Dockerfile`,
  config file path `/sidecar/railway.json` (Railway config paths are repository-relative).

Add a private S3-compatible bucket for Twenty attachments. Copy its bucket name,
region, endpoint and access credentials into the `STORAGE_S3_*` variables.
Twenty and Worker must use the same bucket. Do not give them independent local
volumes: they need access to the same uploaded files.

Attach a persistent volume at `/data` to Sidecar. Keep database volumes provisioned
by Railway. Keep Sidecar and Worker always running with one replica; scheduled jobs
currently run inside Sidecar, so disable service sleeping/serverless mode.

Generate public HTTPS domains for Twenty (target port 3000) and Sidecar (4000).
The other services do not need public endpoints. No Cloudflare account, tunnel,
custom domain, or continuously running personal computer is required.

## Apply configuration

Paste `twenty.env.example`, `worker.env.example`, and `sidecar.env.example` into
their respective service variable editors. These are Railway variable references,
not shell scripts or local dotenv files. Replace every `REPLACE_WITH_...` value.

For an actual project, generate each secret separately with `openssl rand -base64 32`.
Keep Twenty's APP_SECRET and ENCRYPTION_KEY stable across updates; Worker references
the same values. Generate Sidecar's ADMIN_TOKEN separately with `openssl rand -hex 32`.

For image-based services, apply the settings from `twenty.railway.json` and
`worker.railway.json` in the dashboard. Those files document the service settings;
Railway does not automatically load repository files for Docker-image sources.
Sidecar's config file is loaded from its GitHub source.

Allow databases and Twenty to become healthy, then deploy Worker and Sidecar.
Railway does not apply Docker Compose dependency ordering. Sidecar retries its
database migration at startup and uses Railway's restart policy if it still fails.

## Owner setup

1. Open Twenty's generated URL and create the first account/workspace promptly.
   Restrict further workspace registration using the controls supported by the
   pinned Twenty release before sharing the URL.
2. Create a Twenty API key in Settings → APIs & Webhooks and set Sidecar's
   `TWENTY_API_KEY`. With `AUTO_SETUP=true`, its next deployment creates the PMS
   objects and fields before starting the scheduler. Check logs for “Schema up to date.”
   If setup fails, correct the key or connectivity and redeploy; setup is repeatable.
3. Create the Twenty webhook for `<Sidecar PUBLIC_URL>/webhooks/twenty`, selecting
   the lease events used by the PMS. Save its secret as `TWENTY_WEBHOOK_SECRET`.
   The endpoint returns 503 until the secret is present.
4. Fill the `OWNER_*` variables and Sidecar SMTP settings. For Twenty's own account
   emails, set `EMAIL_DRIVER=smtp` and the `EMAIL_SMTP_*`, `EMAIL_FROM_ADDRESS`, and
   `EMAIL_FROM_NAME` variables on Twenty and reference them from Worker too.
5. Connect CasaPay sandbox credentials and register
   `<Sidecar PUBLIC_URL>/webhooks/casapay` for the gateway events. Set
   `CASAPAY_WEBHOOK_SECRET`. Rent jobs only start when both API keys are set.
6. Add the first unit, tenant and draft lease in Twenty. Create status views as
   described in the root README. Test signing, landlord countersigning and sandbox
   payment before entering production credentials.

An interactive setup wizard is not implemented yet. Account creation, integration
credentials, webhook registration and owner details still require these steps.

## Validate before sharing

- Confirm Twenty `/healthz` and Sidecar `/health` succeed. Sidecar health means its
  startup completed; it is not a continuous check of email or payment connectivity.
- Complete a sandbox lease through signing, payment, invoice sync and PDF download.
- Restart/redeploy services and confirm records, attachments and signed PDFs survive.
- Enable and test database and file backups, including the Twenty bucket and `/data`.
- Record observed resource usage and a realistic hosting estimate. This stack runs
  multiple persistent services; do not describe it as free hosting.

## Create the reusable template

After the deployment is verified, use project Settings → Generate Template from
Project. Inspect every exported variable: remove personal details, credentials,
account identifiers and deployment-specific URLs. Keep service references, leave
owner-supplied credentials as inputs, and generate fresh internal secrets per install.
Railway template functions such as `${{secret(64, "abcdef0123456789")}}` generate
unique values at template deployment time; they are not for a normal project editor.

Test the resulting template in a fresh project. Then add its real generated deploy
URL to the root README with Railway's deploy-button image. Do not substitute a plain
GitHub deploy link: it will not provision the full multi-service stack.

The repository must be accessible to template users. Changing its visibility or
publishing the template is a separate release step after checking repository history.

## Upgrades

Back up first, update the pinned Twenty server and worker versions together, and
follow Twenty's upgrade guidance. Keep one Sidecar replica while its scheduler and
PDF volume live in the process. Test upgrades in a separate sandbox project before
applying them to tenant data. Changing domains also requires updating public URL
variables and webhook registrations.

References: [Compose migration](https://docs.railway.com/guides/docker-compose),
[Railway templates](https://docs.railway.com/templates/create),
[volume constraints](https://docs.railway.com/volumes/reference).
