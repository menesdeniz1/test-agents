#!/usr/bin/env bash
# Install or update this agent template in a project.
#
# Copies .claude/ and the team rules into a target project without destroying
# what is already there:
#
#   - An existing CLAUDE.md is never overwritten. The team rules go into a
#     delimited block this script owns and rewrites in place on update;
#     everything else, including your Project context, is left alone.
#   - An existing .claude/settings.json is never overwritten; the template's
#     copy lands as settings.json.from-template for you to merge.
#   - An agent file that already exists is left alone unless --force.
#
# Usage: ./install.sh /path/to/project [--force]

set -euo pipefail

TEMPLATE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${1:-$PWD}"
FORCE=0
for arg in "$@"; do
  [ "$arg" = "--force" ] && FORCE=1
done

TARGET="$(cd "$TARGET" && pwd)"
if [ "$TARGET" = "$TEMPLATE_ROOT" ]; then
  echo "Target is the template itself. Pass a project path." >&2
  exit 1
fi

# Must match install.ps1 exactly, or the two would manage different blocks.
BEGIN_MARKER='<!-- agent-template:begin (managed block - rewritten on update) -->'
END_MARKER='<!-- agent-template:end -->'

VERSION="$(git -C "$TEMPLATE_ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)"

# --- manifest ----------------------------------------------------------
# Records the hash of every file this script installed, so a later run can
# tell "unchanged since I installed it" (safe to update) from "the user
# edited this" (leave it alone). Without this, updates never propagate.
MANIFEST="$TARGET/.claude/.template-manifest"
mkdir -p "$TARGET/.claude/agents"
touch "$MANIFEST"
NEW_MANIFEST="$(mktemp)"
trap 'rm -f "$NEW_MANIFEST"' EXIT

sha() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1
  else shasum -a 256 "$1" | cut -d' ' -f1; fi
}

recorded_hash() { grep -F "  $1" "$MANIFEST" 2>/dev/null | head -n1 | cut -d' ' -f1; }

# echoes install | update | keep
action_for() {
  local dst="$1" key="$2"
  if [ ! -e "$dst" ]; then echo install; return; fi
  if [ "$FORCE" -eq 1 ]; then echo update; return; fi
  local rec; rec="$(recorded_hash "$key")"
  if [ -n "$rec" ] && [ "$rec" = "$(sha "$dst")" ]; then echo update; else echo keep; fi
}

# --- agents ------------------------------------------------------------
installed=(); updated=(); kept=()
for f in "$TEMPLATE_ROOT"/.claude/agents/*.md; do
  name="$(basename "$f")"
  key=".claude/agents/$name"
  dst="$TARGET/$key"
  case "$(action_for "$dst" "$key")" in
    install) cp "$f" "$dst"; installed+=("$name") ;;
    update)  cp "$f" "$dst"; updated+=("$name") ;;
    keep)    kept+=("$name") ;;
  esac
  [ -e "$dst" ] && echo "$(sha "$dst")  $key" >> "$NEW_MANIFEST"
done

# --- settings.json -----------------------------------------------------
settings_key=".claude/settings.json"
settings_dst="$TARGET/$settings_key"
case "$(action_for "$settings_dst" "$settings_key")" in
  install) cp "$TEMPLATE_ROOT/.claude/settings.json" "$settings_dst"; settings_note="installed" ;;
  update)  cp "$TEMPLATE_ROOT/.claude/settings.json" "$settings_dst"; settings_note="updated (was unmodified since last install)" ;;
  keep)
    cp "$TEMPLATE_ROOT/.claude/settings.json" "$TARGET/.claude/settings.json.from-template"
    settings_note="kept yours; template copy at .claude/settings.json.from-template, merge by hand" ;;
esac
[ -e "$settings_dst" ] && echo "$(sha "$settings_dst")  $settings_key" >> "$NEW_MANIFEST"

# --- CLAUDE.md ---------------------------------------------------------
# Project context is per-project, so it must stay OUTSIDE the managed block
# or an update would wipe what you filled in.
rules="$(awk '/^## Project context/{exit} {print}' "$TEMPLATE_ROOT/CLAUDE.md")"
project_context="$(awk 'f{print} /^## Project context/{f=1; print}' "$TEMPLATE_ROOT/CLAUDE.md")"

block="$BEGIN_MARKER
<!-- template version: $VERSION -->
$rules
$END_MARKER"

if [ ! -e "$TARGET/CLAUDE.md" ]; then
  printf '%s\n\n%s\n' "$block" "$project_context" > "$TARGET/CLAUDE.md"
  md_note="created CLAUDE.md"
elif grep -qF "$BEGIN_MARKER" "$TARGET/CLAUDE.md"; then
  # awk, not python3 or sed -i: python3 is not reliably present (on Windows
  # it is often a Store stub that fails), and sed -i is not portable to BSD.
  BLOCK_FILE="$(mktemp)"; OUT_FILE="$(mktemp)"
  printf '%s\n' "$block" > "$BLOCK_FILE"
  awk -v bf="$BLOCK_FILE" -v begin="$BEGIN_MARKER" -v end="$END_MARKER" '
    skipping { if (index($0, end)) skipping = 0; next }
    index($0, begin) {
      while ((getline line < bf) > 0) print line
      close(bf)
      skipping = 1
      next
    }
    { print }
  ' "$TARGET/CLAUDE.md" > "$OUT_FILE"
  mv "$OUT_FILE" "$TARGET/CLAUDE.md"
  rm -f "$BLOCK_FILE"
  md_note="updated the managed block in your existing CLAUDE.md"
else
  if grep -qE '^##[[:space:]]+Project context' "$TARGET/CLAUDE.md"; then
    printf '\n\n%s\n' "$block" >> "$TARGET/CLAUDE.md"
  else
    printf '\n\n%s\n\n%s\n' "$block" "$project_context" >> "$TARGET/CLAUDE.md"
  fi
  md_note="appended the managed block to your existing CLAUDE.md (nothing removed)"
fi

# --- version marker ----------------------------------------------------
cat > "$TARGET/.claude/TEMPLATE_VERSION" <<EOF
version: $VERSION
installed: $(date +%Y-%m-%d)
source: $TEMPLATE_ROOT

Re-run install.sh from the template to update. The managed block in
CLAUDE.md is rewritten in place; your Project context is not touched.
EOF

sort "$NEW_MANIFEST" -o "$MANIFEST"

# --- report ------------------------------------------------------------
echo
echo "Installed agent template $VERSION into $TARGET"
[ ${#installed[@]} -gt 0 ] && echo "  agents installed: ${installed[*]}"
[ ${#updated[@]}   -gt 0 ] && echo "  agents updated:   ${updated[*]}"
[ ${#kept[@]}      -gt 0 ] && echo "  agents kept (locally modified, --force to overwrite): ${kept[*]}"
echo "  settings: $settings_note"
echo "  CLAUDE.md: $md_note"
echo
echo "Next: fill in the Project context section of CLAUDE.md (stack, test/lint/build commands)."
