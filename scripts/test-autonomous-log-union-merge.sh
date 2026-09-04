#!/usr/bin/env bash
set -euo pipefail

root="$(mktemp -d)"
trap 'rm -rf "$root"' EXIT
repo="$root/repo"
mkdir -p "$repo/docs"
cd "$repo"

git init -q
git config user.name 'Hava81 test'
git config user.email 'hava81-test@example.invalid'

cat > .gitattributes <<'ATTRS'
docs/AUTONOMOUS_PROGRESS.md merge=union
docs/AUTONOMOUS_DECISIONS.md merge=union
ATTRS
printf 'base progress\n' > docs/AUTONOMOUS_PROGRESS.md
printf 'base decision\n' > docs/AUTONOMOUS_DECISIONS.md
git add .gitattributes docs
git commit -qm 'base'
base="$(git rev-parse HEAD)"

git checkout -qb left
printf 'left progress\n' >> docs/AUTONOMOUS_PROGRESS.md
printf 'left decision\n' >> docs/AUTONOMOUS_DECISIONS.md
git add docs
git commit -qm 'left checkpoint'

git checkout -qb right "$base"
printf 'right progress\n' >> docs/AUTONOMOUS_PROGRESS.md
printf 'right decision\n' >> docs/AUTONOMOUS_DECISIONS.md
git add docs
git commit -qm 'right checkpoint'

GIT_EDITOR=true git rebase left >/dev/null

for entry in 'left progress' 'right progress'; do
  grep -Fqx "$entry" docs/AUTONOMOUS_PROGRESS.md
done
for entry in 'left decision' 'right decision'; do
  grep -Fqx "$entry" docs/AUTONOMOUS_DECISIONS.md
done
if grep -Eq '^(<<<<<<<|=======|>>>>>>>)' docs/AUTONOMOUS_PROGRESS.md docs/AUTONOMOUS_DECISIONS.md; then
  echo 'unexpected conflict markers in append-only docs' >&2
  exit 1
fi

echo 'autonomous append-only log union merge contract passed'
