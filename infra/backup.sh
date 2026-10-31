#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/tmp/campus_recoverer_backups}"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/campus_recoverer_${TIMESTAMP}.sql.gz"

echo "Starting database backup to ${BACKUP_FILE}..."

if command -v pg_dump >/dev/null 2>&1; then
  PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" pg_dump \
    -h "${POSTGRES_HOST:-localhost}" \
    -p "${POSTGRES_PORT:-5432}" \
    -U "${POSTGRES_USER:-postgres}" \
    -d "${POSTGRES_DB:-campus_recoverer}" \
    | gzip > "$BACKUP_FILE"
  echo "Backup completed successfully: ${BACKUP_FILE}"
else
  echo "Warning: pg_dump not found on host. If running via docker:"
  echo "  docker exec -t campus_recoverer_postgres pg_dump -U postgres campus_recoverer | gzip > ${BACKUP_FILE}"
fi
