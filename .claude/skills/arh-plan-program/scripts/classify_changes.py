#!/usr/bin/env python3
"""
classify_changes.py — Compare current story files against dependency-list.lock.

Reads:
  docs/program/dependency-list.lock  — prior lock (optional; first run skips)
  docs/stories/*.md                 — current story files

Writes:
  docs/program/.change-classification.json
    {
      "unchanged": [...],  # hash matches lock → skip inference
      "changed":   [...],  # hash differs → re-infer this story's edges
      "new":       [...],  # not in lock → infer edges against all stories
    }

Exit codes:
  0 — inference needed (changed or new stories exist)
  2 — fully cached (all stories unchanged; caller may skip Steps 2–4)
  1 — error
"""

import hashlib
import json
import os
import re
import sys

STORIES_DIR = "docs/stories"
LOCK_FILE = "docs/program/dependency-list.lock"
OUTPUT = "docs/program/.change-classification.json"

STORY_RE = re.compile(r"^([A-Z]+-\d+)")

# Fields excluded from the semantic hash (outputs, not inputs to dep inference).
# Story fields use **FieldName:** value format — colon is inside the bold span.
EXCLUDE = re.compile(
    r"^\*\*(Status|Effort|Priority|Wave|Depends On|Last Updated|Phase):\*\*",
    re.IGNORECASE,
)


def semantic_hash(path):
    """SHA256 of story content minus metadata fields and inferred annotations."""
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


def load_lock_hashes(lock_file):
    if not os.path.isfile(lock_file):
        return {}
    try:
        with open(lock_file) as f:
            lock = json.load(f)
        return {sid: v["hash"] for sid, v in lock.get("stories", {}).items()}
    except (OSError, json.JSONDecodeError):
        return {}


def main():
    lock_hashes = load_lock_hashes(LOCK_FILE)
    no_lock = not lock_hashes

    current = {}
    try:
        for fname in sorted(os.listdir(STORIES_DIR)):
            if fname.endswith(".md"):
                m = STORY_RE.match(fname)
                if m:
                    sid = m.group(1)
                    current[sid] = semantic_hash(os.path.join(STORIES_DIR, fname))
    except FileNotFoundError:
        print(f"ERROR: {STORIES_DIR} not found.", file=sys.stderr)
        sys.exit(1)

    unchanged, changed, new = [], [], []

    for sid in sorted(current):
        if sid not in lock_hashes:
            new.append(sid)
        elif lock_hashes[sid] == current[sid]:
            unchanged.append(sid)
        else:
            changed.append(sid)

    result = {"unchanged": unchanged, "changed": changed, "new": new}

    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    with open(OUTPUT, "w") as f:
        json.dump(result, f, indent=2)

    total = len(unchanged) + len(changed) + len(new)
    needs_inference = len(changed) + len(new)

    if no_lock:
        print(f"No lock found — full inference required for all {total} stories.")
        sys.exit(0)

    print(
        f"Classification: {len(unchanged)}/{total} unchanged (cached), "
        f"{len(changed)} changed, {len(new)} new → {needs_inference} need inference."
    )

    if needs_inference == 0:
        print("All stories cached. Steps 2–4 can be skipped.")
        sys.exit(2)

    sys.exit(0)


if __name__ == "__main__":
    main()
