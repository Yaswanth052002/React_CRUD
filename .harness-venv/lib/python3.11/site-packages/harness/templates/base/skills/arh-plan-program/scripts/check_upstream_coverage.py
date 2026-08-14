#!/usr/bin/env python3
"""
Self-check: for every story, count explicit upstream story IDs in the story file
and compare against incoming edges in dependency-list.md.

A node with fewer incoming edges than upstream mentions indicates a dropped edge —
most likely a transitive reduction artefact that slipped through.

Reads:
  docs/stories/          — story files; parses "- Upstream:" line
  docs/program/dependency-list.md  — edge list (or custom path via argv)

Writes:
  docs/program/dependency-validation-report.md  — appends ## UPSTREAM COVERAGE CHECK section

Exit codes:
  0 — all stories covered (counts match or story has no upstream mentions)
  1 — one or more mismatches found (drops < mentions); details printed to stderr
  2 — fatal: required file/directory missing

Usage:
  python3 ${CLAUDE_SKILL_DIR}/scripts/check_upstream_coverage.py
  python3 ${CLAUDE_SKILL_DIR}/scripts/check_upstream_coverage.py [dep-list] [stories-dir] [report]
"""

import os
import re
import sys
from collections import defaultdict

DEFAULT_DEP_LIST    = "docs/program/dependency-list.md"
DEFAULT_STORIES_DIR = "docs/stories"
DEFAULT_REPORT      = "docs/program/dependency-validation-report.md"

ID_RE = re.compile(r"\b([A-Z]+-\d+)\b")


def parse_upstream_mentions(stories_dir):
    """
    For each story file, parse "- Upstream: ..." and return
    {story_id: [upstream_id, ...]} containing only story-ID-shaped tokens.
    IDs that don't look like story IDs (e.g. "external service") are ignored.
    """
    try:
        fnames = os.listdir(stories_dir)
    except FileNotFoundError:
        print(f"ERROR: stories directory not found: {stories_dir}", file=sys.stderr)
        sys.exit(2)

    mentions = {}
    for fname in sorted(fnames):
        if not fname.endswith(".md"):
            continue
        m = re.match(r"^([A-Z]+-\d+)", fname)
        if not m:
            continue
        story_id = m.group(1)
        path = os.path.join(stories_dir, fname)
        try:
            with open(path) as f:
                content = f.read()
        except OSError:
            continue

        upstream_ids = []
        for line in content.splitlines():
            # Match "- Upstream: ..." (case-insensitive, any indentation)
            if re.match(r"\s*-\s*Upstream\s*:", line, re.IGNORECASE):
                upstream_ids = ID_RE.findall(line)
                break  # only one Upstream line per story

        mentions[story_id] = upstream_ids

    return mentions


def parse_incoming_edges(dep_list):
    """Return {story_id: [upstream_id, ...]} from the dependency list."""
    try:
        with open(dep_list) as f:
            lines = f.readlines()
    except FileNotFoundError:
        print(f"ERROR: dependency list not found: {dep_list}", file=sys.stderr)
        sys.exit(2)

    incoming = defaultdict(list)
    current_conf = None

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
                if ID_RE.fullmatch(from_id) and ID_RE.fullmatch(to_id):
                    incoming[to_id].append(from_id)

    return incoming


def append_report_section(report_path, mismatches, all_story_ids, checked):
    """Append ## UPSTREAM COVERAGE CHECK section to the validation report."""
    os.makedirs(os.path.dirname(os.path.abspath(report_path)), exist_ok=True)

    lines = [
        "\n---\n\n",
        "## UPSTREAM COVERAGE CHECK\n\n",
        f"Checked {checked} stories against `docs/program/dependency-list.md`.\n\n",
    ]

    if not mismatches:
        lines.append("No coverage gaps found — all upstream mentions are represented as edges.\n")
    else:
        lines.append(
            f"**{len(mismatches)} story/stories have fewer incoming edges than upstream mentions.**\n"
            "These stories may have lost direct dependency edges.\n\n"
        )
        lines.append("| Story | Upstream mentions | Incoming edges | Missing IDs |\n")
        lines.append("|---|---|---|---|\n")
        for story_id, mentioned, in_edges, missing in mismatches:
            missing_str = ", ".join(sorted(missing)) if missing else "—"
            lines.append(
                f"| {story_id} | {len(mentioned)} ({', '.join(sorted(mentioned))}) "
                f"| {len(in_edges)} ({', '.join(sorted(in_edges)) or '—'}) "
                f"| {missing_str} |\n"
            )

    mode = "a" if os.path.isfile(report_path) else "w"
    with open(report_path, mode) as f:
        f.writelines(lines)


def main():
    dep_list    = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_DEP_LIST
    stories_dir = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_STORIES_DIR
    report_path = sys.argv[3] if len(sys.argv) > 3 else DEFAULT_REPORT

    mentions = parse_upstream_mentions(stories_dir)
    incoming = parse_incoming_edges(dep_list)

    mismatches = []
    checked = 0

    for story_id, upstream_ids in sorted(mentions.items()):
        if not upstream_ids:
            continue  # no upstream mentions — nothing to check
        checked += 1
        in_edges = set(incoming.get(story_id, []))
        mentioned = set(upstream_ids)
        missing = mentioned - in_edges
        if missing:
            mismatches.append((story_id, mentioned, in_edges, missing))

    append_report_section(report_path, mismatches, set(mentions), checked)

    if mismatches:
        print(
            f"UPSTREAM COVERAGE: {len(mismatches)} gap(s) found in {checked} stories checked.",
            file=sys.stderr,
        )
        for story_id, mentioned, in_edges, missing in mismatches:
            print(
                f"  {story_id}: mentions {sorted(mentioned)} as upstream "
                f"but graph has only {sorted(in_edges)} — missing: {sorted(missing)}",
                file=sys.stderr,
            )
        sys.exit(1)

    print(
        f"UPSTREAM COVERAGE: OK — {checked} stories with upstream mentions, "
        f"all edges present in {dep_list}."
    )
    sys.exit(0)


if __name__ == "__main__":
    main()
