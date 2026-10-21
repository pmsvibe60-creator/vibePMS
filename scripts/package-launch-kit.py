#!/usr/bin/env python3
"""Package the public launch graphics and copy, without local or application files."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
assets = root / 'site/assets'
with ZipFile(assets / 'vibepms-launch-kit.zip', 'w', ZIP_DEFLATED) as archive:
    for stem in ['icon', 'wordmark-dark', 'wordmark-light', 'social-card', 'social-square']:
        for ext in ['svg', 'png']:
            path = assets / f'{stem}.{ext}'
            archive.write(path, f'vibepms-launch-kit/{path.name}')
    for name in ['README.md', 'launch-copy.md']:
        archive.write(root / 'marketing' / name, f'vibepms-launch-kit/{name}')
    for path in sorted((root / 'site/prompts').glob('*.txt')):
        archive.write(path, f'vibepms-launch-kit/prompts/{path.name}')
    archive.write(root / 'LICENSE', 'vibepms-launch-kit/LICENSE')
print('Packaged site/assets/vibepms-launch-kit.zip')
