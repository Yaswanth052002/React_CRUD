#!/usr/bin/env python3
"""
write_lock.py — Write dependency-list.lock after human sign-off at Step 5.

Reads:
  docs/program/dependency-list.md  — the human-approved edge list
  docs/stories/*.md               — story files to hash

Writes:
  docs/program/dependency-list.lock

The lock captures:
  - SHA256 hash of each story's semantic content (title, user story, ACs — not status/metadata)
  - All HIGH and MEDIUM edges from the approved dependency list
  - per-story edges_out and edges_in for quick lookup by classify_changes.py

Exit codes:
  0 — success
  1 — error
"""

import hashlib
import json
import os
import re
import sys
from datetime import UTC, datetime

STORIES_DIR = "docs/stories"
DEP_LIST = "docs/program/dependency-list.md"
LOCK_FILE = "docs/program/dependency-list.lock"

ID_RE = re.compile(r"^[A-Z]+-\d+$")
STORY_RE = re.compile(r"^([A-Z]+-\d+)")
EXCLUDE = re.compile(
    r"^\*\*(Status|Effort|Priority|Wave|Depends On|Last Updated|Phase):\*\*",
    re.IGNORECASE,
)


def semantic_hash(path):
    try:
        with open(path) as f:
            lines = f.readlines()
    except OSError:
        return ""
    filtered = [
        line
        for line in lines
        if not EXCLUDE.match(line.strip())
        and "<!-- inferred" not in line
        and "<!-- CONFLICT" not in line
    ]
    return hashlib.sha256("".join(filtered).encode()).hexdigest()[:16]


def parse_edges(path):
    high, medium = [], []
    current_conf = None
    try:
        with open(path) as f:
            lines = f.readlines()
    except FileNotFoundError:
        print(f"ERROR: {path} not found.", file=sys.stderr)
        sys.exit(1)

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
                frm, to = parts[1], parts[2]
                if ID_RE.match(frm) and ID_RE.match(to):
                    if current_conf == "HIGH":
                        high.append([frm, to])
                    else:
                        medium.append([frm, to])
    return high, medium


def main():
    high_edges, medium_edges = parse_edges(DEP_LIST)

    # Collect all story IDs referenced
    all_ids = set()
    for frm, to in high_edges + medium_edges:
        all_ids.update([frm, to])

    # Hash all story files
    story_entries = {}
    try:
        for fname in sorted(os.listdir(STORIES_DIR)):
            if fname.endswith(".md"):
                m = STORY_RE.match(fname)
                if m:
                    sid = m.group(1)
                    fpath = os.path.join(STORIES_DIR, fname)
                    story_entries[sid] = {
                        "hash": semantic_hash(fpath),
                        "edges_out": sorted(to for frm, to in high_edges if frm == sid),
                        "edges_in": sorted(frm for frm, to in high_edges if to == sid),
                    }
    except FileNotFoundError:
        print(f"ERROR: {STORIES_DIR} not found.", file=sys.stderr)
        sys.exit(1)

    lock = {
        "version": "1.0",
        "locked_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "high_edges": high_edges,
        "medium_edges": medium_edges,
        "stories": story_entries,
    }

    os.makedirs(os.path.dirname(LOCK_FILE), exist_ok=True)
    with open(LOCK_FILE, "w") as f:
        json.dump(lock, f, indent=2)

    print(
        f"Lock written: {len(story_entries)} stories hashed, "
        f"{len(high_edges)} HIGH + {len(medium_edges)} MEDIUM edges locked."
    )
    print(f"  → {LOCK_FILE}")


if __name__ == "__main__":
    main()
