#!/bin/bash

# Post-Build Script für iOS - Kopiert JavaScript Bundle zu Xcode Assets
# Dieses Script sollte als "Run Script Phase" in Xcode hinzugefügt werden

set -e

# Pfade definieren (für npm script Ausführung)
if [ -z "$SRCROOT" ]; then
    # Wenn von npm/pnpm ausgeführt
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
    DIST_PATH="$PROJECT_ROOT/dist/helio.iife.js"
    ASSETS_PATH="$PROJECT_ROOT/native/Helio11/Helio11/Assets.xcassets/HelioJS.dataset/helio.iife.js"
else
    # Wenn von Xcode ausgeführt
    PROJECT_ROOT="$SRCROOT/../.."
    DIST_PATH="$PROJECT_ROOT/dist/helio.iife.js"
    ASSETS_PATH="$SRCROOT/Assets.xcassets/HelioJS.dataset/helio.iife.js"
fi

echo "🔧 Post-Build: Kopiere JavaScript Bundle..."
echo "Source: $DIST_PATH"
echo "Target: $ASSETS_PATH"

# Prüfe ob das Bundle existiert
if [ ! -f "$DIST_PATH" ]; then
    echo "❌ Error: JavaScript Bundle nicht gefunden: $DIST_PATH"
    echo "💡 Führe zuerst 'pnpm build' aus"
    exit 1
fi

# Erstelle Zielverzeichnis falls nicht vorhanden
mkdir -p "$(dirname "$ASSETS_PATH")"

# Kopiere das Bundle
cp "$DIST_PATH" "$ASSETS_PATH"

echo "✅ JavaScript Bundle erfolgreich kopiert!"
echo "📦 Bundle Größe: $(du -h "$ASSETS_PATH" | cut -f1)"