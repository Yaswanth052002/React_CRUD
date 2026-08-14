# Step 1 — Parse source into RTM

Goal: convert `$ARGUMENTS` (file path, raw text, ticket key, or doc URL) into a numbered hierarchy in `docs/requirements/RTM.md`. The RTM is the source of truth for requirement IDs; everything downstream cites it.

## Procedure

Invoke `rtm-agent` with the input. The agent:

1. Detects input type (file vs raw text vs `JIRA-KEY` / `LINEAR-XXX` ticket vs URL).
2. Pulls the source content via the appropriate MCP server when needed.
3. Loads skill `requirement-tracing` for numbering conventions.
4. Identifies the requirement hierarchy:
   - **Level 1 — Epic**: 3-letter uppercase code (e.g. `CHK` for Checkout).
   - **Level 2 — Story candidate**: each becomes a Story file in Step 2.
   - **Level 3 — Functional detail**: lives inside the Story's ACs / NFRs.
5. Writes `docs/requirements/RTM.md` using the table format from `requirement-tracing`.
6. Preserves any rows the user has manually edited (do not overwrite).

## Output

```
docs/requirements/RTM.md      ← N rows
```

## Edge cases

- Source is empty or has no parseable structure → return: `No requirements could be parsed from <source>`.
- Source already has matching IDs in RTM → reconcile; do not duplicate.
- Source ticket key not found by tracker MCP → fail with the explicit MCP error.
