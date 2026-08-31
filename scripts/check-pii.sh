#!/usr/bin/env bash
# Hacking Hub Admin Dashboard - PII guard.
#
# Built after a real incident: real member names/emails/payment amounts
# ended up committed to this public repo twice - once as a raw JSON/CSV
# export, and again (the "fix" for the first leak) as literal SQL INSERT
# rows in a tracked migration file. Both times it happened because nothing
# mechanical was checking - only judgment, which failed twice in a row.
# This script is that mechanical check.
#
# Flags any email address that looks like a real personal address (a
# common free-mail domain - gmail/icloud/outlook/protonmail/yahoo/hotmail/
# live) inside a migration, a data fixture, or a CSV export, unless it's
# explicitly on scripts/pii-allowlist.txt (a short, reviewed list of
# addresses the app genuinely needs - real mentor contacts, a support
# email - see that file's own header for the actual rule). Anything else
# almost certainly means real member/payment data ended up somewhere it
# shouldn't - the fix is to seed it through the Admin UI, or a private,
# gitignored, never-committed script, not a tracked migration.
#
# Usage:
#   scripts/check-pii.sh            # scans every tracked file (CI, manual runs)
#   scripts/check-pii.sh --staged   # scans only staged content (pre-commit hook)

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

ALLOWLIST="scripts/pii-allowlist.txt"
EMAIL_RE='[a-zA-Z0-9._%+-]+@(gmail|icloud|outlook|protonmail|yahoo|hotmail|live)\.com'
PATTERNS=('supabase/*.sql' 'supabase/**/*.sql' 'src/data/*.json' 'src/data/**/*.json' '*.csv' '**/*.csv')

is_allowed() {
  local addr_lower
  addr_lower=$(echo "$1" | tr '[:upper:]' '[:lower:]')
  grep -qxiF "$addr_lower" "$ALLOWLIST" 2>/dev/null
}

mode="tree"
if [[ "${1:-}" == "--staged" ]]; then
  mode="staged"
fi

found=0

check_file_content() {
  local file="$1" content="$2"
  # grep -n on stdin loses real line numbers across multiple files, so grep
  # one match at a time and report just the match - good enough to act on.
  while IFS= read -r match; do
    [[ -z "$match" ]] && continue
    if ! is_allowed "$match"; then
      echo "  $file: $match"
      found=1
    fi
  done < <(echo "$content" | grep -ohIE "$EMAIL_RE" 2>/dev/null | sort -u)
}

echo "Scanning for un-allowlisted real-looking email addresses..."

if [[ "$mode" == "staged" ]]; then
  files=$(git diff --cached --name-only --diff-filter=ACM -- 'supabase/*.sql' 'supabase/**/*.sql' 'src/data/*.json' 'src/data/**/*.json' '*.csv' '**/*.csv' 2>/dev/null || true)
  for f in $files; do
    content=$(git show ":$f" 2>/dev/null || true)
    check_file_content "$f" "$content"
  done
else
  files=$(git ls-files -- 'supabase/*.sql' 'supabase/**/*.sql' 'src/data/*.json' 'src/data/**/*.json' '*.csv' '**/*.csv' 2>/dev/null || true)
  for f in $files; do
    content=$(cat "$f" 2>/dev/null || true)
    check_file_content "$f" "$content"
  done
fi

if [[ "$found" -eq 1 ]]; then
  echo ""
  echo "PII CHECK FAILED - real-looking email address(es) found above, not on the allowlist."
  echo "This almost certainly means real member/payment data is being committed to a"
  echo "public repo. Seed real per-member data through the Admin UI instead, or a"
  echo "private, gitignored script that's never committed - never a tracked migration."
  echo "If this really is a legitimate, reviewed address the app needs (a real mentor"
  echo "contact, a support email), add it to $ALLOWLIST with a comment explaining why."
  exit 1
fi

echo "Clean - no un-allowlisted real-looking email addresses found."
