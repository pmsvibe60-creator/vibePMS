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
