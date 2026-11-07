
set -u
cd /d/AutoAgentloop/release/b-c067fdb-20261107
EV=/d/AutoAgentloop/evidence/20261108-final/b1
export LC_ALL=C
find . -type f -print0 | sort -z | xargs -0 sha256sum \
  | sed -E 's/^([0-9a-f]{64}) [ *](\.\/)?/\1  /' > "$EV/manifest-full-after-fix.sha256"
echo "files=$(wc -l < "$EV/manifest-full-after-fix.sha256")"
echo "format_violations=$(grep -vcE '^[0-9a-f]{64}  [^ ]' "$EV/manifest-full-after-fix.sha256" || true)"
echo "fingerprint=$(sha256sum "$EV/manifest-full-after-fix.sha256" | cut -d' ' -f1)"
echo "--- diff vs pre-fix manifest:"
diff <(cat "$EV/manifest-full.sha256") <(cat "$EV/manifest-full-after-fix.sha256") || true
