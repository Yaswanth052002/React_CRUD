#!/usr/bin/env python3
"""
Step 3 structural validation for docs/program/dependency-list.md.

Checks:
  - All story IDs referenced in edges exist in docs/stories/
  - No self-references (A -> A)
  - No cycles

Findings are written to docs/program/dependency-validation-report.md as the
## STRUCTURAL ISSUES (Step 3) section so Step 5 can present them to the user.

Exit codes:
  0 — parsed successfully; findings (if any) are in the report
  1 — fatal error: file not found or file cannot be parsed

Usage: python3 ${CLAUDE_SKILL_DIR}/scripts/validate_dependency_list.py [dep-list] [stories-dir] [report-path]
"""

import os
import re
import sys
from collections import defaultdict

DEFAULT_DEP_LIST   = "docs/program/dependency-list.md"
DEFAULT_STORIES_DIR = "docs/stories"
DEFAULT_REPORT_PATH = "docs/program/dependency-validation-report.md"


def story_ids_from_dir(stories_dir):
    try:
        fnames = os.listdir(stories_dir)
    except FileNotFoundError:
        return None, f"Stories directory not found: {stories_dir}"
    ids = set()
    for fname in fnames:
        if fname.endswith(".md"):
            m = re.match(r"^([A-Z]+-\d+)", fname)
            if m:
                ids.add(m.group(1))
    return ids, None


def parse_edges(path):
    """Return list of (from_id, to_id, confidence) tuples."""
    try:
        with open(path) as f:
            lines = f.readlines()
    except FileNotFoundError:
        return None, [f"File not found: {path}"]

    edges = []
    current_conf = None
    id_re = re.compile(r"^[A-Z]+-\d+$")

    for line in lines:
        s = line.strip()
        if s.startswith("## HIGH"):
            current_conf = "HIGH"
        elif s.startswith("## MEDIUM"):
            current_conf = "MEDIUM"
        elif s.startswith("## "):
            current_conf = None

        if current_conf and s.startswith("|"):
            parts = [p.strip() for p in s.split("|")]
            if len(parts) >= 4:
                from_id, to_id = parts[1], parts[2]
                if id_re.match(from_id) and id_re.match(to_id):
                    edges.append((from_id, to_id, current_conf))

    return edges, []


def detect_cycles(edges):
    """Return list of cycles as node-path lists. Empty list = acyclic."""
    graph = defaultdict(list)
    nodes = set()
    for u, v, _ in edges:
        graph[u].append(v)
        nodes.add(u)
        nodes.add(v)

    white, gray, black = 0, 1, 2
    color = {n: white for n in nodes}
    cycles = []

    def dfs(node, path):
        color[node] = gray
        path.append(node)
        for nbr in sorted(graph[node]):
            if color[nbr] == gray:
                idx = path.index(nbr)
                cycles.append([*path[idx:], nbr])
            elif color[nbr] == white:
                dfs(nbr, path)
        path.pop()
        color[node] = black

    for node in sorted(nodes):
        if color[node] == white:
            dfs(node, [])

    return cycles


def write_step3_section(issues, report_path):
    """
    Write the ## STRUCTURAL ISSUES (Step 3) section to the report file.
    Step 4 (adversarial agent) will read this and produce the complete report.
    """
    report_dir = os.path.dirname(report_path)
    if report_dir:  # Only create directories if path contains a directory component
        os.makedirs(report_dir, exist_ok=True)

    with open(report_path, "w") as f:
        f.write("# Dependency Validation Report\n\n")
        f.write("| Field | Value |\n")
        f.write("|---|---|\n")
        f.write(f"| Step 3 structural issues | {len(issues)} |\n")
        f.write("| Step 4 adversarial findings | pending |\n")
        f.write("| FLAGGED | pending |\n\n")
        f.write("---\n\n")
        f.write("## STRUCTURAL ISSUES (Step 3)\n\n")

        if not issues:
            f.write("No structural issues found.\n")
        else:
            f.write(
                "Issues detected by deterministic structural validation. "
                "All must be resolved in Step 5 before wave planning proceeds.\n\n"
            )
            f.write("| Issue Type | Detail | Recommended Action |\n")
            f.write("|---|---|---|\n")
            for issue_type, detail, action in issues:
                f.write(f"| {issue_type} | `{detail}` | {action} |\n")


def main():
    dep_list    = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_DEP_LIST
    stories_dir = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_STORIES_DIR
    report_path = sys.argv[3] if len(sys.argv) > 3 else DEFAULT_REPORT_PATH

    # Fatal errors — cannot proceed
    known_ids, err = story_ids_from_dir(stories_dir)
    if err:
        print(f"ERROR: {err}", file=sys.stderr)
        sys.exit(1)

    edges, parse_errors = parse_edges(dep_list)
    if parse_errors or edges is None:
        for e in (parse_errors or [f"Failed to parse {dep_list}"]):
            print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)

    # Logical issues — written to report for Step 5 human review
    issues = []

    for u, v, conf in edges:
        if u == v:
            issues.append((
                "Self-reference",
                f"{u} → {v} ({conf})",
                "Remove this self-referencing edge",
            ))

    referenced = set()
    for u, v, _ in edges:
        referenced.add(u)
        referenced.add(v)
    for sid in sorted(referenced - known_ids):
        issues.append((
            "Unknown story ID",
            sid,
            f"Remove all edges referencing `{sid}`, or create docs/stories/{sid}-*.md",
        ))

    for cycle in detect_cycles(edges):
        cycle_str = " → ".join(cycle)
        issues.append((
            "Cycle",
            cycle_str,
            "Remove one edge in the cycle to make the graph acyclic",
        ))

    counts = {"HIGH": 0, "MEDIUM": 0}
    for _, _, c in edges:
        if c in counts:
            counts[c] += 1

    write_step3_section(issues, report_path)

    if issues:
        print(
            f"STEP 3: {len(issues)} structural issue(s) written to {report_path} "
            f"for human review in Step 5.",
            file=sys.stderr,
        )

    print(
        f"OK: {len(edges)} edges parsed "
        f"({counts['HIGH']} HIGH | {counts['MEDIUM']} MEDIUM), "
        f"{len(known_ids)} story IDs on disk, "
        f"{len(issues)} structural issue(s) (see {report_path})."
    )
    sys.exit(0)


if __name__ == "__main__":
    main()
