#!/usr/bin/env bash
# Builds the site for the local emulators, seeds demo data and captures screen.png.
set -euo pipefail
cd "$(dirname "$0")/../.."
pnpm build:emu >/dev/null
pnpm exec firebase emulators:exec --only auth,firestore,storage,functions --project demo-ajith \
  "node scripts/seed.mjs --emulator --fixtures && (node scripts/with-env.mjs .env.emulator pnpm --dir site preview >/dev/null 2>&1 &) && sleep 6 && node marketing/fiverr/capture.mjs"
