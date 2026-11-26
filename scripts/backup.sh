#!/usr/bin/env bash
# Sauvegarde indépendante de la base (hors application).
# Usage : DATABASE_URL=postgres://... BACKUP_PASSPHRASE=... ./scripts/backup.sh [dossier]
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL requis}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE requis}"
OUT="${1:-./backups}"
PG_DUMP="${PG_DUMP:-pg_dump}"   # version du client >= version du serveur (17)
mkdir -p "$OUT"
FILE="$OUT/yfc-hpc-$(date -u +%Y%m%dT%H%M%SZ).sql.gz.gpg"
$PG_DUMP --no-owner --no-privileges --schema=public --schema=app "$DATABASE_URL" \
  | gzip -9 \
  | gpg --batch --yes --pinentry-mode loopback --passphrase "$BACKUP_PASSPHRASE" --symmetric --cipher-algo AES256 -o "$FILE"
echo "Sauvegarde écrite : $FILE"
