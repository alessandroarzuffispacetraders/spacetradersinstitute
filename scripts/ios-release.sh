#!/usr/bin/env bash
# Prepara una release iOS: build web (Vite) → sync Capacitor → apre Xcode.
# In Xcode poi: verifica Build number, Product → Archive → Distribute → Upload.
#
# Uso:  npm run build già incluso.  ./scripts/ios-release.sh
set -euo pipefail

cd "$(dirname "$0")/.."

echo "▸ 1/3  Build web (tsc + vite)…"
npm run build

echo "▸ 2/3  Sync Capacitor iOS (copia dist/ nel progetto nativo)…"
npx cap sync ios

echo "▸ 3/3  Apro Xcode…"
npx cap open ios

BUILD_NO="$(grep -m1 'CURRENT_PROJECT_VERSION' ios/App/App.xcodeproj/project.pbxproj | tr -dc '0-9')"
cat <<EOF

✅ Pronto. In Xcode:
   • Build number attuale: ${BUILD_NO}  (dev'essere > dell'ultimo caricato su App Store Connect)
   • Product → Archive → Distribute App → Upload
   • App Store Connect: aggancia la build alla versione, rispondi nel Resolution Center, Submit
EOF
