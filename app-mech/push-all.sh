#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR/logs/migrations"
TIMESTAMP="$(date +%Y-%m-%dT%H-%M-%S)"
LOG_FILE="$LOG_DIR/$TIMESTAMP.log"

mkdir -p "$LOG_DIR"

log() {
  echo "$@" | tee -a "$LOG_FILE"
}

run_push() {
  local label="$1"
  local url="$2"
  local schema="$3"

  log ""
  log "── $label ──────────────────────────────────────────────"
  log "   schema : $schema"
  log "   url    : $url"
  log "   time   : $(date +%H:%M:%S)"
  log ""

  if DATABASE_URL="$url" pnpm prisma db push --force-reset --schema="$schema" 2>&1 | tee -a "$LOG_FILE"; then
    log ""
    log "   ✓ $label pushed successfully"
  else
    log ""
    log "   ✗ $label FAILED"
    exit 1
  fi
}

log "push-all  started at $TIMESTAMP"
log "log file  $LOG_FILE"

run_push \
  "Shopfront Manager" \
  "postgresql://dev:dev@localhost:54321/dev" \
  "$SCRIPT_DIR/exports/shopfront-manager-1.0111.prisma"

run_push \
  "Content Hub Pro" \
  "postgresql://dev:dev@localhost:54321/dev" \
  "$SCRIPT_DIR/exports/content-hub-pro-1.0111.prisma"

run_push \
  "Analytics Engine" \
  "mysql://dev:dev@localhost:54322/dev" \
  "$SCRIPT_DIR/exports/analytics-engine-1.0111.prisma"

log ""
log "── all done ─────────────────────────────────────────────"
log "   finished at $(date +%H:%M:%S)"
log "   log saved to $LOG_FILE"
