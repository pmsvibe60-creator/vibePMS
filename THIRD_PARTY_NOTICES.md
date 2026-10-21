# Third-party software

The MIT license covers the original code in this repository. It does not relicense
third-party code, container images, fonts, trademarks, or hosted services.

- Twenty CRM is run as a separate service. Its repository is primarily AGPLv3 with
  exceptions; inspect the license shipped with the exact image/version you deploy:
  https://github.com/twentyhq/twenty/blob/main/LICENSE
- PostgreSQL, Redis, Node.js and cloudflared retain their respective licenses.
  Inspect the image contents and upstream notices before redistributing images.
- JavaScript dependencies retain their included licenses. See `docs/dependency-licenses.json` for a package-metadata inventory of this
  preview (including development dependencies); upstream license files remain
  authoritative. Regenerate the inventory when updating dependencies.
- pdfmake supplies embedded font data used to generate PDFs. Preserve the upstream
  font notices when redistributing dependency assets.
- CasaPay is an external service requiring a separate account and applicable terms.
  This project is not endorsed by CasaPay or Twenty.

No Twenty source code or enterprise feature code is included in this repository.
