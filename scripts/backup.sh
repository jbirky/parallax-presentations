#!/usr/bin/env bash
# Backs up the cloud version's data to this server's disk, a copy apart from
# Neon and R2 where it lives. Run nightly from cron:
#
#   15 3 * * * /home/jbirky/docker_server/parallax-presentations/scripts/backup.sh >> /home/jbirky/backups/parallax-presentations/backup.log 2>&1
#
# In $BACKUP_DIR:
#   database/         the prod database (Neon), from pg_dump, one per run: kept
#                     30 days, and the first of each month kept a year
#   uploads/          a mirror of the prod R2 bucket, without guest/ (guest
#                     files are deleted within hours, as promised to guests)
#   uploads-deleted/  files since deleted from R2, by run, kept 30 days
#   volumes/          the Docker volumes, empty while files are in R2
#   last-success      when the last run finished
#
# Restoring:
#   database  docker run --rm -e URL -v $BACKUP_DIR/database:/b postgres:17-alpine \
#               pg_restore --no-owner --no-privileges --dbname "$URL" /b/<file>.dump
#             (into an empty database; --clean replaces an existing one)
#   uploads   the same rclone container, copying uploads/ back to r2:<bucket>
#
# Reads DATABASE_URL and R2_* from the repo's .env. Needs Docker.

set -euo pipefail

REPO=$(cd "$(dirname "$0")/.." && pwd)
BACKUP_DIR=${BACKUP_DIR:-/home/jbirky/backups/parallax-presentations}
KEEP_DAYS=30
KEEP_MONTHS=12
STAMP=$(date +%Y-%m-%d_%H%M)
PG_IMAGE=postgres:17-alpine   # pg_dump must be at least the server's version (Neon: 17)
RCLONE_IMAGE=rclone/rclone:1.75
AS_ME="$(id -u):$(id -g)"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S')  $*"; }

# One variable from .env, without running .env as a script
env_value() {
  grep -E "^$1=" "$REPO/.env" | tail -1 | cut -d= -f2- | sed -E "s/^[\"']//; s/[\"']$//"
}
DATABASE_URL=$(env_value DATABASE_URL)
R2_ENDPOINT=$(env_value R2_ENDPOINT)
R2_ACCESS_KEY=$(env_value R2_ACCESS_KEY)
R2_SECRET_KEY=$(env_value R2_SECRET_KEY)
R2_BUCKET=$(env_value R2_BUCKET)
R2_BUCKET=${R2_BUCKET:-parallax-uploads}
for name in DATABASE_URL R2_ENDPOINT R2_ACCESS_KEY R2_SECRET_KEY; do
  [ -n "${!name}" ] || { log "FAILED: $name isn't set in $REPO/.env"; exit 1; }
done
# Handed to the containers by name (docker run -e NAME), so the values
# aren't on a command line
export DATABASE_URL
export RCLONE_CONFIG_R2_TYPE=s3 RCLONE_CONFIG_R2_PROVIDER=Cloudflare RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true
export RCLONE_CONFIG_R2_ENDPOINT="$R2_ENDPOINT"
export RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_ACCESS_KEY" RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET_KEY"

mkdir -p "$BACKUP_DIR"/{database,uploads,uploads-deleted,volumes}
chmod 700 "$BACKUP_DIR"

# ── Database ─────────────────────────────────────────────────────────────────
# Written under another name until pg_restore can read it back
dump="neondb_$STAMP.dump"
docker run --rm --user "$AS_ME" -e DATABASE_URL -e DUMP="$dump" \
  -v "$BACKUP_DIR/database":/backup "$PG_IMAGE" sh -c '
    pg_dump --format=custom --no-owner --no-privileges --file "/backup/$DUMP.partial" "$DATABASE_URL" &&
    pg_restore --list "/backup/$DUMP.partial" > /dev/null &&
    mv "/backup/$DUMP.partial" "/backup/$DUMP"'
log "database: $dump ($(du -h "$BACKUP_DIR/database/$dump" | cut -f1))"

# Older than KEEP_DAYS goes, except the first of a month within KEEP_MONTHS
now=$(date +%s)
for file in "$BACKUP_DIR"/database/neondb_*.dump "$BACKUP_DIR"/database/*.partial; do
  [ -e "$file" ] || continue
  age_days=$(( (now - $(stat -c %Y "$file")) / 86400 ))
  [ "$age_days" -le "$KEEP_DAYS" ] && continue
  if [[ "$file" =~ neondb_[0-9]{4}-[0-9]{2}-01_ ]] && [ "$age_days" -le $((KEEP_MONTHS * 31)) ]; then continue; fi
  rm -f -- "$file"
done

# ── Uploads (R2) ─────────────────────────────────────────────────────────────
# A file gone from R2 moves to uploads-deleted/<run>/ rather than away
docker run --rm --user "$AS_ME" -e HOME=/tmp \
  -e RCLONE_CONFIG_R2_TYPE -e RCLONE_CONFIG_R2_PROVIDER -e RCLONE_CONFIG_R2_NO_CHECK_BUCKET \
  -e RCLONE_CONFIG_R2_ENDPOINT -e RCLONE_CONFIG_R2_ACCESS_KEY_ID -e RCLONE_CONFIG_R2_SECRET_ACCESS_KEY \
  -v "$BACKUP_DIR":/backup "$RCLONE_IMAGE" \
  sync "r2:$R2_BUCKET" /backup/uploads --backup-dir "/backup/uploads-deleted/$STAMP" \
  --exclude 'guest/**' --fast-list --transfers 8 --checkers 16 --log-level NOTICE --config /dev/null
log "uploads: $(find "$BACKUP_DIR/uploads" -type f | wc -l) files ($(du -sh "$BACKUP_DIR/uploads" | cut -f1))"
find "$BACKUP_DIR/uploads-deleted" -mindepth 1 -maxdepth 1 -type d -mtime +"$KEEP_DAYS" -exec rm -rf -- {} +
find "$BACKUP_DIR/uploads-deleted" -mindepth 1 -maxdepth 1 -type d -empty -delete

# ── Docker volumes ───────────────────────────────────────────────────────────
docker run --rm --user "$AS_ME" \
  -v parallax-data:/src/data:ro -v parallax-uploads:/src/uploads:ro \
  -v "$BACKUP_DIR/volumes":/backup alpine tar czf "/backup/volumes.tar.gz" -C /src data uploads

date '+%Y-%m-%d %H:%M:%S' > "$BACKUP_DIR/last-success"
log "backup OK -> $BACKUP_DIR"
