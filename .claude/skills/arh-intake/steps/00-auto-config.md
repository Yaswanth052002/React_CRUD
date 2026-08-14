# Step 0 — Auto-configure integrations

Goal: ensure `docs/config/issue-tracking.yaml` and `docs/config/doc-tracker.yaml` are populated so downstream steps can sync. On first run, discover the live environment via the configured MCP servers; on subsequent runs, just verify and proceed.

## 0a. Issue tracker discovery

If `docs/config/issue-tracking.yaml` exists, read it.

**Completeness check (mandatory).** A file may exist as a stub written by `/arh-init`. Validate:

- `provider` is set and != `none` → required fields below must be populated.
- For `provider: jira` — `site`, `project_key`, `issue_types.epic`, `issue_types.story` must be set, NOT one of: empty string, `null`, `TODO`, `FILL`, `<…>` placeholder.
- For `provider: linear` — `team_id`, `workflow_states` must be set with the same rules.
- For `provider: github` — `org`, `repo` must be set.
- For `provider: azure-devops` — `organization`, `project` must be set.

If any required field is missing or a placeholder, treat the file as **not configured** — fall through to the discovery flow below, prompt the user, and overwrite the placeholders.

If the file is fully populated, log the summary and proceed to Step 1.

If it does not exist OR is incomplete:

- **Provider = none**: write a stub with `provider: none` and continue. Steps 4–5 will skip.
- **Provider = jira**: 
  - Call `mcp__atlassian__getAccessibleAtlassianResources` → `cloudId`, `site`.
  - Call `mcp__atlassian__getVisibleJiraProjects` → list of projects.
  - Ask the user: *"Which Jira project should stories be created in?"* — show project keys and names.
  - After selection, call `mcp__atlassian__getJiraProjectIssueTypesMetadata`:
    - Epic issue type id
    - Story issue type id
    - Subtask issue type id (match `hierarchyLevel: -1` or name containing `subtask` / `sub-task`, case-insensitive). If not present, set `null` and warn — phase subtasks will be skipped.
  - Extract priority ids from the Story type's `priority.allowedValues`.
  - Determine the Epic→Story link field (`parent` if present on Story type).
- **Provider = linear**:
  - Call `mcp__linear__getTeams` → list of teams.
  - Ask the user which team. Resolve team id.
  - Call `mcp__linear__getWorkflowStates` for that team to map intake states.
- **Provider = github**:
  - Call `mcp__github__listRepos` for the org configured in `harness.yaml`.
  - Ask the user which repo's Issues will hold stories.
- **Provider = azure-devops**: equivalent calls via `mcp__ado__*`.

## 0b. Doc tracker discovery

If `docs/config/doc-tracker.yaml` exists, read it.

**Completeness check (mandatory).** Validate:

- `provider` set and != empty.
- For `provider: confluence` — `space_key` and `parent_page_title` must be set, NOT placeholders (`TODO`, `FILL`, empty, `null`).
- For `provider: notion` — `database_id` must be set, NOT a placeholder.
- For `provider: local` — `doc_root` defaults to `docs/`; no other required fields.

If any required field is missing or a placeholder, treat as **not configured** — fall through to the discovery flow, prompt the user, and overwrite.

If fully populated, proceed.

Otherwise (missing or incomplete):

- **Provider = local**: write a stub recording the local doc root (default `docs/`).
- **Provider = confluence**: call `mcp__atlassian__getConfluenceSpaces`, ask the user which space holds the RTM, write `spaceKey` and `parentPageTitle`.
- **Provider = notion**: call `mcp__notion__listDatabases`, ask which database holds PRDs.

## 0c. Write configs

Create `docs/config/` if missing.

**Write semantics (mandatory):**

- If the YAML file does NOT exist → create it with all discovered values.
- If the YAML file DOES exist but failed the 0a/0b completeness check → read existing YAML, overwrite ONLY placeholder fields (`TODO`, `FILL`, empty, `null`, `<…>`) with discovered/selected values; preserve any non-placeholder fields the user may have hand-edited.
- If the YAML file passed the completeness check → do not touch.

Use round-trip YAML (preserve comments + ordering) when overwriting.

Verification: after writing, re-run the 0a/0b completeness check against the file you just wrote. It MUST pass — otherwise abort intake with a clear error.

Write the YAML files:

```yaml
# docs/config/issue-tracking.yaml
provider: jira | linear | github | azure-devops | none
site: <discovered>
project_key: <user-selected>
issue_types:
  epic: <id>
  story: <id>
  subtask: <id | null>
priorities:
  Must:   <id>
  Should: <id>
  Could:  <id>
  Wont:   <id>
epic_story_link_field: parent
labels:
  - <project-slug>
```

```yaml
# docs/config/doc-tracker.yaml
provider: confluence | notion | local
space_key: <discovered>          # confluence
database_id: <discovered>        # notion
parent_page_title: <project> — Requirements Traceability
```

## 0d. Log

```
CONFIG AUTO-CREATED
───────────────────
Files:        docs/config/issue-tracking.yaml, docs/config/doc-tracker.yaml
Issue:        <provider> @ <site>          | not configured
Doc:          <provider> @ <space|db|local>
Epic type:    <id>
Story type:   <id>
Subtask:      <id | "not available">
```

Never store credentials in these files. Tokens stay in env vars referenced by `.mcp.json`.
