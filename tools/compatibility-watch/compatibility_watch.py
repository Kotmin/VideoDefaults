#!/usr/bin/env python3
"""
VideoDefaults compatibility watcher.

Fetches open GitHub issues, applies rule-based severity classification,
and produces JSON and Markdown reports.

Usage:
  python3 tools/compatibility-watch/compatibility_watch.py \\
    --repo Kotmin/VideoDefaults --mode report
  python3 tools/compatibility-watch/compatibility_watch.py \\
    --repo Kotmin/VideoDefaults --mode ci --fail-on high
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

SCHEMA_VERSION = 1
RECENT_DAYS = 14

COMPATIBILITY_LABELS = frozenset([
    'compatibility', 'firefox', 'youtube', 'mv3', 'amo', 'ci', 'release', 'regression',
])

HIGH_LABEL_COMBOS = [
    frozenset(['compatibility', 'regression']),
    frozenset(['firefox', 'regression']),
    frozenset(['youtube', 'regression']),
]

HIGH_KEYWORD_PAIRS = [
    (['youtube changed', 'youtube update'], ['speed not working', 'broken', 'not applying']),
    (['amo', 'review'],                     ['rejected', 'rejection', 'policy violation']),
    (['firefox'],                           ['manifest error', 'runtime error', 'extension error']),
]

MEDIUM_LABELS = frozenset(['youtube', 'amo', 'ci'])
MEDIUM_KEYWORDS = [
    'youtube layout', 'youtube changed', 'ci failed', 'package failed', 'doc mismatch',
]

SPEED_KEYWORDS = ['speed not working', 'speed not applying', 'default speed', 'playback speed']

SEVERITY_RANK = {'high': 3, 'medium': 2, 'low': 1, 'none': 0}


# ---------------------------------------------------------------------------
# GitHub API
# ---------------------------------------------------------------------------

def fetch_issues(repo, token=None, per_page=100):
    url = f'https://api.github.com/repos/{repo}/issues?state=open&per_page={per_page}'
    req = urllib.request.Request(url, headers={
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'videodefaults-compat-watch/1',
    })
    if token:
        req.add_header('Authorization', f'Bearer {token}')
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        print(f'GitHub API {e.code}: {e.read().decode()}', file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f'Network error: {e}', file=sys.stderr)
        sys.exit(1)


# ---------------------------------------------------------------------------
# Classification
# ---------------------------------------------------------------------------

def _get_labels(issue):
    return {lbl['name'].lower() for lbl in issue.get('labels', [])}


def _get_text(issue):
    return ((issue.get('title') or '') + ' ' + (issue.get('body') or '')).lower()


def _is_recent(issue):
    raw = issue.get('updated_at', '')
    if not raw:
        return False
    try:
        dt = datetime.fromisoformat(raw.replace('Z', '+00:00'))
        return dt >= datetime.now(timezone.utc) - timedelta(days=RECENT_DAYS)
    except ValueError:
        return False


def classify_issue(issue):
    labels = _get_labels(issue)
    text = _get_text(issue)

    for combo in HIGH_LABEL_COMBOS:
        if combo.issubset(labels):
            return 'high', f'labeled {" + ".join(sorted(combo))}'

    for triggers, damages in HIGH_KEYWORD_PAIRS:
        if any(t in text for t in triggers) and any(d in text for d in damages):
            return 'high', 'keywords indicate active breakage'

    if _is_recent(issue) and labels & MEDIUM_LABELS:
        matched = sorted(labels & MEDIUM_LABELS)
        return 'medium', f'recent issue with labels: {", ".join(matched)}'

    if any(kw in text for kw in MEDIUM_KEYWORDS):
        return 'medium', 'contains medium-severity keywords'

    if labels & COMPATIBILITY_LABELS:
        matched = sorted(labels & COMPATIBILITY_LABELS)
        return 'low', f'compatibility label: {", ".join(matched)}'

    return None, None


def analyze(issues):
    signals = []
    speed_count = 0

    for issue in issues:
        if any(kw in _get_text(issue) for kw in SPEED_KEYWORDS):
            speed_count += 1

        severity, reason = classify_issue(issue)
        if severity:
            signals.append({
                'severity': severity,
                'issue_number': issue['number'],
                'issue_title': issue['title'],
                'issue_url': issue['html_url'],
                'reason': reason,
                'recent': _is_recent(issue),
            })

    if speed_count >= 3:
        signals.append({
            'severity': 'high',
            'issue_number': None,
            'issue_title': None,
            'issue_url': None,
            'reason': f'{speed_count} open issues mention playback speed problems',
            'recent': False,
        })

    signals.sort(key=lambda s: -SEVERITY_RANK.get(s['severity'], 0))
    overall = signals[0]['severity'] if signals else 'none'
    return signals, overall


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------

def _actions(overall, signals):
    if overall == 'none':
        return ['No compatibility signals detected — no action required.']
    actions = []
    if overall == 'high':
        actions.append('Triage and investigate high-severity issues immediately.')
        if any('speed' in s['reason'] for s in signals):
            actions.append('Test YouTube playback speed on latest Firefox stable release.')
        if any('amo' in s['reason'] for s in signals):
            actions.append('Review AMO policy changes and open rejection issues.')
        if any('firefox' in s['reason'] for s in signals):
            actions.append('Check Firefox release notes for WebExtension API changes.')
    elif overall == 'medium':
        actions.append('Review medium-severity issues and assess impact within 7 days.')
    else:
        actions.append('Monitor low-severity issues — no immediate action required.')
    return actions


def build_json_report(repo, signals, overall, generated_at):
    return {
        'schemaVersion': SCHEMA_VERSION,
        'generatedAt': generated_at,
        'repository': repo,
        'overallSeverity': overall,
        'signals': signals,
        'recommendedActions': _actions(overall, signals),
    }


def build_md_report(repo, signals, overall, generated_at, issue_count):
    em = {'high': '🔴', 'medium': '🟡', 'low': '🟢', 'none': '✅'}
    lines = [
        '# VideoDefaults Compatibility Report', '',
        f'**Generated:** {generated_at}  ',
        f'**Repository:** {repo}  ',
        f'**Open issues scanned:** {issue_count}  ',
        f'**Overall severity:** {em.get(overall, "")} {overall.upper()}', '',
        '## Signals', '',
    ]

    if not signals:
        lines += ['No compatibility signals detected.', '']
    else:
        for s in signals:
            num = s['issue_number']
            ref = f'[#{num}]({s["issue_url"]})' if num else '(aggregate)'
            title = repr(s['issue_title']) if s['issue_title'] else '(aggregate)'
            recent = ' _(recent)_' if s['recent'] else ''
            lines.append(f'- {em.get(s["severity"], "")} **{s["severity"].upper()}** {ref} {title}{recent}')
            lines.append(f'  _{s["reason"]}_')
            lines.append('')

    lines += ['## Recommended Actions', '']
    for action in _actions(overall, signals):
        lines.append(f'- {action}')
    lines += ['', '---',
              '_Rule-based checks only. AI insight checks are not part of MVP._', '']
    return '\n'.join(lines)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description='VideoDefaults compatibility watcher')
    ap.add_argument('--repo',       required=True, help='owner/repo slug')
    ap.add_argument('--mode',       choices=['report', 'ci'], default='report')
    ap.add_argument('--fail-on',    choices=['high', 'medium', 'low', 'never'],
                    default='high', dest='fail_on')
    ap.add_argument('--token',      default=os.environ.get('GITHUB_TOKEN'))
    ap.add_argument('--scope',      default='all')
    ap.add_argument('--output-dir', default='dist', dest='output_dir')
    ap.add_argument('--watchlist',
                    default='docs/compliance/compatibility-watchlist.json')
    args = ap.parse_args()

    generated_at = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

    if not args.token:
        print('warning: no GITHUB_TOKEN — unauthenticated rate limit applies', file=sys.stderr)

    print(f'fetching issues for {args.repo} ...', file=sys.stderr)
    issues = fetch_issues(args.repo, token=args.token)
    print(f'  {len(issues)} open issue(s)', file=sys.stderr)

    signals, overall = analyze(issues)

    json_report = build_json_report(args.repo, signals, overall, generated_at)
    md_report = build_md_report(args.repo, signals, overall, generated_at, len(issues))

    out = Path(args.output_dir)
    out.mkdir(exist_ok=True)
    stamp = generated_at[:10]
    json_path = out / f'compatibility-{stamp}.json'
    md_path = out / f'compatibility-{stamp}.md'

    json_path.write_text(json.dumps(json_report, indent=2))
    md_path.write_text(md_report)

    print(json.dumps(json_report, indent=2))
    print(f'\nreports: {json_path}  {md_path}', file=sys.stderr)

    if args.mode == 'ci' and args.fail_on != 'never':
        if SEVERITY_RANK.get(overall, 0) >= SEVERITY_RANK.get(args.fail_on, 3):
            print(f'CI: FAIL — {overall} severity meets --fail-on {args.fail_on}', file=sys.stderr)
            sys.exit(1)
        print(f'CI: PASS — severity {overall!r} below threshold {args.fail_on!r}', file=sys.stderr)


if __name__ == '__main__':
    main()
