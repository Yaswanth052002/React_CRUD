#!/usr/bin/env python3
"""
generate_wave_plan.py — Deterministic wave planning from dependency-list.md.

Reads:
  docs/program/dependency-list.md    — all inferred edges (HIGH + MEDIUM)
  docs/program/story-metadata.json  — story titles, status, effort, external deps

Writes:
  docs/program/wave-plan.md         — wave assignments, critical path, risk register

Algorithm:
  HIGH edges  → hard blockers; used for wave assignment (Kahn's) and critical path (longest-path DP)
  MEDIUM edges → scheduling notes within waves; never block wave start

Exit codes:
  0 — success
  1 — fatal error (cycle, missing input)
"""

import argparse
import json
import os
import re
import sys
from collections import defaultdict
from datetime import UTC

DEP_LIST = "docs/program/dependency-list.md"
METADATA = "docs/program/story-metadata.json"
OUTPUT = "docs/program/wave-plan.md"

ID_RE = re.compile(r"^[A-Z]+-\d+$")


def epic_of(sid):
    m = re.match(r"^([A-Z]+)", sid)
    return m.group(1) if m else ""


# ── Parsers ────────────────────────────────────────────────────────────────────


def parse_edges(path):
    """Parse dependency-list.md → (high_edges, medium_edges, all_ids)."""
    try:
        with open(path) as f:
            lines = f.readlines()
    except FileNotFoundError:
        print(f"ERROR: {path} not found. Run Steps 2–4 first.", file=sys.stderr)
        sys.exit(1)

    high, medium = [], []
    all_ids = set()
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
                frm, to = parts[1], parts[2]
                if ID_RE.match(frm) and ID_RE.match(to):
                    if current_conf == "HIGH":
                        high.append((frm, to))
                    else:
                        medium.append((frm, to))
                    all_ids.update([frm, to])

    return high, medium, all_ids


def load_metadata(path):
    """Load story-metadata.json → {id: story_dict}."""
    try:
        with open(path) as f:
            data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}
    return {s["id"]: s for s in data.get("stories", [])}


# ── Algorithms ─────────────────────────────────────────────────────────────────


def kahn_waves(all_ids, high_edges):
    """
    Kahn's level-by-level BFS on HIGH edges only.
    Returns (wave_map, topo_order) or raises ValueError on cycle.
    Wave numbers are deterministic: sort alphabetically at each level.
    """
    downstream = defaultdict(list)
    in_degree = {sid: 0 for sid in all_ids}

    for frm, to in high_edges:
        downstream[frm].append(to)
        in_degree[to] += 1

    wave_map = {}
    topo_order = []
    wave_num = 1
    current_wave = sorted(sid for sid in all_ids if in_degree[sid] == 0)

    while current_wave:
        for sid in current_wave:
            wave_map[sid] = wave_num
            topo_order.append(sid)

        next_wave_set = set()
        for sid in current_wave:
            for ds in downstream[sid]:
                in_degree[ds] -= 1
                if in_degree[ds] == 0:
                    next_wave_set.add(ds)

        wave_num += 1
        current_wave = sorted(next_wave_set)

    if len(topo_order) != len(all_ids):
        cycle_nodes = sorted(sid for sid in all_ids if sid not in wave_map)
        raise ValueError(
            f"Circular dependency detected among: {', '.join(cycle_nodes)}\n"
            "Resolve the cycle in dependency-list.md and re-run."
        )

    return wave_map, topo_order


def longest_path(all_ids, high_edges, topo_order):
    """
    Longest-path DP on HIGH edges in topological order.
    Returns (max_depth, primary_chain, all_chains).
    Tie-breaking is alphabetical for full determinism.
    """
    upstream = defaultdict(list)
    for frm, to in high_edges:
        upstream[to].append(frm)

    dist = {sid: 1 for sid in all_ids}
    prev = {sid: None for sid in all_ids}

    for sid in topo_order:
        for up in sorted(upstream[sid]):
            if dist[up] + 1 > dist[sid]:
                dist[sid] = dist[up] + 1
                prev[sid] = up
            elif dist[up] + 1 == dist[sid]:
                # Tie-break: alphabetically smallest predecessor
                if prev[sid] is None or up < prev[sid]:
                    prev[sid] = up

    max_depth = max(dist.values(), default=1)
    terminals = sorted(sid for sid in all_ids if dist[sid] == max_depth)

    def trace(end):
        chain = []
        node = end
        while node is not None:
            chain.append(node)
            node = prev[node]
        chain.reverse()
        return chain

    primary_chain = trace(terminals[0])
    all_chains = [trace(t) for t in terminals]

    return max_depth, primary_chain, all_chains


# ── Risk Register ──────────────────────────────────────────────────────────────


def build_risks(all_ids, metadata, high_edges, medium_edges):
    """Rule-based risk register — deterministic, no LLM."""
    risks = []

    # CROSS_EPIC: edges between different epics
    seen_cross = set()
    for frm, to in sorted(high_edges + medium_edges):
        if epic_of(frm) != epic_of(to):
            key = (frm, to)
            if key not in seen_cross:
                conf = "HIGH" if (frm, to) in high_edges else "MEDIUM"
                risks.append(
                    {
                        "category": "CROSS_EPIC",
                        "severity": "Medium",
                        "risk": f"{conf} cross-epic dependency {frm} → {to}",
                        "story": frm,
                        "rec": "Coordinate integration testing handoff across epic boundaries.",
                    }
                )
                seen_cross.add(key)

    # UNVALIDATED_DEP: upstream blocker not yet Validated
    validated = {"validated", "in progress", "done", "ready for dev"}
    upstream_ids = sorted({frm for frm, _ in high_edges})
    for sid in upstream_ids:
        meta = metadata.get(sid, {})
        status = (meta.get("status") or "").lower()
        if status and status not in validated:
            risks.append(
                {
                    "category": "UNVALIDATED_DEP",
                    "severity": "High",
                    "risk": f"{sid} is a HIGH upstream but status is '{meta.get('status', 'Unknown')}'",
                    "story": sid,
                    "rec": "Validate this story before it can safely gate downstream work.",
                }
            )

    # BROKEN_REF: manual_deps referencing unknown story IDs
    for sid in sorted(all_ids):
        meta = metadata.get(sid, {})
        for dep in meta.get("manual_deps") or []:
            if dep not in all_ids and ID_RE.match(dep):
                risks.append(
                    {
                        "category": "BROKEN_REF",
                        "severity": "High",
                        "risk": f"{sid} manually declares dependency on {dep} which is not in the story set",
                        "story": sid,
                        "rec": f"Verify {dep} exists or remove the broken reference.",
                    }
                )

    # CONFLICT: story has known conflict annotation
    for sid in sorted(all_ids):
        meta = metadata.get(sid, {})
        if meta.get("has_conflict"):
            risks.append(
                {
                    "category": "CONFLICT",
                    "severity": "High",
                    "risk": f"{sid} has an unresolved conflict annotation",
                    "story": sid,
                    "rec": "Resolve the conflict before this story can block downstream work.",
                }
            )

    # EXTERNAL_DEP: unconfirmed third-party availability
    for sid in sorted(all_ids):
        meta = metadata.get(sid, {})
        ext = meta.get("external_deps") or []
        if ext:
            risks.append(
                {
                    "category": "EXTERNAL_DEP",
                    "severity": "Medium",
                    "risk": f"{sid} relies on external: {', '.join(ext)}",
                    "story": sid,
                    "rec": "Confirm availability before sprint start.",
                }
            )

    return risks


# ── Writer ─────────────────────────────────────────────────────────────────────


def write_wave_plan(
    all_ids,
    metadata,
    wave_map,
    topo_order,
    high_edges,
    medium_edges,
    max_depth,
    primary_chain,
    all_chains,
    risks,
    date_str,
):
    waves = defaultdict(list)
    for sid in sorted(all_ids):
        waves[wave_map[sid]].append(sid)

    total_waves = max(wave_map.values(), default=0)
    wave1_count = len(waves.get(1, []))

    high_upstream = defaultdict(list)
    for frm, to in high_edges:
        high_upstream[to].append(frm)

    medium_notes = defaultdict(list)
    for frm, to in medium_edges:
        medium_notes[to].append(frm)

    skipped = sorted(
        sid
        for sid, meta in metadata.items()
        if sid not in all_ids
        and (meta.get("status") or "").lower() in ("draft", "in review")
    )

    epics = sorted({epic_of(s) for s in all_ids if epic_of(s)})
    crit_str = " → ".join(primary_chain)

    out = []

    # ── Header ──
    out.append("# Program — Wave Plan\n")
    out.append("| Field | Value |")
    out.append("|---|---|")
    out.append(f"| Generated | {date_str} |")
    out.append(f"| Stories analysed | {len(all_ids)} |")
    out.append(f"| Stories skipped (unstable) | {len(skipped)} |")
    out.append(f"| Waves | {total_waves} |")
    out.append(
        f"| Critical path length | {max_depth} wave{'s' if max_depth != 1 else ''} |"
    )
    out.append(f"| Parallel stories (Wave 1) | {wave1_count} |")
    out.append("")
    out.append("---")
    out.append("")

    # ── Summary ──
    out.append("## Summary")
    out.append("")
    out.append(
        f"{len(all_ids)} stories across epic{'s' if len(epics) > 1 else ''} "
        f"{', '.join(epics)} assigned to {total_waves} delivery wave{'s' if total_waves != 1 else ''}. "
        f"{wave1_count} {'story' if wave1_count == 1 else 'stories'} "
        f"can start immediately in Wave 1 with no HIGH-confidence prerequisites. "
        f"Critical path: {crit_str} ({max_depth} wave{'s' if max_depth != 1 else ''} minimum)."
    )
    out.append("")
    out.append("---")
    out.append("")

    # ── Wave Breakdown ──
    out.append("## Wave Breakdown")
    out.append("")

    for wave_num in sorted(waves):
        stories = waves[wave_num]
        if wave_num == 1:
            out.append(
                f"### Wave {wave_num} — Start immediately (no HIGH dependencies)"
            )
        else:
            out.append(f"### Wave {wave_num} — Unblocked after Wave {wave_num - 1}")
        out.append("")

        if wave_num == 1:
            out.append("| Story ID | Title | Status | Effort |")
            out.append("|---|---|---|---|")
            for sid in stories:
                meta = metadata.get(sid, {})
                out.append(
                    f"| {sid} | {meta.get('title') or sid} | {meta.get('status') or '—'} | {meta.get('effort') or '—'} |"
                )
        else:
            out.append(
                "| Story ID | Title | Direct Dependencies (HIGH) | Status | Effort |"
            )
            out.append("|---|---|---|---|---|")
            for sid in stories:
                meta = metadata.get(sid, {})
                deps = ", ".join(sorted(high_upstream.get(sid, [])))
                out.append(
                    f"| {sid} | {meta.get('title') or sid} | {deps} | {meta.get('status') or '—'} | {meta.get('effort') or '—'} |"
                )

        # MEDIUM scheduling notes
        notes = []
        for sid in stories:
            med_ups = sorted(medium_notes.get(sid, []))
            if med_ups:
                notes.append(
                    f"- {sid} has MEDIUM upstream: {', '.join(med_ups)}"
                    " — integration tests should run in this order within the wave."
                )
        if notes:
            out.append("")
            out.append("**Scheduling notes (MEDIUM dependencies):**")
            out.extend(notes)

        out.append("")

    out.append("---")
    out.append("")

    # ── Critical Path ──
    out.append("## Critical Path")
    out.append("")
    out.append(
        "> The critical path determines the minimum number of delivery cycles for"
    )
    out.append(
        "> this program. Any delay on a critical path story delays the entire program."
    )
    out.append("")
    out.append(
        f"**Chain:** {crit_str}  ({max_depth} wave{'s' if max_depth != 1 else ''} minimum)"
    )
    out.append("")

    if len(all_chains) > 1:
        out.append("**All critical-path chains (equal depth):**")
        out.append("")
        out.append("| Chain | Bottleneck |")
        out.append("|---|---|")
        for chain in all_chains:
            out.append(f"| {' → '.join(chain)} | {chain[0]} |")
        out.append("")

    out.append("---")
    out.append("")

    # ── Risk Register ──
    out.append("## Risk Register")
    out.append("")
    if risks:
        out.append(
            "| # | Category | Risk | Affected Story | Severity | Recommendation |"
        )
        out.append("|---|---|---|---|---|---|")
        for i, r in enumerate(risks, 1):
            out.append(
                f"| {i} | {r['category']} | {r['risk']} | {r['story']} | {r['severity']} | {r['rec']} |"
            )
    else:
        out.append("_No risks detected._")
    out.append("")
    out.append("---")
    out.append("")

    # ── Skipped Stories ──
    out.append("## Skipped Stories")
    out.append("")
    if skipped:
        out.append("| Story ID | Title | Status |")
        out.append("|---|---|---|")
        for sid in skipped:
            meta = metadata.get(sid, {})
            out.append(
                f"| {sid} | {meta.get('title', '')} | {meta.get('status', '')} |"
            )
    else:
        out.append("_None — all stories are Validated or beyond._")
    out.append("")
    out.append("---")
    out.append("")

    # ── How to Use ──
    out.append("## How to Use This Plan")
    out.append("")
    out.append("1. **Start Wave 1 stories immediately** — no HIGH prerequisites.")
    out.append("2. **Begin Wave N only when all direct HIGH dependencies are Done.**")
    out.append(
        "3. **Watch the critical path** — any delay on a critical-path story delays the program."
    )
    out.append(
        "4. **Re-run after any change** — use `/arh-plan-program` for re-inference or `/arh-refresh-graph` for status-only refresh."
    )

    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    with open(OUTPUT, "w") as f:
        f.write("\n".join(out) + "\n")


# ── Main ───────────────────────────────────────────────────────────────────────


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--date", default=None, help="Date string for header (YYYY-MM-DD)"
    )
    args = parser.parse_args()

    # Use provided date or today's date (deterministic: always use --date in skill files)
    from datetime import datetime

    date_str = args.date or datetime.now(UTC).strftime("%Y-%m-%d")

    high_edges, medium_edges, all_ids = parse_edges(DEP_LIST)
    metadata = load_metadata(METADATA)

    if not all_ids:
        print("ERROR: No story IDs found in dependency-list.md.", file=sys.stderr)
        sys.exit(1)

    try:
        wave_map, topo_order = kahn_waves(all_ids, high_edges)
    except ValueError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)

    max_depth, primary_chain, all_chains = longest_path(all_ids, high_edges, topo_order)
    risks = build_risks(all_ids, metadata, high_edges, medium_edges)

    write_wave_plan(
        all_ids,
        metadata,
        wave_map,
        topo_order,
        high_edges,
        medium_edges,
        max_depth,
        primary_chain,
        all_chains,
        risks,
        date_str,
    )

    total_waves = max(wave_map.values(), default=0)
    print(
        f"wave-plan.md written: {len(all_ids)} stories, {total_waves} waves, "
        f"critical path {' → '.join(primary_chain)} ({max_depth} waves), "
        f"{len(risks)} risk(s)"
    )


if __name__ == "__main__":
    main()
