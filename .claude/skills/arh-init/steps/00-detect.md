# Phase 0 — Detect signals

Goal: read what already exists in the repo and decide greenfield vs brownfield.

## Read

- `git status --short` and `git log --oneline -n 20` (commit count is suggestive, NOT decisive — see Classify).
- The **source tree itself**: `src/**`, `app/**`, `lib/**`, `packages/**` — list it (`git ls-files` or a glob) and read a few files. This is the primary signal.
- `harness.yaml` if present (a real `project.description` / domain already set is a brownfield hint).
- Manifest files: `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `pom.xml`, `build.gradle`.
- `tsconfig.json`, `eslint.config.*`, `ruff.toml`, `.editorconfig`.
- `.github/workflows/`, `.gitlab-ci.yml`, `azure-pipelines.yml`.
- Documentation roots: `README*`, `docs/**`, `wiki/**`.
- `docs/prd/*` and `docs/config/domains.json` (if present) — domain, personas, and any stated datastore / auth / compliance / deployment intent. Carry these forward: Phase 1 uses them to auto-fill answers and Phase 4.0 uses them to skip architecture questions already settled.
- `.env.example`, `.env.template` (DO NOT read `.env` itself — blocked by deny rules).

## Classify

The real question: **does meaningful work already exist that the harness must build on top of**, or are we starting from nothing?

**Primary discriminator (decisive) — hand-written code or product docs beyond a fresh generator scaffold:**

- **Brownfield** — the source tree carries real feature code: multiple domain-named modules / components / services / routes, business logic, feature tests. True **even at 1 commit** — teams routinely import an existing app as a single squashed "initial commit". Also brownfield if `docs/` has handwritten product content (PRDs, specs, ADRs you did not generate), or an issue tracker already has a project key with existing issues.
- **Greenfield** — repo is empty, OR contains only a generator's default scaffold (the handful of placeholder files a project generator emits) with no domain code.

**Supporting signals corroborate the primary one — they never override it:**

- Commit history: many commits, or feature-named commits → brownfield. But **few or squashed commits do NOT prove greenfield** (the import case above).
- Dependency count does **NOT** distinguish the two — every generator scaffold pulls a full dependency tree. Ignore it as a discriminator.

**Trap (this caused a real misclassification):** a single generator-style "initial commit" plus a large dependency manifest is NOT proof of greenfield. An old framework version with many feature files is an existing app imported into a fresh repo = **brownfield**. Inspect the source tree contents, not the commit count.

**Decision procedure:**

1. Inspect the source tree. Count source files and look for domain-named feature code beyond the generator's default set.
2. Real feature code present → **brownfield** (regardless of commit count or "initial commit" message).
3. Only the generator scaffold, or empty → **greenfield**.
4. **Ambiguous** (scaffold plus a little code, or you cannot tell scaffold from real code apart) → do NOT guess and do NOT silently override the signals. Phase 0 runs in the main session, so **ask the user**: "Existing app to build on (brownfield) or fresh start (greenfield)?" Use their answer.

## Output

```
SIGNALS
───────
Repo:        <commit count> commits, branch=<current>
Stack:       <detected lang/framework>     (read from the dependency manifest)
Tooling:     typecheck=<tsc|mypy|...>      lint=<eslint|ruff|...>
CI:          <github-actions|gitlab-ci|none>
Docs:        <count> markdown files
Mode:        greenfield | brownfield
```
