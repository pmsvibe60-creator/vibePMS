# Security policy

## Supported versions

Only the latest preview release receives fixes. This is an early-stage project;
there is no response-time or production-support guarantee.

## Report a vulnerability privately

Use the repository's **Security → Report a vulnerability** button. Private reporting
must be enabled before the repository is opened to the public. Do not open a public
issue with exploit details, credentials, tenant information or contract documents.
Use synthetic records and describe the affected version, impact and reproduction.

Never test against a deployment you do not own or have permission to assess. If
credentials were exposed, revoke or rotate them; deleting a file is not sufficient.

## Deployment boundaries

Use sandbox payments during evaluation. Keep databases private, restrict initial
workspace registration, configure HTTPS for shared deployments, and back up database
and file storage. The signing flow uses simple electronic signatures, not qualified
signatures. Templates and workflows need review for your use case and jurisdiction.
