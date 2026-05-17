#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

rm -rf "$SCRIPT_DIR/exports"
mkdir -p "$SCRIPT_DIR/exports"
echo "cleared exports/"

rm -rf "$SCRIPT_DIR/src/migrations"
mkdir -p "$SCRIPT_DIR/src/migrations"
echo "cleared src/migrations/"
