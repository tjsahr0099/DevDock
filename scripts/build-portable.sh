#!/bin/bash
# DevDock 포터블 빌드 스크립트
# 빌드 후 DevDock.exe + data/ 를 버전 포함 zip으로 압축

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# tauri.conf.json에서 버전 추출
VERSION=$(grep -o '"version": "[^"]*"' "$PROJECT_DIR/src-tauri/tauri.conf.json" | head -1 | cut -d'"' -f4)
PRODUCT_NAME="DevDock"
ZIP_NAME="${PRODUCT_NAME}-v${VERSION}-portable.zip"
RELEASE_DIR="$PROJECT_DIR/src-tauri/target/release"
DIST_DIR="$PROJECT_DIR/dist-portable"

echo "=== DevDock Portable Build ==="
echo "Version: $VERSION"
echo ""

# 1. Tauri 빌드
echo "[1/3] Building..."
cd "$PROJECT_DIR"
npm run tauri build

# 2. 포터블 폴더 구성
echo "[2/3] Preparing portable package..."
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR/$PRODUCT_NAME"

cp "$RELEASE_DIR/$PRODUCT_NAME.exe" "$DIST_DIR/$PRODUCT_NAME/"
cp -r "$PROJECT_DIR/data" "$DIST_DIR/$PRODUCT_NAME/"

# 3. ZIP 압축
echo "[3/3] Creating $ZIP_NAME..."
cd "$DIST_DIR"
powershell -Command "Compress-Archive -Path '$PRODUCT_NAME' -DestinationPath '../$ZIP_NAME' -Force"

# 정리
cd "$PROJECT_DIR"
rm -rf "$DIST_DIR"

echo ""
echo "=== Build Complete ==="
echo "Output: $PROJECT_DIR/$ZIP_NAME"
