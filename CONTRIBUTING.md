# Contributing

vibePMS is an early public preview. Small, focused pull requests are welcome.
Use Discussions for questions and ideas; use Issues for reproducible bugs and scoped
feature requests. Search for existing reports first. Never include tenant records,
credentials, real contracts, personal identifiers or unredacted logs.

## Development

Use Node.js 22 and the pnpm version pinned in `sidecar/package.json`.

```sh
cd sidecar
corepack enable
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
```

Tests run without production credentials. PDF fixtures are fictional and are not
valid identity records. Keep examples on reserved example.com domains and use
synthetic data. Integration testing requires your own sandbox accounts.

## Pull requests

Open an issue before substantial changes. Link it in the PR, explain the user-visible
change, and record relevant validation. Include regression tests for behavioral fixes.
Update documentation when setup or behavior changes. CI checks types, tests, image
builds and secrets. The maintainer triages new issues before moving work to Ready.

Contributions are accepted under the MIT license. Submit only work you have the right
to contribute and preserve third-party notices. A pseudonym and GitHub-provided
noreply email are welcome; legal names are not required by this project.

## Releases

Preview releases use semantic versions and describe limitations honestly. Do not
claim payment or signing integrations are production-verified without a recorded
sandbox test. See [release checklist](docs/release-checklist.md).
