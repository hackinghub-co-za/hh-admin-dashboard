#!/usr/bin/env bash
# Installs the pre-commit PII guard (scripts/check-pii.sh) into
# .git/hooks/pre-commit. Runs automatically via package.json's "prepare"
# script on `npm install`. Hooks live in .git/, which isn't itself
# versioned or shared by cloning, so this is what actually gets it in
# place on every machine (including this one, since every `git commit`
# in this workflow goes through the local .git the same way a manual
# commit would) rather than relying on someone remembering to set it up.
#
# Safe to no-op: if there's no .git directory (e.g. a Vercel build
# checkout, or a tarball install with no git history), this just skips
# quietly rather than failing the whole `npm install`.

set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -d .git ]]; then
  exit 0
fi

mkdir -p .git/hooks
cat > .git/hooks/pre-commit << 'HOOK'
#!/usr/bin/env bash
# Installed by scripts/install-git-hooks.sh - see that file and
# scripts/check-pii.sh for what this actually checks and why.
exec "$(git rev-parse --show-toplevel)/scripts/check-pii.sh" --staged
HOOK
chmod +x .git/hooks/pre-commit

echo "Installed pre-commit PII guard (scripts/check-pii.sh)."
