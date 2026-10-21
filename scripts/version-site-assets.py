#!/usr/bin/env python3
"""Give local CSS and JS URLs content versions before publishing static pages."""
from hashlib import sha256
from pathlib import Path
import re
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

site = Path(__file__).resolve().parents[1] / 'site'
attribute = re.compile(r'\b(href|src)=([' + "\"'" + r'])([^\"\']+)\2')


def version_asset(match, page):
    attr, quote, value = match.groups()
    url = urlsplit(value)
    if url.scheme or url.netloc or not url.path.endswith(('.css', '.js')):
        return match.group(0)
    asset = (page.parent / url.path).resolve()
    if not asset.is_relative_to(site.resolve()) or not asset.is_file():
        raise ValueError(f'Missing local asset in {page.name}: {value}')
    digest = sha256(asset.read_bytes()).hexdigest()[:12]
    query = [(k, v) for k, v in parse_qsl(url.query) if k != 'v']
    query.append(('v', digest))
    versioned = urlunsplit((url.scheme, url.netloc, url.path, urlencode(query), url.fragment))
    return f'{attr}={quote}{versioned}{quote}'


for page in sorted(site.rglob('*.html')):
    source = page.read_text()
    updated = attribute.sub(lambda match: version_asset(match, page), source)
    if updated != source:
        page.write_text(updated)
        print(f'Updated asset versions: {page.relative_to(site)}')
