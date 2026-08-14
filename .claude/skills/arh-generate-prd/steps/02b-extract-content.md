# Extract Content

Instructions for the `@reference-reader-agent` to extract PRD-relevant content from each source file.

---

## Input

- Classified file list from file inventory (file path, type, category_id)
- Extraction format schema from `extraction-format.md`
- Slug for output path

## Output

`docs/prd/.wip/{slug}-extraction.json` — populated per the extraction format schema.

---

## Per file-type extraction

> The file inventory pre-check (Step 4 of `01-file-inventory.md`) has already resolved tool availability and user intent before this agent runs. Any file marked `skipped` in the classified file list must be recorded as `status: "skipped"` and silently bypassed — do not re-check tools or re-ask the user.

### Text files (`.md`, `.txt`, `.csv`, `.tsv`)

Read directly with the Read tool. Extract all content.

### HTML files (`.html`, `.htm`)

Read directly with the Read tool. Extract visible text content; ignore markup tags.

### Structured text files (`.json`, `.yaml`, `.yml`)

Read directly with the Read tool. Extract field values relevant to PRD content; ignore structural keys.

### Image files (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`)

Read directly with the Read tool (multimodal). Describe visual content relevant to PRD sections: UI flows, architecture diagrams, wireframes, data models. Record description as extracted text for the relevant schema fields.

### PDF files (`.pdf`)

Use the tool confirmed available by the pre-check:

If `pdftotext` is available:
```bash
pdftotext "{filepath}" - 2>&1
```

If `pdfminer` is available (fallback):
```bash
python3 -m pdfminer.high_level "{filepath}" 2>&1
```

If the file is marked `skipped`: record `status: "skipped"`, continue.

### DOCX files (`.docx`)

Use the tool confirmed available by the pre-check:

If `docx2txt` is available:
```bash
docx2txt "{filepath}" - 2>&1
```

If `python-docx` is available (fallback):
```bash
python3 -c "
import docx, sys
doc = docx.Document(sys.argv[1])
for p in doc.paragraphs: print(p.text)
for t in doc.tables:
    for row in t.rows:
        print('\t'.join(c.text for c in row.cells))
" "{filepath}" 2>&1
```

If the file is marked `skipped`: record `status: "skipped"`, continue.

### DOC files (`.doc`, legacy Word)

Use `antiword` confirmed available by the pre-check:
```bash
antiword "{filepath}" 2>&1
```

If the file is marked `skipped`: record `status: "skipped"`, continue.

### XLSX files (`.xlsx`)

Use `openpyxl` confirmed available by the pre-check:
```bash
python3 -c "
import openpyxl, sys
wb = openpyxl.load_workbook(sys.argv[1], read_only=True)
for ws in wb.worksheets:
    for row in ws.iter_rows(values_only=True):
        print('\t'.join(str(c) if c is not None else '' for c in row))
" "{filepath}" 2>&1
```

If the file is marked `skipped`: record `status: "skipped"`, continue.

### Skipped and unsupported files

Any file marked `skipped` (tool missing, unsupported format, or user chose to skip): record `status: "skipped"` in `source_files`. Do not attempt extraction. Do not emit errors.

---

## Content mapping

After extracting raw text from each file, map it to the extraction schema fields.

Apply this mapping based on the file's `category_id`:

| category_id | Primary schema fields to populate |
|-------------|----------------------------------|
| `primary-requirements` | All fields — this is the main source |
| `regulatory-compliance` | `technical.compliance_regulations`, `non_functional_requirements` (security, privacy, accessibility) |
| `domain-workflows` | `user_journeys`, `functional_requirements`, `solution.capabilities` |
| `user-research` | `stakeholders.primary_persona`, `problem_statement`, `solution.alternatives_considered`, `competitive_landscape` |
| `accessibility` | `non_functional_requirements` (accessibility rows), `technical.compliance_regulations` |
| `technical-constraints` | `technical.*`, `non_functional_requirements` |
| `competitive` | `competitive_landscape`, `solution.alternatives_considered` |
| `uncategorized` | Scan all fields — populate anything found |

**Multi-file merge rule:** If the same schema field is populated by more than one file, concatenate values separated by `\n---\n[{filename}]\n`. Do not deduplicate — the gap analysis agent will resolve conflicts.

---

## Extraction discipline

- Extract verbatim where possible. Do not rephrase, summarize, or infer.
- If a concept is implied but not stated explicitly, do NOT extract it. Leave the field null.
- Maximum extraction per field: 2000 characters. If source text exceeds this, extract the most specific and actionable sentences first, then truncate.
- Record `char_count` for each file in the `source_files` array.

---

## On completion

Write the populated extraction JSON to `docs/prd/.wip/{slug}-extraction.json`.

Output a one-line summary:
```
Extraction complete: {N} files processed, {M} fields populated, {K} files skipped.
```
