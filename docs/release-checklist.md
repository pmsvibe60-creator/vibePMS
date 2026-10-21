# Release checklist

## Before the first public release

- [ ] Confirm the final project name, license and ownership of contributed code.
- [ ] Use a new Git history with the maintainer's chosen pseudonym and the exact
      noreply email shown by the new GitHub account. Inspect authors and committers.
- [ ] Inspect every tracked file and generated artifact for credentials, real data,
      personal names, domains, account identifiers and metadata. Scan for secrets.
- [ ] Do not transfer or fork a personal repository as the publication method.
- [ ] Install from a clean checkout and run tests, types and the Docker build.
- [ ] Validate the full sandbox lease lifecycle before claiming it works end-to-end.
- [ ] Enable Issues, Discussions and private vulnerability reporting on GitHub.
- [ ] Enable available secret scanning and push protection.
- [ ] Require CI `test`, `docker`, and `secrets` checks for main; block force pushes
      and deletion. Use pull requests; do not require another reviewer when solo.
- [ ] Create labels, milestones and initial issues from `docs/roadmap.md`.
- [ ] Create a project board: Inbox, Ready, In progress, Done; add initial issues.
- [ ] Publish v0.1.0 as a prerelease with verified checks and known limitations.

## Every release

Check contributor attribution, changes and dependency licenses. Run CI, review
migration/backup implications, and describe untested integrations. Do not attach
local logs, configuration, PDFs containing real data, or credentials. Verify the
GitHub identity before posting issues, replies, releases or packages.

The repository's release automation must not use production deployment credentials.

## GitHub setup helper

After pushing the clean initial commit to a new repository, authenticate `gh` as
the new maintainer account and run:

```sh
python3 scripts/setup-github.py NEW_ACCOUNT/REPOSITORY
```

The helper refuses a different authenticated owner or a fork. It enables Issues,
Discussions and private vulnerability reporting, and creates the six roadmap
issues, labels and milestones. It can be rerun without duplicating those issues.
Branch protection, secret scanning and the project board are configured separately.
