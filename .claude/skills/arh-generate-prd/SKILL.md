---
name: arh-generate-prd
description: Generate a PRD via Q&A interview (5 rounds, domain detection, persistent drafts) or reference-driven mode (reads docs, gap analysis, targeted clarification). Auto-routes on arguments.
argument-hint: "[--resume {slug} | reference-folder-path | reference-file-path]"
disable-model-invocation: true
allowed-tools: Read Write Edit Bash Grep Agent AskUserQuestion
---
You are the **main-thread orchestrator** for PRD generation — handling both Q&A interview mode and reference-driven mode under a single entry point.

**Arguments:** $ARGUMENTS

---

## Overview

```
/arh-generate-prd [--resume {slug} | reference-folder-path | reference-file-path | (no args)]
        ↓
Phase 0 — Route
  • parse $ARGUMENTS
  • determine workflow: "qa" or "reference"
        ↓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Q&A Workflow                   Reference Workflow
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ━━━━━━━━━━━━━━━━━━━━━━━━
Pre-flight                     Pre-flight
New Session Init               New Session Init
  AskUserQuestion (Round 1)      AskUserQuestion (Product Name)
  derive slug                    derive slug
  write draft (workflow_type:    write draft (workflow_type:
    "qa")                          "reference")
Resume Mode — Q&A              Resume Mode — Reference
  load draft / check type        load draft / check type

Rounds 1–5                     File Inventory
  (${CLAUDE_SKILL_DIR}/steps/    (${CLAUDE_SKILL_DIR}/steps/
   qa-round-N.md)                 01-file-inventory.md)

Domain Detection               Phase 1 — Reference Ingestion
                                 @reference-reader-agent

Compile Context Block          Phase 2 — Gap Analysis
  (qa-prd-context-format.md)     @gap-analysis-agent

@domain-research-agent         Phase 3 — Targeted Clarification
  (if domain detected)           (04-clarification-rounds.md)

@create-prd-agent              Phase 4 — PRD Generation
                                 @generate-prd-agent

Verify ≥10 sections            Verify ≥17 sections
Clean Up + Report              Clean Up + Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Phase 0 — Route

### 1. Parse Arguments

Examine `$ARGUMENTS`:

- If it starts with `--resume `: extract the slug (strip the `--resume ` prefix). Set `resume_mode = true`. Proceed to **Load Draft** to determine `workflow_type`.
- If non-empty and does NOT start with `--resume`:
  - Run `stat "$ARGUMENTS" 2>/dev/null` to determine path type.
  - If it is a **directory** (exit 0 and `stat` shows directory): set `workflow = "reference"`, `reference_folder = "$ARGUMENTS"`, `resume_mode = false`.
  - If it is a **file** (exit 0 and `stat` shows regular file): set `workflow = "qa"`, `reference_file = "$ARGUMENTS"`, `resume_mode = false`.
  - If the path does not exist:
    ```
    ERROR: Path not found: {ARGUMENTS}
    Pass a folder path for reference mode, a file path for Q&A mode, or no args to be prompted.
    ```
    Stop.
- If empty (`$ARGUMENTS` is blank):
  - **Step 1 — Check for manifest** (strongest signal: reference mode was previously configured):
    ```bash
    stat docs/reference-material/reference-manifest.json 2>/dev/null && echo "found" || echo "missing"
    ```
    If output is `found`: set `workflow = "reference"`, `reference_folder = "docs/reference-material"`, `resume_mode = false`. **No prompt — proceed directly.**
  - **Step 2 — No manifest: check for any non-hidden files** in the folder:
    ```bash
    find docs/reference-material -maxdepth 1 -type f ! -name ".*" 2>/dev/null | head -1
    ```
    If output is non-empty (files exist but no manifest yet): use `AskUserQuestion`:
    | Header | Question |
    |--------|----------|
    | **PRD Mode** | I found documents in docs/reference-material/. Which workflow would you like? |
    Options:
    - `"Use reference material (extract from docs)"` → set `workflow = "reference"`, `reference_folder = "docs/reference-material"`
    - `"Start Q&A interview (answer questions)"` → set `workflow = "qa"`, `reference_file = "none"`
  - **Step 3 — Nothing found**: set `workflow = "qa"`, `reference_file = "none"`, `resume_mode = false`. No prompt.

### 2. Ensure Directories

```bash
mkdir -p docs/prd docs/prd/.wip
```

---

## Resume Mode — Load Draft

> Execute only when `resume_mode = true`.

```bash
cat "docs/prd/.wip/${SLUG}.json"
```

If the file does not exist:
```
ERROR: No in-progress session found for slug "{slug}".
Available drafts:
```
```bash
ls docs/prd/.wip/*.json 2>/dev/null || echo "(none)"
```
Stop.

### Check workflow_type

Read the `workflow_type` field from the draft JSON.

- If `workflow_type` is `"qa"`: set `workflow = "qa"`. Proceed to **Resume Mode — Q&A**.
- If `workflow_type` is `"reference"`: set `workflow = "reference"`. Proceed to **Resume Mode — Reference**.
- If `workflow_type` is missing or null:
  ```
  ERROR: This draft was created before the combined /arh-generate-prd command.
  Please start a new session — legacy drafts cannot be resumed here.
  ```
  Stop.

---

# Q&A Workflow

> Enter this branch when `workflow = "qa"`.

## Pre-flight (Q&A)

### Validate Reference File (if provided)

If `reference_file` is not `"none"`:
```bash
stat "$reference_file"
```
If the file does not exist, warn the user and set `reference_file = "none"`.

---

## New Session Init (Q&A)

> Execute only when `resume_mode = false`.

Execute **Round 1** per `${CLAUDE_SKILL_DIR}/steps/qa-round-1.md`.

After Round 1, run **Domain Detection** (see section below), then continue.

Execute **Round 2** per `${CLAUDE_SKILL_DIR}/steps/qa-round-2.md`.

Execute **Round 3** per `${CLAUDE_SKILL_DIR}/steps/qa-round-3.md`.

Execute **Round 4** per `${CLAUDE_SKILL_DIR}/steps/qa-round-4.md`.

Execute **Round 5** per `${CLAUDE_SKILL_DIR}/steps/qa-round-5.md`.

Execute **Gap Coverage Phase** per `${CLAUDE_SKILL_DIR}/steps/qa-gap-round.md`.

---

## Resume Mode — Q&A

> Execute only when `workflow = "qa"` and `resume_mode = true`.

### Parse Draft State

From the draft JSON, read these fields into working variables:
- `slug`
- `product_name`
- `detected_domain` (may be `null`)
- `domain_prompt_declined` (default `false`)
- `domain_brief_path` (may be `null`)
- `last_completed_round` (0 if no rounds completed)
- `rounds` object (all answers per round)
- `total_rounds` (default 5)

### Add Contributor

```bash
git config user.name 2>/dev/null || echo "unknown"
```
Add this name to the `contributors` array in the draft if not already present. Write the updated draft back.

### Summarise Completed Work

```
**Resuming PRD: {product_name}** (slug: {slug})

Completed so far:
{For each round where rounds.N.completed == true:}
- Round {N} ({Round Name}): {1-sentence summary derived from that round's answers}

Continuing from Round {last_completed_round + 1} of {total_rounds}.
```

If a detected domain is saved, add: *"Domain detected: **{domain}** — domain-specific questions are active in Rounds 3 and 4."*

Then proceed directly to the first incomplete round.

---

## Domain Detection (Q&A)

> Run immediately after Round 1 completes in a new session, or after loading a resume draft where `detected_domain` is not yet set. Skip entirely if `detected_domain` is already set, OR if `domain_prompt_declined` is `true`, in the draft.

### 1. Check Config File

```bash
stat docs/config/domains.json 2>/dev/null && echo "exists" || echo "missing"
```

If the file is missing or empty (`[]`), go to **Step 1b**. Otherwise continue to Step 2.

### 1b. No Domain Configured — Ask the User

The project has no domain configured yet. Instead of silently producing a generic PRD, ask:

```
AskUserQuestion with header "Domain":
  "This project has no domain configured yet. Does {product_name} operate in a
   regulated or specialized domain that needs domain-specific PRD sections and research?"
  Options:
    - "Healthcare"
    - "Fintech"
    - "SaaS"
    - "None — generic product"
```

(The "Other" option the tool adds automatically covers the remaining bundled domains — defense, retail, edtech, insurance, legaltech, govtech — and any custom domain name. Tell the user in the question body: *"Type a domain name under 'Other' if it's not listed — e.g. defense, retail, edtech, insurance, legaltech, govtech, or a custom name."*)

**If "None — generic product":**
Set `detected_domain = null` and `domain_prompt_declined = true` in the draft. Continue to Round 2. Do not ask again for this draft.

**If a domain name (from the options or typed under "Other"):**

1. Configure the project with that domain:
```bash
harness add domain "{domain name, lowercased}"
```
2. Verify it landed:
```bash
cat docs/config/domains.json
```
   - If the domain now appears in the file → set `detected_domain = {domain name}` directly (the user explicitly chose it — do not rely on signal-count matching). Skip Step 3. Go to Step 4 (Update Draft), then Step 5 (Announce).
   - If `harness add domain` failed (e.g. `harness` CLI not on PATH, or it launched the 5-step custom-domain wizard and needs interactive input it didn't get) → tell the user:
     ```
     Couldn't auto-configure domain "{name}" (harness add domain failed — see output above).
     You can configure it manually later with `harness add domain {name}` and re-run /arh-generate-prd.
     Continuing with a generic PRD for now.
     ```
     Set `detected_domain = null` and `domain_prompt_declined = true`. Continue to Round 2.

### 2. Read Domain Config

```bash
cat docs/config/domains.json
```

### 3. Match Signals

For each domain in the config array, count how many of its `signals` appear in the combined text of Round 1 answers (product_name + problem + business_goal). Use case-insensitive substring matching.

**Scoring rules:**

a. **Exactly 1 domain has 2+ signal matches** → auto-select that domain.

b. **2+ domains each have 2+ matches** → check the gap:
   - `gap = (top score) − (second score)`
   - If `gap >= 3` → auto-select the top domain
   - If `gap <= 2` → ambiguous → ask:
     ```
     AskUserQuestion with header "Domain":
       "I detected signals for multiple domains:
        • {domain1} ({N1} signals matched: {matched signals})
        • {domain2} ({N2} signals matched: {matched signals})
        Which best describes your product?"
       Options: [domain1], [domain2], "Neither — treat as a general product"
     ```

c. **Fewer than 2 signals match any domain** → proceed to pinned-domain check.

**Pinned-domain fallback:**

If `detected_domain` is still null after signal matching:
- Scan domains.json for any entry where `signals` is `[]`.
- If exactly one such entry → set `detected_domain` = that domain's name.
- If multiple empty-signals entries → use the first one; output: *"Multiple domains have no signals — using '{first}'. Add signals to disambiguate."*
- If none → `detected_domain` stays null.

### 4. Update Draft

Rewrite the draft JSON with:
- `detected_domain = {matched domain name | null}`
- `updated_at` = current timestamp

### 5. Announce (if domain detected)

Read the `key_concerns` list for the detected domain.

If `key_concerns` is non-empty:
```
**Domain detected: {domain}**
I've identified this as a {domain} product. I'll include domain-specific questions in Rounds 3 and 4, covering {key_concern[0]} and {key_concern[1]}. The total round count remains 5.
```

If `key_concerns` is empty:
```
**Domain detected: {domain}**
I've identified this as a {domain} product. I'll include domain-specific questions in Rounds 3 and 4, covering concerns discovered via domain research. The total round count remains 5.
```

---

## Compile Context Block (Q&A)

After all 5 rounds are complete, read the final draft and compile the context block following the schema in `${CLAUDE_SKILL_DIR}/steps/qa-prd-context-format.md`. Include only fields that have values — omit empty sections.

---

## Invoke Domain Research Agent (Q&A)

> Skip if `detected_domain = null` or if `domain_brief_path` is already non-null in the draft.

If `detected_domain` is not null:

1. Read the matching domain profile:
```bash
cat docs/config/domains.json
```
Extract the entry where `domain` matches `detected_domain`.

2. Announce: *"Running domain research for **{domain}** — this may take a moment..."*

3. Invoke `@domain-research-agent` via the Agent tool. Pass as the prompt:
   - Domain name: `{detected_domain}`
   - Domain profile fields: key_concerns, web_searches, special_sections, required_knowledge
   - Product name: `{product_name}`
   - Problem statement: `{rounds.1.answers.problem}`
   - Slug: `{slug}`
   - Date: today's date
   - Domain brief format path: `${CLAUDE_SKILL_DIR}/steps/qa-domain-brief-format.md`

   > IMPORTANT: Do NOT pass `isolation: "worktree"` when invoking this agent.

4. After the agent returns, verify:
```bash
stat "docs/prd/.wip/{slug}-domain-brief.md" 2>/dev/null && echo "ok" || echo "missing"
```

5. If the file exists: update draft — `domain_brief_path = "docs/prd/.wip/{slug}-domain-brief.md"`, `updated_at`.
6. If missing: warn — *"Domain research did not produce a brief. The PRD will use generic sections for {domain}."* Set `domain_brief_path = "none"`.

---

## Invoke PRD Agent (Q&A)

Announce: *"All rounds complete — writing your PRD now..."*

> IMPORTANT: Do NOT pass `isolation: "worktree"` when invoking this agent.

Invoke `@create-prd-agent` via the Agent tool. Pass as the prompt:
- The full `=== PRD CONTEXT ===` block compiled above
- `domain_brief_path`: the domain brief file path, or `"none"`
- `reference_file`: the validated reference file path, or `"none"`
- `date`: today's date
- `prd_structure_path`: `${CLAUDE_SKILL_DIR}/steps/qa-prd-structure.md`
- `context_format_path`: `${CLAUDE_SKILL_DIR}/steps/qa-prd-context-format.md`
- `template_path`: `${CLAUDE_SKILL_DIR}/full-prd-template.md`

---

## Verify Output (Q&A)

```bash
SLUG="{slug}"
if [[ ! -f "docs/prd/${SLUG}.md" ]]; then
  echo "ERROR: create-prd-agent did not write docs/prd/${SLUG}.md"
  exit 1
fi
grep -c "^## " "docs/prd/${SLUG}.md"
```

If fewer than 17 sections, warn the user the PRD may be incomplete and suggest re-running or manually expanding short sections.

---

## Clean Up Draft (Q&A)

```bash
SLUG="{slug}"
rm "docs/prd/.wip/${SLUG}.json"
rm -f "docs/prd/.wip/${SLUG}-domain-brief.md"
```

---

## Report to User (Q&A)

```
## PRD Generated — {Product Name}

**File:** docs/prd/{slug}.md
**Sections:** {N} sections written
**Domain:** {detected_domain — or "none (generic PRD)"}
**Reference used:** {reference file path or "none"}

### Review Checklist
- [ ] Read sections marked `<!-- AI-drafted: review required -->` — these need human verification
- [ ] Fill in any `{TBD}` placeholders (missing targets, unresolved owners)
- [ ] Confirm success metrics have numeric targets and a named owner
- [ ] Confirm open questions have a named owner and a target resolution date
- [ ] Obtain PO / stakeholder approval (sign the Approvers table at the top)
```
If domain sections were appended, add:
```
- [ ] Validate domain-specific sections ({list section names}) with your legal and compliance team — AI-generated content
```

```
### To resume this PRD in a new session
  /arh-generate-prd --resume {slug}

### Next Steps
Once approved, kick off the pipeline:
  /arh-intake-requirement docs/prd/{slug}.md
```

---

# Reference Workflow

> Enter this branch when `workflow = "reference"`.

## Pre-flight (Reference)

### Validate Reference Folder (new session only)

```bash
stat "$reference_folder" 2>/dev/null && echo "exists" || echo "missing"
```

If missing:
```
ERROR: Reference folder not found: {reference_folder}
Expected location: docs/reference-material (default) or pass a path as the first argument.
```
Stop.

---

## New Session Init (Reference)

Get git user and timestamp:
```bash
git config user.name 2>/dev/null || echo "unknown"
date -u +"%Y-%m-%dT%H:%M:%SZ"
```

Ask for product name:

Use `AskUserQuestion`:
| Header | Question |
|--------|----------|
| **Product Name** | What is the product or feature name? Give it a one-sentence description — what it does and for whom. |

Derive slug and all path variables:
```bash
SLUG=$(echo "{product_name}" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/-\+/-/g' | sed 's/^-//;s/-$//')
echo "slug=${SLUG}"
echo "draft_path=docs/prd/.wip/${SLUG}.json"
echo "output_path=docs/prd/${SLUG}.md"
echo "extraction_path=docs/prd/.wip/${SLUG}-extraction.json"
echo "gaps_path=docs/prd/.wip/${SLUG}-gaps.json"
```

Write `docs/prd/.wip/{slug}.json` per the schema in `${CLAUDE_SKILL_DIR}/steps/00-draft-state-format.md`:
- `workflow_type`: `"reference"`
- `status`: `"in_progress"`
- `reference_folder`: `{reference_folder}`
- `last_completed_phase`: 0
- `clarification_rounds_completed`: 0
- `clarification_answers`: `{}`

Output: *"Got it — starting PRD generation for **{Product Name}** from {reference_folder}."*

---

## Resume Mode — Reference

> Execute only when `workflow = "reference"` and `resume_mode = true`.

### Parse Draft State

Read from the draft JSON into working variables:
- `slug`, `product_name`, `reference_folder`
- `last_completed_phase` (0–4)
- `extraction_path`, `gaps_path`, `manifest_path`
- `clarification_answers`
- `clarification_rounds_completed`

Derive path variables from slug:
```bash
SLUG="{slug}"
echo "draft_path=docs/prd/.wip/${SLUG}.json"
echo "output_path=docs/prd/${SLUG}.md"
echo "extraction_path=docs/prd/.wip/${SLUG}-extraction.json"
echo "gaps_path=docs/prd/.wip/${SLUG}-gaps.json"
```

### Add Contributor

```bash
git config user.name 2>/dev/null || echo "unknown"
```
Add to `contributors` if not already present. Write draft back.

### Summarise Completed Work

```
**Resuming generate-prd: {product_name}** (slug: {slug})

Completed phases:
{For each phase 1–{last_completed_phase}: "• Phase {N} — {phase name}: complete"}

Continuing from Phase {last_completed_phase + 1}.
```

Skip to the first incomplete phase.

---

## File Inventory (Reference)

Execute the full file inventory procedure defined in `${CLAUDE_SKILL_DIR}/steps/01-file-inventory.md`.

After inventory, update draft: `manifest_path = "{reference_folder}/reference-manifest.json"`.

---

## Phase 1 — Reference Ingestion

> Skip if `last_completed_phase >= 1`.

Announce: *"**Phase 1 — Reading reference material...** ({N} files)"*

Invoke `@reference-reader-agent` via the Agent tool. Pass as the prompt:
- Reference folder: `{reference_folder}`
- Classified file list from inventory (file path, type, category_id for each file)
- Slug: `{slug}`
- Instructions path: `${CLAUDE_SKILL_DIR}/steps/02b-extract-content.md`
- Schema path: `${CLAUDE_SKILL_DIR}/steps/02a-extraction-format.md`

> IMPORTANT: Do NOT pass `isolation: "worktree"` when invoking this agent.

After agent returns, verify:
```bash
stat "{extraction_path}" 2>/dev/null && echo "ok" || echo "missing"
```

If missing:
```
ERROR: reference-reader-agent did not produce the extraction file.
Check that all files in {reference_folder} are readable and supported formats are available.
```
Stop.

Update draft: `extraction_path = {extraction_path}`, `last_completed_phase = 1`, `updated_at`.

---

## Phase 2 — Gap Analysis

> Skip if `last_completed_phase >= 2`.

Announce: *"**Phase 2 — Analyzing gaps against PRD template...**"*

Invoke `@gap-analysis-agent` via the Agent tool. Pass as the prompt:
- Extraction path: `{extraction_path}`
- Gaps output path: `{gaps_path}`
- Instructions path: `${CLAUDE_SKILL_DIR}/steps/03-gap-analysis.md`

> IMPORTANT: Do NOT pass `isolation: "worktree"` when invoking this agent.

After agent returns, verify:
```bash
stat "{gaps_path}" 2>/dev/null && echo "ok" || echo "missing"
```

If missing:
```
ERROR: gap-analysis-agent did not produce the gap report.
```
Stop.

Read the gap report. Surface the summary to the user:

```
**Gap analysis complete**
  FILLED:    {N} sections
  PARTIAL:   {N} sections
  MISSING:   {N} sections
  Overall:   {%} complete from reference material
```


Update draft: `gaps_path = {gaps_path}`, `last_completed_phase = 2`, `updated_at`.

---

## Phase 3 — Targeted Clarification

> Skip if `last_completed_phase >= 3`.

Update draft: `status = "clarifying"`, `updated_at`.

Execute the clarification loop defined in `${CLAUDE_SKILL_DIR}/steps/04-clarification-rounds.md`.

After clarification completes, update draft:
- `clarification_rounds_completed` = rounds run
- `clarification_answers` = all collected answers (including `{TBD}` for unresolved gaps)
- `last_completed_phase = 3`
- `updated_at`

---

## Phase 4 — PRD Generation

> Skip if `last_completed_phase >= 4`.

Update draft: `status = "generating"`, `updated_at`.

Announce: *"**Phase 4 — Writing PRD...**"*

Invoke `@generate-prd-agent` via the Agent tool. Pass as the prompt:
- Template path: `${CLAUDE_SKILL_DIR}/full-prd-template.md`
- Extraction path: `{extraction_path}`
- Draft path: `{draft_path}`
- Output path: `{output_path}`
- Today's date
- Instructions path: `${CLAUDE_SKILL_DIR}/steps/05-prd-generation.md`

> IMPORTANT: Do NOT pass `isolation: "worktree"` when invoking this agent.

Update draft: `last_completed_phase = 4`, `status = "complete"`, `updated_at`.

---

## Verify Output (Reference)

```bash
if [[ ! -f "{output_path}" ]]; then
  echo "ERROR: generate-prd-agent did not write {output_path}"
  exit 1
fi
grep -c "^## " "{output_path}"
```

If fewer than 17 sections, warn the user that the PRD may be incomplete. Expected: Executive Summary + §1–§15 + Appendix = 17 `##` headings minimum.

---

## Clean Up Draft (Reference)

```bash
rm "{draft_path}"
rm -f "{extraction_path}"
rm -f "{gaps_path}"
```

---

## Report to User (Reference)

```
## PRD Generated — {Product Name}

**File:** {output_path}
**Sections:** {N} sections written
**Reference folder:** {reference_folder}
**Source files read:** {N}
**Clarification rounds:** {N} ({M} questions answered, {K} marked {TBD})

### Review Checklist
- [ ] Read all sections marked `<!-- AI-drafted: review required -->` — these need human verification
- [ ] Fill in all `{TBD}` placeholders (targets, owners, dates)
- [ ] Confirm success metrics have numeric targets and a named owner
- [ ] Confirm open questions have a named owner and target resolution date
- [ ] Validate **Compliance & Regulatory Requirements** and **Security & Privacy** sections with your legal and security teams
- [ ] Obtain PO / stakeholder approval (sign the Approvers table at the top)

### To resume this PRD in a new session
  /arh-generate-prd --resume {slug}

### Next Steps
Once approved, kick off the pipeline:
  /arh-intake {output_path}
```

---

## Adaptive Behavior Rules

Apply throughout the entire workflow:

1. **Never re-ask an answered question** — check the draft before every round. If an answer exists, skip that question even in a new session.
2. **Skip Q&A rounds silently when fully answered** — output `(Round {N} skipped — already complete)` and continue.
3. **One `AskUserQuestion` call per batch of ≤4 questions** — rounds with 5+ questions require multiple calls.
4. **Write Q&A draft after every completed round** — never after individual questions.
5. **Domain injection cap** — never inject more than 2 domain-specific questions per round.
6. **Conflict on resume (Q&A)** — if a resume session provides a different answer to an already-answered question, surface the conflict and write only the confirmed answer.
7. **Progress signal format** — always open a Q&A round with `**Round {N} of {total} — {Round Name}**`.
8. **Never assume (Reference)** — if content is not in the reference material or clarification answers, it becomes `{TBD}`. No exceptions.
9. **Never re-ask answered questions (Reference)** — check `clarification_answers` before every clarification round.
10. **Phase resumability (Reference)** — always check `last_completed_phase` before executing any phase. Completed phases are never re-run.
11. **Manifest is the source of truth (Reference)** — if a file is in the manifest but missing from disk, follow the required/optional rules exactly.
12. **Extraction errors are hard stops (Reference)** — an unreadable file in a required category stops the skill.
