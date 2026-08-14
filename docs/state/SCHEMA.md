# Project state — schema v3 (two-tier)

State splits across two locations:

- **`docs/state/features.json`** — INDEX. One entry per feature with status-mirror fields only. Cross-feature readers (SessionStart hook, dashboards, `/arh-trace`) read this single small file.
- **`docs/features/<id>/state.json`** — per-feature FULL RECORD. Created at `/arh-plan-requirements` Phase 1 (the migration point). Holds heavy arrays + nested data.

## Path per phase (no runtime fallback)

Each phase hardcodes which file it reads / writes.

| Phase | File |
|---|---|
| `/arh-intake`, `/arh-validate-story`, `/arh-research`, `/arh-import` (pre-plan) | `docs/state/features.json[<id>]` |
| `/arh-plan-requirements` (migration point) | reads index entry; creates `docs/features/<id>/state.json`; slims index to status-mirror |
| `/arh-plan-implementation`, `/arh-implement`, `/arh-validate-feature`, `/arh-review`, `/arh-security-review`, `/arh-iterate-design`, `/arh-clarify`, `/arh-human-review`, `/arh-sync`, `decide` (post-plan) | `docs/features/<id>/state.json` (primary) + mirror B-tier status fields to index |

## Tier legend

- **I** = index only (pre-plan)
- **P** = per-feature only (heavy fields)
- **B** = BOTH (primary in per-feature, mirrored to index on same write)

## Index entry shape

Status-mirror fields only. Pre-plan: upstream fields populate only. Post-plan: every status literal mirrors per-feature record's value.

```jsonc
{
  "<EPIC>-<SEQ>": {
    "story": "draft | validated | escalated | imported:<source>",
    "story_priority": "P1 | P2 | P3",
    "research": "pending | complete | skipped:<reason>",
    "research_verdict": "GO | GO-WITH-CONDITIONS | SPIKE | BLOCK | null",
    "prd": "pending | complete | null",
    "design": "pending | complete | n/a | null",
    "gate": "PENDING | APPROVE | CHANGES | null",
    "plan": "pending | complete | null",
    "impl": "pending | complete | null",
    "validation": "pending | passed | failed | null",
    "review": "PASS | PASS WITH WARNINGS | BLOCKED | null",
    "security": "pending | PASS | BLOCKED | null",
    "tracker_story": "<KEY-XX | null>",
    "tracker_research": "<KEY-XX | null>",
    "tracker_prd": "<KEY-XX | null>",
    "tracker_plan": "<KEY-XX | null>",
    "rtm_source_sha": "<git-sha>",
    "phase": "imported | story | story-validated | research | plan-requirements | plan-requirements-approved | plan-implementation | implementation | review | security-reviewed",
    "last_updated": "<iso8601>"
  }
}
```

## Per-feature record shape

One object per feature; id is the directory name.

```jsonc
{
  // status mirrors (also in index)
  "story", "story_priority", "research", "research_verdict",
  "prd", "design", "gate", "plan", "impl",
  "validation", "review", "security",
  "tracker_story", "tracker_research", "tracker_prd", "tracker_plan",
  "rtm_source_sha", "phase", "last_updated",

  // P-tier only (heavy)
  "story_independent_test": true,
  "needs_clarification_count": 0,
  "design_artifact": "docs/features/<id>/DESIGN.md | null",
  "design_provider": "figma | claude-design | stitch | html-mockup | none",
  "design_iteration": 0,
  "plan_validation": "PASS | FAIL | ESCALATED",
  "plan_validation_rounds": 1,
  "impl_branch": "feature/<id>",
  "validation_summary": "<DATE> P=<P>/<TOTAL> in <N> round(s)",
  "review_report": "docs/features/<id>/REVIEW.md",
  "adrs_referenced": ["ADR-1", "ADR-2"],
  "security_findings": {"critical": 0, "high": 0, "medium": 0, "low": 0, "tool_missing": []},
  "security_report": "docs/features/<id>/SECURITY-<DATE>.md",
  "governance_profile": "standard | strict | hipaa | pci | sox | gdpr",
  "tracker_review_comment": "<COMMENT-ID>",
  "last_synced_at": "<iso8601 — set by /arh-sync>",

  "decisions": [
    {"decision_id": "D-NN", "title": "<one-line>", "alternatives": ["..."],
     "chosen": "<slug>", "rationale": "<paragraph>",
     "blast_radius": "feature | service | system | data",
     "reversibility": "mechanical | medium | effectively-irreversible",
     "adr_ref": "ADR-N | null",
     "created_at": "<iso8601>", "created_by": "<phase/step>"}
  ],

  "clarifications": [
    {"round": 1, "asked_at": "<iso8601>", "asked_by": "<phase/step>",
     "tracker_comment": "<KEY-XX | null>",
     "status": "asked | partially-answered | resolved",
     "questions": [
       {"qid": "Q-NN", "marker": "<question>", "source_doc": "<path>",
        "source_line": 42, "category": "scope | security | integration | ux",
        "blocking": "T-NN | null", "answer": "<text | null>",
        "answered_at": "<iso8601 | null>", "applied_at": "<iso8601 | null>"}
     ]}
  ],

  "agent_flags": [
    {"flag_id": "AF-NN",
     "kind": "sensitive-default | inconsistency | risky-pattern | dead-code | unusual-shape | other",
     "summary": "<one-line>", "source": "<path:line>", "task_id": "T-NN | null",
     "raised_at": "<iso8601>", "raised_by": "<agent-name>",
     "status": "open | accept | reject | defer",
     "decision": "<one-line>", "decided_by": "<user>", "decided_at": "<iso8601>",
     "rationale": "<one-line>", "carry_forward_ref": "<item_id | null>"}
  ],

  "pending_carry_forward": [
    {"item_id": "<slug>", "kind": "test_case | task | risk | finding",
     "reason": "<one-line>", "owner": "<user-or-team>",
     "added_at": "<iso8601>", "added_by": "<phase/step>",
     "resolved_at": null, "evidence": null}
  ],

  "fixes": [
    // appended by `/arh-fix --for <id>` when a hotfix patches this feature.
    // The full record lives in docs/fixes/fix-<NN>.md; this is the backlink.
    {"fix_id": "FIX-NN", "summary": "<one-line>",
     "regression_test": "<id>", "added_at": "<iso8601>"}
  ],

  "impl_tasks": [
    {"task_id": "T-NN", "status": "done | blocked | skipped",
     "completed_at": "<iso8601>", "files_touched": ["..."],
     "reason": "<when status != done>"}
  ],

  "impl_evidence": {
    // six-dimension packet — N/A dimensions raise an `evidence-na` agent flag.
    // Sources from project-commands.yaml + stack-smoke.md.
    "session_ended_at": "<iso8601>",
    "checks": {
      "typecheck":    {"status": "PASS | FAIL | N/A", "command": "...", "exit_code": 0,
                       "evidence_path": "docs/features/<id>/evidence/typecheck.log | null",
                       "flag_id": "AF-NN | null", "ran_at": "<iso8601 | null>"},
      "unit_tests":   {/* same shape, source: project-commands.yaml test_unit: (fallback test:) */},
      "lint":         {/* same shape, source: project-commands.yaml lint: */},
      "runtime":      {/* dimension status PASS | FAIL | N/A; per-stack detail in
                          "stacks": [{"stack": "<id>", "status": ..., "command": "...",
                          "exit_code": 0, "evidence_path": "...", "boot_log_scan":
                          "clean | matched:<pattern>"}], one entry per runnable stack;
                          source: stack-smoke.md */},
      "compile":      {/* same shape, source: project-commands.yaml build: */},
      "design_check": {/* same shape, source: project-commands.yaml design_check: */}
    },

  "activity_log": [
    // audit trail of actions taken on this feature (append-only, sorted by timestamp descending when read)
    {"command": "validate-story",
     "description": "Story validated",
     "timestamp": "<iso8601>",
     "result": "PASS | FAIL | PENDING",
     "agent": "<agent-name | null>",
     "phase_transition": "<phase>"}
  ]
  },

  "sync_baseline": {
    // per-field remote snapshot at last successful /arh-sync (story, research, prd, tracker_*, etc.)
    "_etc": "used by /arh-sync three-way merge"
  }
}
```

## Field ownership

**Architectural rule:** state is local truth. Status fields carry STATUS LITERALS — never tracker keys. Tracker keys live in dedicated `tracker_*` fields. Status writes happen at **artefact-creation** time.

| Field | Tier | Written by | Step file |
|---|---|---|---|
| `story` (`draft`) | **B** | `/arh-intake` Step 2 | `intake/steps/02-stories.md` (I; per-feature dir not yet created) |
| `story` (`validated` / `escalated`) | **B** | `/arh-intake` Step 3 / `/arh-validate-story` | `intake/steps/03-validate.md` |
| `story` (`imported:<source>`) | **B** | `/arh-import` | `import/SKILL.md.j2` |
| `story_priority` | **B** | `/arh-intake` Step 2 | `intake/steps/02-stories.md` |
| `story_independent_test`, `needs_clarification_count` | **P** | `/arh-intake` Step 2 (I pre-plan; migrates to P at plan-requirements) | `intake/steps/02-stories.md` |
| `research`, `research_verdict` | **B** | `research-agent` (via `/arh-research` Phase 1) | `skills/research-assessment/SKILL.md.j2` |
| `prd`, `needs_clarification_count` | **B**/**P** | `/arh-plan-requirements` Phase 1 — **migration point** | `plan-requirements/steps/01-draft-prd.md` |
| `design` | **B** | `product-spec-agent` (stub) + `ux-agent` (complete) | `plan-requirements/steps/01-draft-prd.md`, `ux-agent` end-of-run |
| `design_artifact` | **P** | `product-spec-agent` OR `ux-agent` | `product-spec-agent.md.j2`, `ux-agent.md.j2` |
| `design_provider` | **P** | composer at generate time | `emitters/claude_code.py` |
| `design_iteration` | **P** | `/arh-iterate-design` Step 0/1 | `iterate-design/steps/00-context.md`, `iterate-design/steps/01-iterate.md` |
| `gate` | **B** | `/arh-plan-requirements` Phase 4 | `plan-requirements/steps/04-product-gate.md` |
| `plan` | **B** | `/arh-plan-implementation` Phase 2 | `plan-implementation/steps/02-tracker.md` |
| `plan_validation`, `plan_validation_rounds` | **P** | `impl-planning-agent` (via `/arh-plan-implementation` Phase 1) | `skills/plan-authoring/SKILL.md.j2` |
| `decisions[]` | **P** | `impl-planning-agent` (via `decide`) | `skills/plan-authoring/SKILL.md.j2`, `decide/SKILL.md` |
| `clarifications[]` | **P** | `/arh-clarify` Phase 2/4 | `clarify/steps/02-bundle.md`, `clarify/steps/04-apply.md` |
| `agent_flags[]` | **P** | raise: implementation/code-review agent; triage: `/arh-human-review` Phase 2 | `human-review/steps/00-context.md`, `human-review/steps/02-apply.md` |
| `pending_carry_forward[]` | **P** | `impl-planning-agent`, `validation-agent`, `code-review-agent`, `/arh-human-review` Phase 2 | `skills/plan-authoring/SKILL.md.j2`, `skills/validation-execution/SKILL.md.j2`, `skills/review-assessment/SKILL.md.j2`, `human-review/steps/02-apply.md` |
| `fixes[]` (hotfix backlinks; full record in `docs/fixes/fix-<NN>.md`) | **P** | `/arh-fix --for <id>` Step 4 | `fix/steps/04-commit-pr.md` |
| `impl` | **B** | `/arh-implement` Step 5 | `implement/steps/05-commit-pr.md` |
| `impl_branch` | **P** | `/arh-implement` Step 5 | `implement/steps/05-commit-pr.md` |
| `impl_tasks[]` | **P** | `/arh-implement` Step 1 (enables `--resume`) | `implement/steps/01-implement.md` |
| `impl_evidence` | **P** | `implementation-agent` end-of-session (N/A dimensions raise `evidence-na` flag) | `implement/steps/01-implement.md` + `evidence-pass/SKILL.md.j2` |
| `validation` | **B** | `/arh-implement` Step 5 | `implement/steps/05-commit-pr.md` |
| `validation_summary` | **P** | `/arh-implement` Step 5 | `implement/steps/05-commit-pr.md` |
| `review` | **B** | `/arh-implement` Step 5 OR `code-review-agent` (via `/arh-review` Phase 1) | `implement/steps/05-commit-pr.md`, `skills/review-assessment/SKILL.md.j2` |
| `review_report` | **P** | `code-review-agent` (via `/arh-review` Phase 1) | `skills/review-assessment/SKILL.md.j2` |
| `adrs_referenced` | **P** | `/arh-implement` Step 5 | `implement/steps/05-commit-pr.md` |
| `security` | **B** | `security-review-agent` (via `/arh-security-review` Step 1) | `skills/security-assessment/SKILL.md.j2` |
| `security_findings`, `security_report` | **P** | `security-review-agent` (via `/arh-security-review` Step 1) | `skills/security-assessment/SKILL.md.j2` |
| `governance_profile` | **P** | `harness generate` | composer |
| `tracker_story` | **B** | `/arh-intake` Step 5 (conditional) | `intake/steps/05-issue-tracker-sync.md` |
| `tracker_research` | **B** | `/arh-research` Phase 2 (conditional) | `research/steps/02-tracker.md` |
| `tracker_prd` | **B** | `/arh-plan-requirements` Phase 3 (conditional) | `plan-requirements/steps/03-tracker.md` |
| `tracker_plan` | **B** | `/arh-plan-implementation` Phase 2 (conditional) | `plan-implementation/steps/02-tracker.md` |
| `tracker_review_comment` | **P** | `/arh-implement` Step 6 (conditional) | `implement/steps/06-tracker-completion.md` |
| `rtm_source_sha` | **B** | `/arh-intake` Step 2 | `intake/steps/02-stories.md` |
| `last_synced_at`, `sync_baseline.*` | **P** | `sync-agent` (via `/arh-sync` apply) | `skills/tracker-sync/SKILL.md.j2` |
| `phase`, `last_updated` | **B** | every command on transition (mirror in same write) | each step file |
| `activity_log` | **P** | every command that advances phase (append entry on state write) | each step file |


## Read-only consumers

- `phase-preconditions` skill — gates each command using its declared path. No runtime fallback.
- `/arh-explain <id>` — picks file by phase, not existence check.
- `/arh-trace --verify` — iterates index for cross-feature scan; reads per-feature for deep state.
- `session-context-loader` hook — reads index only.

## Transitions

`(absent) → imported|story → story-validated → research → plan-requirements → plan-requirements-approved → plan-implementation → implementation → review → security-reviewed`. Other transitions are bugs; `phase-preconditions` rejects out-of-order invocations.
