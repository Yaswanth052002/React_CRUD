# File Inventory

## Purpose

Discover all files in the reference folder, check readability, and match against the manifest.

---

## Step 1 — List all files

```bash
find "{reference_folder}" -type f ! -name ".DS_Store" ! -name "*.json" | sort
```

For each result, compute its **relative path** by stripping the `reference_folder` prefix and any leading `/`. This relative path (e.g. `domain/compliance-guide.pdf`) is what gets stored in the manifest and passed to all downstream steps — never the absolute path.

```bash
# Example: strip prefix to get relative path
# absolute: /path/to/project/docs/reference-material/domain/compliance-guide.pdf
# reference_folder: /path/to/project/docs/reference-material
# relative: domain/compliance-guide.pdf
```

Also capture the **subfolder name** for each file (the path component between `reference_folder` and the filename). Files directly in the root have an empty subfolder. This is used in Step 2 for heuristic category matching.

Report to user:

```
**Reference folder:** {reference_folder}
**Files found:** {N}
{list each relative path on its own line}
```

---

## Step 2 — Load or generate manifest

Check for manifest:

```bash
stat "{reference_folder}/reference-manifest.json" 2>/dev/null && echo "exists" || echo "missing"
```

### If manifest exists — validate it

Run the validation script. It checks every file path in the manifest against the disk and outputs structured JSON — no model interpretation needed:

```bash
python3 "${CLAUDE_SKILL_DIR}/scripts/validate_manifest.py" "{reference_folder}"
```

The script exits 0 if all required files are present, 1 if any required file is missing, 2 if the manifest itself is not found.

Parse the JSON output:

**If `required_missing` is non-empty (exit code 1):**

For each entry in `required_missing`, report:
```
ERROR: Required reference file missing.

Category: "{label}" (required)
Missing file: "{file}"

This category is required to generate a complete PRD. Please add the file to {reference_folder} and re-run.
To proceed without it, edit the manifest and set "required": false for this category.
```

Stop. Do not continue to Phase 1.

**If `optional_missing` is non-empty (exit code 0):**

```
Warning: {N} optional reference file(s) not found:
{list each entry: "  • {file} ({label})"}

These files would enrich the following PRD sections: {section list}.
The skill will proceed — those sections will have more gaps requiring clarification.
```

Continue.

**Build presence report for the user:**

| Category | Required | Files | Status |
|----------|----------|-------|--------|
| {label} | Yes/No | {filename} | present / MISSING |

Derive this table from the script's `present`, `required_missing`, and `optional_missing` arrays — do not re-stat individual files.

### If manifest is missing — generate starter manifest

Inventory all files found in Step 1. Map each to the most appropriate generic category based on filename heuristics (see table below). Write a starter manifest to `{reference_folder}/reference-manifest.json`.

**Heuristic matching — apply in order, stop at first match:**

For each file, match against both the **subfolder name** and the **filename** (case-insensitive). Check subfolder first — a match there is a stronger signal than a filename match.

| Pattern (case-insensitive) | Matches against | Default category_id | Default label | required |
|---------------------------|----------------|---------------------|---------------|----------|
| brd, requirements, scope, spec | subfolder OR filename | `primary-requirements` | Primary Requirements / Scope Definition | true |
| regulation, compliance, law, ferpa, coppa, hipaa, gdpr, iso, wcag, 508 | subfolder OR filename | `regulatory-compliance` | Regulatory & Compliance | false |
| workflow, process, standard, industry | subfolder OR filename | `domain-workflows` | Domain Workflows & Industry Standards | false |
| transcript, interview, research, survey, user | subfolder OR filename | `user-research` | User Research / Competitive Reference | false |
| accessibility, a11y | subfolder OR filename | `accessibility` | Accessibility Standards | false |
| competitive, competitor, market | subfolder OR filename | `competitive` | Competitive Landscape | false |
| architecture, technical, tech, system | subfolder OR filename | `technical-constraints` | Technical Constraints & Architecture | false |
| domain | subfolder name only | `regulatory-compliance` | Regulatory & Compliance | false |

Files that match no pattern → category_id: `uncategorized`, required: false.

> **Path preservation rule:** Always write file paths in the manifest as paths relative to `reference_folder`, preserving any subfolder prefix — e.g. `domain/compliance-guide.pdf`, never just `compliance-guide.pdf`. The validation script resolves paths as `{reference_folder}/{relative_path}`, so stripping the subfolder causes a false "file missing" failure even when the file is present.

After writing the manifest, output:

```
**No manifest found — generated starter manifest at {reference_folder}/reference-manifest.json**

Files categorized:
{table: filename | assigned category | required}

Files that could not be auto-categorized (marked uncategorized):
{list}

**Action required:** Review the manifest and:
1. Confirm each file is in the right category
2. Change "required": true for any category essential to your PRD
3. Re-run /arh-generate-prd to continue

Alternatively, reply "continue" to proceed with auto-categorized assignments as-is.
```

Wait for user confirmation before continuing.

---

## Step 3 — Classify file types

For each present file, determine its type by extension (case-insensitive):

| Extension | Type | Extraction approach |
|-----------|------|---------------------|
| `.md`, `.txt`, `.csv`, `.tsv` | text | Read tool directly |
| `.html`, `.htm` | HTML | Read tool directly |
| `.json`, `.yaml`, `.yml` | structured text | Read tool directly |
| `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg` | image | Read tool directly (multimodal) |
| `.pdf` | PDF | requires `pdftotext` or `pdfminer` |
| `.docx` | Word | requires `docx2txt` or `python-docx` |
| `.doc` | Word (legacy) | requires `antiword` |
| `.xlsx` | Excel | requires `openpyxl` |
| `.pptx` | PowerPoint | unsupported — convert to PDF or text |
| other | unknown | unsupported |

Store the classified file list for Step 4 and the reference reader agent.

---

## Step 4 — Tool pre-check

Run this step only for file types that require external tools. Check only the tools relevant to file types actually present.

### Check matrix

For each tool needed, run the corresponding check:

**pdftotext** (needed if any `.pdf` files present):
```bash
which pdftotext 2>/dev/null && echo "available" || echo "missing"
```
Fallback if missing:
```bash
python3 -c "import pdfminer; print('available')" 2>/dev/null || echo "missing"
```

**docx2txt** (needed if any `.docx` files present):
```bash
which docx2txt 2>/dev/null && echo "available" || echo "missing"
```
Fallback if missing:
```bash
python3 -c "import docx; print('available')" 2>/dev/null || echo "missing"
```

**antiword** (needed if any `.doc` files present):
```bash
which antiword 2>/dev/null && echo "available" || echo "missing"
```
No fallback.

**openpyxl** (needed if any `.xlsx` files present):
```bash
python3 -c "import openpyxl; print('available')" 2>/dev/null || echo "missing"
```
No fallback.

### On missing tools

For each missing tool, determine which files it affects and whether those files are in a **required** or **optional** category (from the manifest).

Build a consolidated list of affected files across all missing tools, then ask the user once:

Use `AskUserQuestion`:
| Header | Question |
|--------|----------|
| **Missing tools** | The following files cannot be read without tools that aren't installed: {list each file, its type, the missing tool, and install command}. How would you like to proceed? |

Options:
- **Skip unreadable files** — continue without them; affected sections will have more gaps requiring clarification
- **Abort** — stop now so you can install the missing tools, then re-run

If the user chooses **Skip unreadable files**:
- Mark each affected file as `skipped` in the classified file list
- If any skipped file was in a **required** category, warn:
  ```
  Warning: {filename} is in a required category ({label}). The PRD will have significant gaps in {affected sections}.
  ```
- Continue to Phase 1 with the remaining readable files.

If the user chooses **Abort**:
```
Stopped. Install the missing tools and re-run /arh-generate-prd.

{for each missing tool:}
  • {tool}: {install command}
```
Stop.

### Unsupported file types

For any `.pptx` or unknown-extension files found:
- Always mark as `skipped` — no tool can fix this
- Warn the user:
  ```
  Warning: {filename} is an unsupported format and will be skipped.
  Tip: Convert to PDF or Markdown and re-run for better coverage.
  ```

Do NOT ask the user about unsupported files — there is no recoverable action.
