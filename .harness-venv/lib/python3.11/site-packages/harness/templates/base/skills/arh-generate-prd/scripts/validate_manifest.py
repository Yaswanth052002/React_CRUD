#!/usr/bin/env python3
"""
Validate that all files declared in reference-manifest.json exist on disk.

Usage:
    python3 validate_manifest.py <reference_folder>

Exit codes:
    0 — all required files present (optional files may be missing)
    1 — one or more required files missing
    2 — manifest file not found

Output: JSON to stdout with shape:
{
  "manifest_found": true,
  "required_missing": [{"category_id": "...", "label": "...", "file": "..."}],
  "optional_missing": [{"category_id": "...", "label": "...", "file": "..."}],
  "present": [{"category_id": "...", "file": "..."}],
  "unreadable": []
}
"""

import json
import os
import sys


def main() -> None:
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: validate_manifest.py <reference_folder>"}))
        sys.exit(2)

    reference_folder = sys.argv[1].rstrip("/")
    manifest_path = os.path.join(reference_folder, "reference-manifest.json")

    if not os.path.isfile(manifest_path):
        print(json.dumps({"manifest_found": False}))
        sys.exit(2)

    with open(manifest_path, encoding="utf-8") as f:
        try:
            manifest = json.load(f)
        except json.JSONDecodeError as exc:
            print(json.dumps({"manifest_found": True, "error": f"Malformed JSON: {exc}"}))
            sys.exit(2)

    required_missing = []
    optional_missing = []
    present = []

    for category in manifest.get("categories", []):
        cat_id = category.get("id", "")
        label = category.get("label", "")
        required = category.get("required", False)

        for filename in category.get("files", []):
            # Paths in the manifest are relative to reference_folder
            # and must preserve subfolder structure (e.g. "domain/compliance.pdf")
            full_path = os.path.join(reference_folder, filename)
            if os.path.isfile(full_path):
                present.append({"category_id": cat_id, "file": filename})
            else:
                entry = {"category_id": cat_id, "label": label, "file": filename}
                if required:
                    required_missing.append(entry)
                else:
                    optional_missing.append(entry)

    result = {
        "manifest_found": True,
        "required_missing": required_missing,
        "optional_missing": optional_missing,
        "present": present,
        "unreadable": [],
    }
    print(json.dumps(result, indent=2))
    sys.exit(1 if required_missing else 0)


if __name__ == "__main__":
    main()
