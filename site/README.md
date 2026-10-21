# Landing page

Static GitHub Pages site; no build or runtime dependencies. Application services are
not deployed by this site. Assets use relative paths for the `/vibePMS/` project URL.

Preview locally from the repository root with `python3 -m http.server 8765 --directory site`.
The public URL is https://pmsvibe60-creator.github.io/vibePMS/ once Pages is deployed.
Enable GitHub Pages with **GitHub Actions** as the source. Changes to `site/` on
`main` trigger `.github/workflows/pages.yml`. The workflow uploads only `site/`.

Edit launch copy in `marketing/`, graphics in `site/assets/`, and regenerate the
launch ZIP with `python3 scripts/package-launch-kit.py` after changes. The PNG social
card is used by Open Graph and Twitter/X metadata. Keep metadata URLs in sync if
the repository owner or name changes.

## Feature demonstrations

The homepage's feature tabs are scripted product concepts, controlled by
`offer-demo.js`: a private rental offer, a recurring invoice schedule, and a
sample bill-to-expense workflow. They do not call AI, upload files, or modify CRM
records. `offer-demo.html` is the standalone fictional tenant landing page;
`offer-preview.js` simulates its steps and brand-colour switches. Keep the demo
labels and fictional-data notices visible. GBP examples do not imply GBP support
in the current payment integration.

Before publishing, the Pages workflow runs `scripts/version-site-assets.py` to
attach content hashes to local stylesheet and script URLs in every HTML page.
This prevents an updated page from using older cached CSS or JavaScript. Run the
same script after local asset changes to refresh the checked-in URLs.
