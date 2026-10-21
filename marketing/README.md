# vibePMS launch kit

Editable source assets live in `site/assets/`. PNG exports are ready for sharing.
The downloadable `site/assets/vibepms-launch-kit.zip` includes the graphics, this
usage guide and launch copy. No social posts or messages are sent automatically.

## Included

- `icon.svg` / `icon.png`: square brand mark, 128 × 128.
- `wordmark-dark.svg` / `.png`: dark lettering on a transparent background.
- `wordmark-light.svg` / `.png`: light lettering on a transparent background.
- `social-card.svg` / `.png`: 1200 × 630 landscape card, also used for link previews.
- `social-square.svg` / `.png`: 1080 × 1080 square card.
- `launch-copy.md`: descriptions, social posts, community launch copy and demo outline.

## Brand basics

Write the name **vibePMS**. Use the tagline **Your property management head start.**
The core description is: **An open-source property management starter kit for vibe
coders, built on Twenty CRM. Self-host it, customize it, and make it your own.**

Colors: ink `#242326`, paper `#F8F7F3`, lime `#D8F36A`, lilac `#D9D0F0`.
Use a clean sans-serif typeface with monospace labels. Keep whitespace around the
logo; preserve its proportions. Use the dark wordmark on light backgrounds and
the light wordmark on dark backgrounds.

Original graphics are covered by the repository's MIT license. No third-party logo
or screenshot is included. This project is independent of Twenty and CasaPay.

## Keep claims accurate

Always identify the current release as an early preview. Do not claim production
readiness, guaranteed compliance, qualified signatures, verified end-to-end payments,
a live demo, free hosting or a working one-click Railway template. The artwork is
an illustration, not a screenshot of the operator interface. Hosting and external
services are separate; third-party code retains its own licenses.

## Export and package

Edit the SVG source. With librsvg installed, export PNGs using:

```sh
rsvg-convert site/assets/social-card.svg -o site/assets/social-card.png
```

Repeat for changed assets. Rebuild the downloadable kit from the repository root:

```sh
python3 scripts/package-launch-kit.py
```

The static landing page uses no analytics, cookies, external fonts or application
credentials. GitHub Pages serves it from `site/`; the backend is hosted separately.
