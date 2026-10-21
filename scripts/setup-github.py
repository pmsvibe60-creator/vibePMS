#!/usr/bin/env python3
"""Configure an existing repository using the explicitly named maintainer account.

Usage: python3 scripts/setup-github.py NEW_ACCOUNT/REPOSITORY
Requires gh authentication as NEW_ACCOUNT. Does not create or publish a repository.
"""
import json
from pathlib import Path
import re
import subprocess
import sys
from urllib.parse import quote


def api(endpoint, method='GET', payload=None):
    args = ['gh', 'api', endpoint, '--method', method]
    if payload is not None:
        args += ['--input', '-']
    result = subprocess.run(args, input=json.dumps(payload) if payload is not None else None,
                            text=True, capture_output=True, check=True)
    return json.loads(result.stdout) if result.stdout.strip() else None


def pages(endpoint):
    values = []
    page = 1
    while True:
        separator = '&' if '?' in endpoint else '?'
        batch = api(f'{endpoint}{separator}per_page=100&page={page}')
        values.extend(batch)
        if len(batch) < 100:
            return values
        page += 1


def main():
    if len(sys.argv) != 2 or not re.fullmatch(r'[A-Za-z0-9-]+/[A-Za-z0-9_.-]+', sys.argv[1]):
        raise SystemExit('Usage: python3 scripts/setup-github.py NEW_ACCOUNT/REPOSITORY')
    repo = sys.argv[1]
    owner = repo.split('/')[0]
    current = api('user')['login']
    if current.lower() != owner.lower():
        raise SystemExit('Stopped: authenticated account does not match the requested owner.')
    base = f'repos/{repo}'
    metadata = api(base)
    if metadata['fork']:
        raise SystemExit('Stopped: publish from a fresh repository, not a fork.')
    if metadata['default_branch'] != 'main':
        raise SystemExit('Stopped: this setup expects an existing main branch.')
    seed = json.loads((Path(__file__).resolve().parents[1] / '.github/seed.json').read_text())
    api(base, 'PATCH', {'has_issues': True, 'has_discussions': True,
                       'delete_branch_on_merge': True, 'allow_squash_merge': True})
    api(f'{base}/private-vulnerability-reporting', 'PUT')
    labels = {item['name'] for item in pages(f'{base}/labels')}
    for label in seed['labels']:
        endpoint = f"{base}/labels/{quote(label['name'], safe='')}" if label['name'] in labels else f'{base}/labels'
        api(endpoint, 'PATCH' if label['name'] in labels else 'POST', label)
    milestones = {item['title']: item['number'] for item in pages(f'{base}/milestones?state=all')}
    for title in seed['milestones']:
        if title not in milestones:
            milestones[title] = api(f'{base}/milestones', 'POST', {'title': title})['number']
    existing = {item['title'] for item in pages(f'{base}/issues?state=all') if 'pull_request' not in item}
    for item in seed['issues']:
        if item['title'] in existing:
            continue
        payload = dict(item)
        payload['milestone'] = milestones[seed['milestones'][item['milestone']]]
        api(f'{base}/issues', 'POST', payload)
    print('Configured Issues, Discussions, private reporting, labels, milestones and initial issues.')
    print('Next: enable main protection and secret scanning; create the project board. See docs/release-checklist.md.')


if __name__ == '__main__':
    try:
        main()
    except subprocess.CalledProcessError as error:
        print(error.stderr, file=sys.stderr)
        raise SystemExit('GitHub request failed; completed operations are safe to rerun.')
