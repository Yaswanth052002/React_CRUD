#!/usr/bin/env python3
"""
Parse docs/program/wave-plan.md and generate docs/program/wave-gantt.html —
a self-contained interactive Gantt chart organised by delivery wave.

Usage: python3 ${CLAUDE_SKILL_DIR}/scripts/generate_gantt.py [wave-plan] [output]
"""

import json
import os
import re
import sys

DEFAULT_INPUT  = "docs/program/wave-plan.md"
DEFAULT_OUTPUT = "docs/program/wave-gantt.html"

TEMPLATE = os.path.join(os.path.dirname(__file__), '..', 'templates', 'wave-gantt.html')

EFFORT_DAYS = {'XS': 1, 'S': 3, 'M': 5, 'L': 8, 'XL': 13}


def epic_of(story_id):
    m = re.match(r'^([A-Z]+)', story_id)
    return m.group(1) if m else 'UNKNOWN'


def parse_wave_plan(path):
    with open(path) as f:
        content = f.read()

    stories = []
    wave_re = re.compile(r'^### Wave (\d+)', re.MULTILINE)
    id_re   = re.compile(r'^[A-Z]+-\d+$')

    # Restrict to the Wave Breakdown section so dependency / risk tables below are ignored.
    breakdown_m = re.search(
        r'^## Wave Breakdown\n(.*?)(?=^## |\Z)',
        content, re.MULTILINE | re.DOTALL
    )
    scope = breakdown_m.group(1) if breakdown_m else content

    # split() with a capture group interleaves: [pre, num, body, num, body, ...]
    parts = wave_re.split(scope)

    i = 1
    while i + 1 < len(parts):
        wave_num     = int(parts[i])
        wave_content = parts[i + 1]
        i += 2

        table_rows = [line.strip() for line in wave_content.splitlines() if line.strip().startswith('|')]
        if len(table_rows) < 3:
            continue

        for row in table_rows[2:]:   # skip header + separator
            cols = [c.strip() for c in row.split('|')[1:-1]]
            if not cols or not id_re.match(cols[0]):
                continue

            story_id = cols[0]
            title    = cols[1] if len(cols) > 1 else ''

            if len(cols) == 4:       # Wave 1: id | title | status | effort
                deps_str, status, effort = '', cols[2], cols[3]
            elif len(cols) >= 5:     # Wave 2+: id | title | deps | status | effort
                deps_str, status, effort = cols[2], cols[3], cols[4]
            else:
                continue

            deps = [d.strip() for d in deps_str.split(',')
                    if d.strip() and id_re.match(d.strip())]

            stories.append({
                'id':         story_id,
                'title':      title,
                'wave':       wave_num,
                'effort':     effort,
                'effortDays': EFFORT_DAYS.get(effort, 3),
                'status':     status,
                'deps':       deps,
                'epic':       epic_of(story_id),
                'progress':   0,
            })

    wave_count = max((s['wave'] for s in stories), default=1)
    return stories, wave_count


def main():
    input_path  = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_INPUT
    output_path = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_OUTPUT

    if not os.path.exists(input_path):
        print(f"ERROR: File not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    if not os.path.exists(TEMPLATE):
        print(f"ERROR: Template not found: {TEMPLATE}", file=sys.stderr)
        sys.exit(1)

    stories, wave_count = parse_wave_plan(input_path)

    if not stories:
        print("ERROR: No stories parsed from wave plan.", file=sys.stderr)
        sys.exit(1)

    stories_json = json.dumps(stories, indent=2).replace('</', '<\\/')

    with open(TEMPLATE) as f:
        html = f.read()

    html = html.replace('/* GANTT_STORIES */ []',   stories_json)
    html = html.replace('/* GANTT_WAVE_COUNT */ 0', str(wave_count))

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    with open(output_path, 'w') as f:
        f.write(html)

    print(
        f"Gantt generated.\n"
        f"  Stories: {len(stories)}\n"
        f"  Waves:   {wave_count}\n"
        f"  Written: {output_path}"
    )
    sys.exit(0)


if __name__ == "__main__":
    main()
