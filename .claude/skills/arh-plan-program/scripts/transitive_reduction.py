#!/usr/bin/env python3
"""
Compute the transitive reduction of docs/program/dependency-list.md and write
the reduced edge set to docs/program/dependency-list-reduced.md.

An edge (u, v) is redundant if v is reachable from u via a path of length >= 2
through the original graph. Reachability is computed once from the full original
edge set; decisions are independent per edge.

Uses Python stdlib only. Exit 0 on success, exit 1 on error.

Usage: python3 ${CLAUDE_SKILL_DIR}/scripts/transitive_reduction.py [input] [output]
"""

import os
import re
import sys
from collections import defaultdict

DEFAULT_INPUT = "docs/program/dependency-list.md"
DEFAULT_OUTPUT = "docs/program/dependency-list-reduced.md"


def parse_edges(path):
    """Return list of (from_id, to_id, confidence) tuples."""
    try:
        with open(path) as f:
            lines = f.readlines()
    except FileNotFoundError:
        print(f"ERROR: File not found: {path}", file=sys.stderr)
        sys.exit(1)

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

    return edges


def build_reachability(edges):
    """
    For every node u, compute the set of nodes reachable from u in 1+ hops.
    Uses iterative DFS on the original full edge set.
    """
    adj = defaultdict(set)
    nodes = set()
    for u, v, _ in edges:
        adj[u].add(v)
        nodes.add(u)
        nodes.add(v)

    cache = {}

    def reachable(start):
        if start in cache:
            return cache[start]
        visited = set()
        stack = list(adj[start])
        while stack:
            node = stack.pop()
            if node in visited:
                continue
            visited.add(node)
            stack.extend(adj[node])
        cache[start] = visited
        return visited

    for node in nodes:
        reachable(node)

    return cache, adj


def transitive_reduction(edges):
    """
    Return the subset of edges that form the transitive reduction.
    Edge (u, v) is redundant if v is reachable from any direct successor w of u
    where w != v (i.e. a length-2+ path u → w → … → v exists).
    """
    reach, adj = build_reachability(edges)

    reduced = []
    for u, v, conf in edges:
        # Check all direct successors of u other than v
        redundant = any(v in reach.get(w, set()) for w in adj[u] if w != v)
        if not redundant:
            reduced.append((u, v, conf))

    return reduced


def write_output(path, input_path, original_edges, reduced_edges):
    by_conf = {"HIGH": [], "MEDIUM": []}
    for u, v, conf in reduced_edges:
        if conf in by_conf:
            by_conf[conf].append((u, v))

    removed = len(original_edges) - len(reduced_edges)

    lines = [
        "# Program — Dependency List (Transitive Reduction)\n",
        "\n",
        "| Field | Value |\n",
        "|---|---|\n",
        f"| Source | {input_path} |\n",
        f"| Original edges | {len(original_edges)} |\n",
        f"| Reduced edges | {len(reduced_edges)} |\n",
        f"| Removed (redundant) | {removed} |\n",
        "\n",
        "---\n",
        "\n",
    ]

    for conf, label in (("HIGH", "HIGH — Sprint-blocked"), ("MEDIUM", "MEDIUM — Integration-blocked")):
        conf_edges = by_conf[conf]
        lines.append(f"## {label}\n\n")
        if conf_edges:
            lines.append("| From (upstream) | To (downstream) |\n")
            lines.append("|---|---|\n")
            for u, v in conf_edges:
                lines.append(f"| {u} | {v} |\n")
        else:
            lines.append("No edges.\n")
        lines.append("\n---\n\n")

    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, "w") as f:
        f.writelines(lines)


def main():
    input_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_INPUT
    output_path = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_OUTPUT

    original = parse_edges(input_path)
    if not original:
        print("ERROR: No edges found in dependency list.", file=sys.stderr)
        sys.exit(1)

    reduced = transitive_reduction(original)
    write_output(output_path, input_path, original, reduced)

    orig_c = {"HIGH": 0, "MEDIUM": 0}
    red_c = {"HIGH": 0, "MEDIUM": 0}
    for _, _, c in original:
        if c in orig_c:
            orig_c[c] += 1
    for _, _, c in reduced:
        if c in red_c:
            red_c[c] += 1

    print(
        f"Transitive reduction complete.\n"
        f"  Original : {len(original):3d} edges "
        f"({orig_c['HIGH']} HIGH | {orig_c['MEDIUM']} MEDIUM)\n"
        f"  Reduced  : {len(reduced):3d} edges "
        f"({red_c['HIGH']} HIGH | {red_c['MEDIUM']} MEDIUM)\n"
        f"  Removed  : {len(original) - len(reduced):3d} redundant edges\n"
        f"  Written  : {output_path}"
    )
    sys.exit(0)


if __name__ == "__main__":
    main()
