#!/usr/bin/env bash
# Static guards run by `npm test` (tasks.md T036):
#  (a) Constitution II — App specifics only inside src/server/app-adapter/
#  (b) FR-082 — no outbound URLs except localhost and Open-Meteo
#  (c) FR-030 — adapter write calls only from HTTP routes (i.e. user-initiated)
#  (d) Constitution II v2.1.1 / spec 003 A3-1d — App version literals only in app-adapter/versions.ts
set -euo pipefail
cd "$(dirname "$0")/.."
fail=0

# (a) App-specific strings outside the adapter (and its contract tests/fixtures).
if hits=$(grep -RInE 'exa\.[a-z_]+_pb|x-codeium-csrf|csrf_token|language_server|\.gemini/' src \
  --include='*.ts' --include='*.tsx' | grep -v '^src/server/app-adapter/' | grep -v '^src/server/log.ts'); then
  echo "✗ (a) Antigravity App internals referenced outside src/server/app-adapter/:"; echo "$hits"; fail=1
fi

# (b) Outbound URLs in source and in the built bundle.
allowed='https?://(127\.0\.0\.1|localhost|local\b|api\.open-meteo\.com|open-meteo\.com|www\.w3\.org)'
scan_urls() {
  grep -RhoE "https?://[A-Za-z0-9.-]+" "$@" 2>/dev/null | grep -vE "$allowed" | sort -u || true
}
src_urls=$(scan_urls src --include='*.ts' --include='*.tsx')
if [ -n "$src_urls" ]; then echo "✗ (b) Unexpected outbound URLs in src/:"; echo "$src_urls"; fail=1; fi
if [ -d dist/web ]; then
  # Only flag URLs used as fetch/import targets in our bundle; library doc links in comments are stripped by the build.
  bundle_urls=$(grep -RhoE "(fetch|import|src|href)\(?[\"'\`]https?://[A-Za-z0-9.-]+" dist/web 2>/dev/null | grep -oE 'https?://[A-Za-z0-9.-]+' | grep -vE "$allowed" | sort -u || true)
  if [ -n "$bundle_urls" ]; then echo "✗ (b) Unexpected outbound URLs in dist/web:"; echo "$bundle_urls"; fail=1; fi
fi

# (c) Agent-changing adapter calls must only appear in HTTP routes.
if hits=$(grep -RInE '\.(sendMessage|startConversation|cancel|answerPermission|answerQuestion|deleteConversation)\(' src/server \
  --include='*.ts' | grep -v '^src/server/http/routes/' | grep -v '^src/server/app-adapter/'); then
  echo "✗ (c) Agent write calls outside src/server/http/routes/:"; echo "$hits"; fail=1
fi

# (d) App version numbers are named only in the verified-version list.
if hits=$(grep -RInE '\b2\.(24|29)\.0\b' src --include='*.ts' --include='*.tsx' | grep -v '^src/server/app-adapter/versions.ts:'); then
  echo "✗ (d) App version literal outside versions.ts:"; echo "$hits"; fail=1
fi

# (e) Spec 003 US4: the compat script only uses inspectCompat, and nothing in the app runs it (FR-016a).
if bad=$(grep -E '^import' scripts/check-compat.ts | grep -vE "^import \{ inspectCompat \} from '../src/server/app-adapter/index';$|^import \{ writeFile \} from 'node:fs/promises';$"); then
  echo "✗ (e) scripts/check-compat.ts may only import inspectCompat:"; echo "$bad"; fail=1
fi
if hits=$(grep -RInE "inspectCompat|from '\./compat'|app-adapter/compat" src --include='*.ts' --include='*.tsx' | grep -vE '^src/server/app-adapter/(index|compat)\.ts:'); then
  echo "✗ (e) inspectCompat / compat.ts used outside the adapter (Agent Office must not run it):"; echo "$hits"; fail=1
fi

if [ "$fail" -eq 0 ]; then echo "✓ check-guards: adapter isolation, outbound URLs, user-initiated writes, version literals, compat isolation"; fi
exit "$fail"
