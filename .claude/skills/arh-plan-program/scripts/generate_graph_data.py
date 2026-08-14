#!/usr/bin/env python3
"""
Build docs/program/dependency-graph-visual.html from locked planning artifacts.

Reads:
  <skill-dir>/templates/dependency-graph.html  — static template
  docs/program/dependency-list.md          — edges (From, To, Confidence)
  docs/program/wave-plan.md                — wave assignments, critical path
  docs/stories/*.md                        — story metadata
  docs/research/*.md                       — research verdicts / scores
  docs/program/.action-state.json          — last action label (optional)
  README.md                                — project name (optional)

Writes:
  docs/program/dependency-graph-visual.html  — self-contained HTML with data inlined

Data is inlined directly into the HTML (no external JS file required). Works on
file:// protocol without a local server.

Exit codes:
  0 — success
  1 — fatal error (missing required input)

Usage:
  python3 ${CLAUDE_SKILL_DIR}/scripts/generate_graph_data.py
  python3 ${CLAUDE_SKILL_DIR}/scripts/generate_graph_data.py --action "Graph refreshed on 2026-06-18"
"""

import argparse
import json
import os
import re
import sys
from collections import defaultdict

TEMPLATE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../templates/dependency-graph.html")
DEP_LIST = "docs/program/dependency-list.md"
WAVE_PLAN = "docs/program/wave-plan.md"
STORIES_DIR = "docs/stories"
RESEARCH_DIR = "docs/research"
FEATURES_DIR = "docs/features"
ACTION_STATE = "docs/program/.action-state.json"
HTML_OUTPUT = "docs/program/dependency-graph-visual.html"

PHASE_LABELS = {
    "story": "Story drafted",
    "story-validated": "Story validated",
    "research": "Research complete",
    "plan-requirements": "Requirements planned",
    "plan-requirements-approved": "Requirements approved",
    "plan-implementation": "Implementation planned",
    "implementation": "Implementing",
    "review": "In review",
    "security-reviewed": "Security reviewed",
}


# ── Helpers ────────────────────────────────────────────────────────────────────


def epic_of(story_id):
    m = re.match(r"^([A-Z]+)", story_id)
    return m.group(1) if m else None


STATUS_MAP = {
    "draft": "DFT",
    "in review": "INT",
    "validated": "VAL",
    "ready for dev": "PLA",
    "in progress": "BUI",
    "done": "DON",
}
CONF_MAP = {"HIGH": "H", "MEDIUM": "M", "LOW": "L"}


# ── Parsers ────────────────────────────────────────────────────────────────────


def parse_edges(path):
    """Return list of (from_id, to_id, conf_label) and set of all story IDs."""
    try:
        with open(path) as f:
            lines = f.readlines()
    except FileNotFoundError:
        print(f"ERROR: {path} not found. Run /arh-plan-program first.", file=sys.stderr)
        sys.exit(1)

    edges = []
    all_ids = set()
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
                    edges.append((from_id, to_id, CONF_MAP.get(current_conf, "M")))
                    all_ids.update([from_id, to_id])

    return edges, all_ids


def build_adjacency(edges):
    """Return (depends_on_map, blocks_map) derived purely from the edge list."""
    depends_on = defaultdict(list)  # story -> [stories it depends on]
    blocks = defaultdict(list)  # story -> [stories it blocks]
    for from_id, to_id, _ in edges:
        # edge means from_id must come before to_id
        depends_on[to_id].append(from_id)
        blocks[from_id].append(to_id)
    return depends_on, blocks


def filter_wave_inconsistent_edges(raw_edges, wave_map):
    """Drop edges where the dependency's wave is later than the dependent's wave.

    A story in Wave N cannot be a prerequisite for a story in Wave M where M < N.
    These edges indicate LLM hallucination in the dependency list and would produce
    visually contradictory graphs (e.g. Wave 1 story appearing downstream of Wave 2).
    """
    clean = []
    for from_id, to_id, conf in raw_edges:
        w_from = wave_map.get(from_id)
        w_to = wave_map.get(to_id)
        if w_from and w_to and w_from > w_to:
            print(
                f"WARN: dropping edge {from_id}(Wave {w_from}) → {to_id}(Wave {w_to}): "
                "dependency contradicts wave ordering",
                file=sys.stderr,
            )
            continue
        clean.append((from_id, to_id, conf))
    return clean


def parse_story(path):
    """Extract metadata from a single story markdown file."""
    try:
        with open(path) as f:
            content = f.read()
    except OSError:
        return {}

    result = {}

    # Title: "# Story: ID — Title" or "# Story: ID - Title"
    m = re.search(r"^# Story:\s*[A-Z]+-\d+\s*[—\-]+\s*(.+)", content, re.MULTILINE)
    result["title"] = m.group(1).strip() if m else None

    # Status
    m = re.search(r"^\*\*Status\*\*[:\s]+(.+)", content, re.MULTILINE)
    if m:
        raw = m.group(1).strip().lower()
        result["statusCode"] = STATUS_MAP.get(raw, "DFT")
    else:
        result["statusCode"] = "DFT"

    # Effort: XS/S/M/L/XL
    m = re.search(r"^\*\*Effort\*\*[:\s]+(.+)", content, re.MULTILINE)
    if m:
        raw = m.group(1).strip().upper()
        result["effort"] = raw if raw in ("XS", "S", "M", "L", "XL") else None
    else:
        result["effort"] = None

    # User story: text under "## User story" section
    m = re.search(
        r"## User story\s*\n+(.+?)(?=\n##|\Z)", content, re.DOTALL | re.IGNORECASE
    )
    if m:
        text = m.group(1).strip()
        # Grab first non-empty paragraph only
        first_para = re.split(r"\n\n", text)[0].strip()
        result["userStory"] = first_para if first_para else None
    else:
        # Fall back to first "As a ..." sentence anywhere
        m = re.search(r"(As a\s+.+?so that .+?\.)", content, re.DOTALL | re.IGNORECASE)
        result["userStory"] = m.group(1).strip() if m else None

    return result


def parse_research(story_id):
    """Return (has_research, verdict, score) for a story."""
    path = os.path.join(RESEARCH_DIR, f"{story_id}.md")
    if not os.path.isfile(path):
        return False, None, None

    try:
        with open(path) as f:
            content = f.read()
    except OSError:
        return True, None, None

    # Verdict: match longest first to avoid GO matching GO-WITH-CONDITIONS
    verdict = None
    for candidate in ("GO-WITH-CONDITIONS", "SPIKE", "GO"):
        if re.search(
            rf"\*\*Verdict\*\*[:\s]+{re.escape(candidate)}", content, re.IGNORECASE
        ):
            verdict = candidate
            break
    if verdict is None:
        m = re.search(r"\*\*Verdict\*\*[:\s]+([A-Z\-]+)", content)
        verdict = m.group(1) if m else None

    # Score: "**Score**: 82/100" or "**Total** | 82"
    score = None
    m = re.search(r"\*\*Score\*\*[:\s]+(\d+)\s*/\s*100", content)
    if m:
        score = int(m.group(1))
    else:
        m = re.search(r"\*\*Total\*\*\s*\|\s*(\d+)", content)
        if m:
            score = int(m.group(1))

    return True, verdict, score


def synthesize_activity_log(phase, last_updated, feature):
    """Derive a full activity history from existing state fields.

    The most recent phase gets last_updated as its timestamp. All prior completed
    phases are inferred from result fields (research_verdict, gate, review, etc.)
    and shown without timestamps since per-phase timestamps aren't stored.

    Returns a list ordered most-recent first.
    """
    if not phase:
        return []

    # Ordered phase sequence (oldest → newest)
    phase_order = [
        "story",
        "story-validated",
        "research",
        "plan-requirements",
        "plan-requirements-approved",
        "plan-implementation",
        "implementation",
        "validation",
        "review",
        "security-reviewed",
    ]

    def entry_for_phase(p, timestamp=None):
        base = {"timestamp": timestamp} if timestamp else {}

        if p == "story-validated":
            return {**base, "command": "validate-story", "description": "Story validated", "result": "PASS"}

        if p == "story":
            story_status = feature.get("story", "")
            if story_status == "escalated":
                return {**base, "command": "validate-story", "description": "Story validation escalated", "result": "FAIL"}
            return {**base, "command": "intake", "description": "Story drafted", "result": "PASS"}

        if p == "research":
            verdict = feature.get("research_verdict") or ""
            result = "FAIL" if verdict in ("SPIKE", "BLOCK") else "PASS"
            desc = f"Research complete — {verdict}" if verdict else "Research complete"
            return {**base, "command": "research", "description": desc, "result": result}

        if p == "plan-requirements":
            gate = feature.get("gate") or ""
            desc = f"Requirements gate — {gate}" if gate else "Requirements in review"
            result = "PENDING" if gate in ("PENDING", "") else "PASS"
            return {**base, "command": "plan-requirements", "description": desc, "result": result}

        if p == "plan-requirements-approved":
            return {**base, "command": "plan-requirements", "description": "Requirements gate approved", "result": "PASS"}

        if p == "plan-implementation":
            return {**base, "command": "plan-implementation", "description": "Implementation plan complete", "result": "PASS"}

        if p == "implementation":
            return {**base, "command": "implement", "description": "Implementation complete", "result": "PASS"}

        if p == "validation":
            return {**base, "command": "validate", "description": "Validation complete", "result": "PASS"}

        if p == "review":
            review = feature.get("review") or ""
            result = "FAIL" if review == "BLOCKED" else "PASS"
            desc = f"Code review — {review}" if review else "Code review complete"
            return {**base, "command": "review", "description": desc, "result": result}

        if p == "security-reviewed":
            security = feature.get("security") or ""
            result = "FAIL" if security == "BLOCKED" else "PASS"
            findings = feature.get("security_findings") or {}
            c, h = findings.get("critical", 0), findings.get("high", 0)
            detail = f" (C={c} H={h})" if (c or h) else ""
            desc = f"Security review — {security}{detail}" if security else "Security review complete"
            return {**base, "command": "security-review", "description": desc, "result": result}

        return None

    current_idx = phase_order.index(phase) if phase in phase_order else -1
    if current_idx == -1:
        # Unknown phase — return single synthesized entry with timestamp
        e = entry_for_phase(phase, last_updated)
        return [e] if e else []

    # Build list: current phase (with timestamp) first, then prior phases (no timestamp)
    entries = []
    current_entry = entry_for_phase(phase, last_updated)
    if current_entry:
        entries.append(current_entry)

    for p in reversed(phase_order[:current_idx]):
        e = entry_for_phase(p)
        if e:
            entries.append(e)

    return entries


def read_feature_state(story_id, features_index):
    """Return (statusCode, lastAction, activityLog) from state files with dual-read strategy.

    Reads from docs/features/<id>/state.json (per-feature, primary post-plan),
    falling back to docs/state/features.json (index, primary pre-plan).

    activityLog is synthesized from existing state fields (phase, last_updated, result
    fields) — no separate activity_log field required in the state file.
    Returns (None, None, []) when neither file exists.
    """
    feature = None

    # Try per-feature file first (post-plan primary source)
    per_feature_path = os.path.join(FEATURES_DIR, story_id, "state.json")
    if os.path.isfile(per_feature_path):
        try:
            with open(per_feature_path) as f:
                feature = json.load(f)
        except (OSError, json.JSONDecodeError):
            pass

    # Fall back to index (pre-plan primary source)
    if not feature:
        feature = features_index.get(story_id)

    if not feature:
        return None, None, []

    phase = feature.get("phase") or ""
    last_updated = feature.get("last_updated") or ""

    # Derive statusCode from phase
    if phase in ("story", "story-validated"):
        status_code = "INT"
    elif phase == "research":
        status_code = "RES"
    elif phase in (
        "plan-requirements",
        "plan-requirements-approved",
        "plan-implementation",
    ):
        status_code = "PLA"
    elif phase == "implementation":
        status_code = "BUI"
    elif phase == "validation":
        status_code = "VAL"
    elif phase in ("review", "security-reviewed"):
        status_code = "REV"
    else:
        status_code = None  # fall back to story file

    # Format date from ISO timestamp
    date_str = last_updated[:10] if last_updated else ""
    label = PHASE_LABELS.get(phase, phase.replace("-", " ").title() if phase else "")
    last_action = f"{label} · {date_str}" if date_str else label or None

    # Use activity_log from per-feature state.json if present (sorted descending by timestamp)
    raw_log = feature.get("activity_log") or []
    if raw_log:
        activity_log = sorted(raw_log, key=lambda e: e.get("timestamp", ""), reverse=True)
    else:
        # Synthesize full history from completed phase result fields
        activity_log = synthesize_activity_log(phase, last_updated, feature)

    return status_code, last_action, activity_log


def parse_wave_plan(path):
    """Return wave_map {story_id: wave_num} from wave-plan.md."""
    try:
        with open(path) as f:
            content = f.read()
    except FileNotFoundError:
        print(f"ERROR: {path} not found. Run /arh-plan-program first.", file=sys.stderr)
        sys.exit(1)

    # Wave assignments from "### Wave N" sections
    wave_map = {}
    id_re = re.compile(r"^[A-Z]+-\d+$")

    breakdown_m = re.search(
        r"^## Wave Breakdown\n(.*?)(?=^## |\Z)", content, re.MULTILINE | re.DOTALL
    )
    scope = breakdown_m.group(1) if breakdown_m else content

    wave_re = re.compile(r"^### Wave (\d+)", re.MULTILINE)
    parts = wave_re.split(scope)

    i = 1
    while i + 1 < len(parts):
        wave_num = int(parts[i])
        wave_content = parts[i + 1]
        i += 2

        for line in wave_content.splitlines():
            s = line.strip()
            if s.startswith("|"):
                cols = [c.strip() for c in s.split("|")[1:-1]]
                if cols and id_re.match(cols[0]):
                    wave_map[cols[0]] = wave_num

    return wave_map


def read_action_state(cli_action):
    """Return lastAction string from CLI arg, .action-state.json, or fallback."""
    if cli_action:
        return cli_action
    try:
        with open(ACTION_STATE) as f:
            data = json.load(f)
        return data.get("lastAction", "—")
    except (OSError, json.JSONDecodeError):
        return "—"


def read_project_name():
    """Extract project name from README.md first H1, or fall back to directory name."""
    for candidate in ("README.md",):
        try:
            with open(candidate) as f:
                for line in f:
                    m = re.match(r"^# (.+)", line)
                    if m:
                        # Strip everything after " — " or " - " for a cleaner name
                        name = re.split(r"\s+[—\-]+\s+", m.group(1))[0].strip()
                        return name
        except OSError:
            continue
    return os.path.basename(os.getcwd())


# ── Build ──────────────────────────────────────────────────────────────────────


def build_nodes(all_ids, depends_on, blocks, wave_map, features_index):
    nodes = []
    story_files = {}

    # Index story files by ID
    try:
        for fname in os.listdir(STORIES_DIR):
            if fname.endswith(".md"):
                m = re.match(r"^([A-Z]+-\d+)", fname)
                if m:
                    story_files[m.group(1)] = os.path.join(STORIES_DIR, fname)
    except FileNotFoundError:
        pass

    for sid in sorted(all_ids):
        meta = parse_story(story_files[sid]) if sid in story_files else {}
        has_research, verdict, score = parse_research(sid)
        state_status, last_action, activity_log = read_feature_state(sid, features_index)

        nodes.append(
            {
                "data": {
                    "id": sid,
                    "title": meta.get("title") or sid,
                    "statusCode": state_status or meta.get("statusCode", "DFT"),
                    "effort": meta.get("effort"),
                    "epic": epic_of(sid),
                    "wave": wave_map.get(sid),
                    "hasResearch": has_research,
                    "researchVerdict": verdict,
                    "researchScore": score,
                    "userStory": meta.get("userStory"),
                    "dependsOn": depends_on.get(sid, []),
                    "blocks": blocks.get(sid, []),
                    "lastAction": last_action,
                    "activityLog": activity_log,
                }
            }
        )

    return nodes


def visual_reduction(edges):
    """Remove visually redundant edges for rendering only.

    An edge (u, v) is redundant for display if v is reachable from u via a path
    of length >= 2 through the full edge set. The full edge set is preserved in
    node dependsOn/blocks — this reduction is purely a layout concern.
    """
    adj = defaultdict(set)
    for u, v, _ in edges:
        adj[u].add(v)

    reach_cache = {}

    def reachable(start):
        if start in reach_cache:
            return reach_cache[start]
        visited, stack = set(), list(adj[start])
        while stack:
            node = stack.pop()
            if node in visited:
                continue
            visited.add(node)
            stack.extend(adj[node])
        reach_cache[start] = visited
        return visited

    for u, _, __ in edges:
        reachable(u)

    return [
        (u, v, conf)
        for u, v, conf in edges
        if not any(v in reach_cache.get(w, set()) for w in adj[u] if w != v)
    ]


def build_edges(raw_edges):
    display_edges = visual_reduction(raw_edges)
    return [
        {"data": {"id": f"e-{f}-{t}", "source": f, "target": t, "label": label}}
        for f, t, label in display_edges
    ]


def build_meta(wave_map, last_action, project):
    total_waves = max(wave_map.values(), default=0)
    return {
        "project": project,
        "totalWaves": total_waves,
        "lastAction": last_action,
    }


# ── Main ───────────────────────────────────────────────────────────────────────


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--action", default=None, help="Override lastAction label written to META"
    )
    args = parser.parse_args()

    raw_edges, all_ids = parse_edges(DEP_LIST)
    wave_map = parse_wave_plan(WAVE_PLAN)
    raw_edges = filter_wave_inconsistent_edges(raw_edges, wave_map)
    depends_on, blocks = build_adjacency(raw_edges)
    last_action = read_action_state(args.action)
    project = read_project_name()

    # Load features index (docs/state/features.json)
    features_index = {}
    try:
        with open("docs/state/features.json") as f:
            features_index = json.load(f)
    except (OSError, json.JSONDecodeError):
        pass

    # Stories isolated from the dep list (in docs/stories but not in any edge)
    try:
        for fname in os.listdir(STORIES_DIR):
            if fname.endswith(".md"):
                m = re.match(r"^([A-Z]+-\d+)", fname)
                if m:
                    all_ids.add(m.group(1))
    except FileNotFoundError:
        pass

    nodes = build_nodes(all_ids, depends_on, blocks, wave_map, features_index)
    edges = build_edges(raw_edges)
    meta = build_meta(wave_map, last_action, project)

    # Read template
    try:
        with open(TEMPLATE) as f:
            html = f.read()
    except FileNotFoundError:
        print(f"ERROR: template not found: {TEMPLATE}", file=sys.stderr)
        sys.exit(1)

    # Inline data — escape </ to prevent early </script> termination
    def js(obj):
        return json.dumps(obj, indent=2, ensure_ascii=False).replace("</", "<\\/")

    nodes_js = ",\n    ".join(js(n) for n in nodes)
    edges_js = ",\n    ".join(js(e) for e in edges)
    meta_js = js(meta)

    html = html.replace("/* GRAPH_NODES */", nodes_js)
    html = html.replace("/* GRAPH_EDGES */", edges_js)
    html = html.replace("/* GRAPH_META */ null", meta_js)

    os.makedirs(os.path.dirname(HTML_OUTPUT), exist_ok=True)
    with open(HTML_OUTPUT, "w") as f:
        f.write(html)

    h = sum(1 for e in edges if e["data"]["label"] == "H")
    m_count = sum(1 for e in edges if e["data"]["label"] == "M")
    res = sum(1 for n in nodes if n["data"]["hasResearch"])
    print(
        f"dependency-graph-visual.html written: {len(nodes)} nodes, {len(edges)} edges "
        f"({h} H | {m_count} M), {res} with research, {len(wave_map)} wave-assigned"
    )


if __name__ == "__main__":
    main()
