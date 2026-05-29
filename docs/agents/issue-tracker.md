# Issue tracker: GitHub

Issues and PRDs for this repo live as GitHub issues in `AbuMeryem/salam-stock`. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v` — `gh` does this automatically when run inside a clone. If running from elsewhere, pass `--repo AbuMeryem/salam-stock`.

## When a skill says "publish to the issue tracker"

Create a GitHub issue in `AbuMeryem/salam-stock`.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments` (in the repo) or `gh issue view <number> --comments --repo AbuMeryem/salam-stock`.

## Common labels in this repo

Canonical triage roles (see `triage-labels.md` for the full state machine):

- `needs-triage` — maintainer needs to evaluate
- `needs-info` — waiting on reporter
- `ready-for-agent` — fully specified, AFK-ready
- `ready-for-human` — needs human implementation
- `wontfix` — will not be actioned (already present in repo as GitHub default)

GitHub defaults currently present in the repo (use as type/severity tags):

- `bug` — something isn't working
- `enhancement` — new feature or request
- `documentation` — docs improvement
- `question` — further information requested
- `duplicate` — already exists elsewhere
- `invalid` — doesn't seem right
- `good first issue` — newcomer-friendly
- `help wanted` — extra attention needed

If the triage labels above are missing, create them with `gh label create`:

```bash
gh label create needs-triage      --color "fbca04" --description "Maintainer needs to evaluate" --repo AbuMeryem/salam-stock
gh label create needs-info        --color "d4c5f9" --description "Waiting on reporter"           --repo AbuMeryem/salam-stock
gh label create ready-for-agent   --color "0e8a16" --description "Fully specified, AFK-ready"   --repo AbuMeryem/salam-stock
gh label create ready-for-human   --color "1d76db" --description "Needs human implementation"   --repo AbuMeryem/salam-stock
```

(`wontfix` already exists as a GitHub default.)
