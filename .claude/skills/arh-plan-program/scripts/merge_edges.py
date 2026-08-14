#!/usr/bin/env python3
"""
merge_edges.py — Merge locked edges with newly inferred delta edges.

Used when classify_changes.py reports changed or new stories. Combines:
  - Locked edges for unchanged story pairs (read from dependency-list.lock)
  - Newly inferred edges for changed/new stories (read from dependency-list-delta.md)

Reads:
  docs/program/dependency-list.lock          — approved locked edges
  docs/program/dependency-list-delta.md      — new inferences (changed/new stories only)
  docs/program/.change-classification.json  — which stories changed

Writes:
  docs/program/dependency-list.md           — merged full list (input to Steps 3–6)
  docs/program/.merge-conflicts.json        — flagged drops/conflicts for human review

Exit codes:
  0 — clean merge
  2 — conflicts detected (surface to human at Step 5 before proceeding)
  1 — error
"""

import json
import os
import re
import sys

LOCK_FILE = "docs/program/dependency-list.lock"
DELTA_FILE = "docs/program/dependency-list-delta.md"
CLASSIFY_FILE = "docs/program/.change-classification.json"
OUTPUT = "docs/program/dependency-list.md"
CONFLICTS_FILE = "docs/program/.merge-conflicts.json"

ID_RE = re.compile(r"^[A-Z]+-\d+$")


def parse_edges_from_md(path):
    """Parse HIGH and MEDIUM edges from a dependency-list format file."""
    high, medium = set(), set()
    if not os.path.isfile(path):
        return high, medium
    current_conf = None
    with open(path) as f:
        for line in f:
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
                    frm, to = parts[1], parts[2]
                    if ID_RE.match(frm) and ID_RE.match(to):
                        if current_conf == "HIGH":
                            high.add((frm, to))
                        else:
                            medium.add((frm, to))
    return high, medium


def load_lock(lock_file):
    if not os.path.isfile(lock_file):
        return set(), set()
    try:
        with open(lock_file) as f:
            lock = json.load(f)
        high = {tuple(e) for e in lock.get("high_edges", [])}
        medium = {tuple(e) for e in lock.get("medium_edges", [])}
        return high, medium
    except (OSError, json.JSONDecodeError):
        return set(), set()


def load_classification(path):
    if not os.path.isfile(path):
        return set(), set()
    try:
        with open(path) as f:
            cls = json.load(f)
        return set(cls.get("changed", [])), set(cls.get("new", []))
    except (OSError, json.JSONDecodeError):
        return set(), set()


def write_dep_list(path, high_edges, medium_edges, conflicts):
    """Write merged dependency-list.md."""
    lines = []
    lines.append("# Program — Dependency List")
    lines.append("")
    lines.append("| Field | Value |")
    lines.append("|---|---|")
    lines.append(
        f"| Total inferences | {len(high_edges) + len(medium_edges)} ({len(high_edges)} HIGH, {len(medium_edges)} MEDIUM) |"
    )
    lines.append(f"| Conflicts flagged | {len(conflicts)} |")
    lines.append("")
    lines.append("---")
    lines.append("")

    if high_edges:
        lines.append("## HIGH — Sprint-blocked")
        lines.append("")
        lines.append("| From (upstream) | To (downstream) |")
        lines.append("|---|---|")
        for frm, to in sorted(high_edges):
            lines.append(f"| {frm} | {to} |")
        lines.append("")

    if medium_edges:
        lines.append("## MEDIUM — Integration-blocked")
        lines.append("")
        lines.append("| From (upstream) | To (downstream) |")
        lines.append("|---|---|")
        for frm, to in sorted(medium_edges):
            lines.append(f"| {frm} | {to} |")
        lines.append("")

    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")


def main():
    changed, new = load_classification(CLASSIFY_FILE)
    affected = changed | new

    locked_high, locked_medium = load_lock(LOCK_FILE)
    delta_high, delta_medium = parse_edges_from_md(DELTA_FILE)

    # Carry over locked edges for unchanged story pairs only
    merged_high = set()
    merged_medium = set()

    for frm, to in locked_high:
        if frm not in affected and to not in affected:
            merged_high.add((frm, to))

    for frm, to in locked_medium:
        if frm not in affected and to not in affected:
            merged_medium.add((frm, to))

    # Add all delta edges (re-inferred for changed/new stories)
    merged_high |= delta_high
    merged_medium |= delta_medium

    # Detect conflicts: locked edges involving affected stories that disappeared after re-inference
    conflicts = []

    for frm, to in sorted(locked_high):
        if (frm in affected or to in affected) and (frm, to) not in delta_high and (frm, to) not in delta_medium:
            conflicts.append(
                {
                    "type": "DROPPED_HIGH",
                    "edge": f"{frm} → {to}",
                    "was": "HIGH",
                    "now": "not inferred",
                    "severity": "High",
                    "message": (
                        f"HIGH edge {frm}→{to} existed in the lock but re-inference "
                        f"(triggered by change to {', '.join(sorted(affected & {frm, to}))}) "
                        "no longer finds it. Verify this dependency is truly gone before proceeding."
                    ),
                }
            )

    for frm, to in sorted(locked_medium):
        if (frm in affected or to in affected) and (frm, to) not in delta_high and (frm, to) not in delta_medium:
            conflicts.append(
                {
                    "type": "DROPPED_MEDIUM",
                    "edge": f"{frm} → {to}",
                    "was": "MEDIUM",
                    "now": "not inferred",
                    "severity": "Medium",
                    "message": (
                        f"MEDIUM edge {frm}→{to} dropped after re-inference. "
                        "Less critical — may be acceptable if story scope narrowed."
                    ),
                }
            )

    # Write outputs
    write_dep_list(OUTPUT, merged_high, merged_medium, conflicts)

    with open(CONFLICTS_FILE, "w") as f:
        json.dump({"conflicts": conflicts}, f, indent=2)

    high_drops = [c for c in conflicts if c["type"] == "DROPPED_HIGH"]

    if conflicts:
        print(
            f"MERGE COMPLETE with {len(conflicts)} conflict(s) "
            f"({len(high_drops)} HIGH, {len(conflicts) - len(high_drops)} MEDIUM)."
        )
        print(
            f"Review {CONFLICTS_FILE} — surface to human at Step 5 before proceeding."
        )
        sys.exit(2)

    print(
        f"MERGE CLEAN: {len(merged_high)} HIGH + {len(merged_medium)} MEDIUM edges. "
        f"No conflicts."
    )
    sys.exit(0)


if __name__ == "__main__":
    main()
