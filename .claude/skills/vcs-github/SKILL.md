---
name: vcs-github
description: GitHub VCS operations — PR creation, status checks, releases. Uses gh CLI plus the GitHub MCP server.
when_to_use: Opening PRs, fetching PR diffs / metadata, or triggering releases.
user-invocable: false
allowed-tools: Bash mcp__github__*
---
# VCS — GitHub

Required env: `GITHUB_TOKEN` (or run via `gh auth login` for the local user).

## Operations

<!-- Harness scaffold: integration=github (vcs) -->

- Open PR → `gh pr create --title "..." --body-file body.md`
- Fetch PR → `gh pr view <num> --json title,body,headRefName,files`
- Diff → `gh pr diff <num>`
- Checks → `gh pr checks <num>`
- Release → `gh release create v<X> --notes-file CHANGELOG.md`

## PR body convention

No PR template exists in this repository (no `.github/PULL_REQUEST_TEMPLATE.md` or
`docs/**/PULL_REQUEST_TEMPLATE.md` found). There is no project-specific mandatory section
format to follow. Until one is added, write PR bodies as plain prose/checklists covering
what changed and why, and use the `## Carry-forward` section convention from
`.claude/rules/surgical-changes.md` for out-of-scope issues noticed during the change.

## Branch protection

This project has no local Git repository (`.git`) and no `.github/` directory — there is no
GitHub remote configured, no CI workflow files, no CODEOWNERS file, and no `gh` CLI installed
in this environment. Consequently there is no branch protection, required-check, or merge
strategy configuration to report: none currently exists. `CLAUDE.md` declares `VCS: github`
and `CI: github-actions`, but neither has been wired up yet. Before any of the `gh`-based
operations above can run, this repo needs: `git init` (or a clone of the intended GitHub
repo), a `git remote` pointing at GitHub, `gh auth login` (or a `GITHUB_TOKEN`), and — if
CI/branch-protection rules are wanted — `.github/workflows/` files and repository settings
configured on GitHub itself. Do not assume `main`/`master` naming, required status checks, or
a squash/merge/rebase policy until an actual GitHub repo exists and its settings can be read.
