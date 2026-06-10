#!/bin/bash
# Custom entrypoint for the read replica (official postgres image).
# On first boot it clones the primary with pg_basebackup and configures itself as
# a hot standby; on subsequent boots it just starts and resumes streaming.
set -e

REPL_USER="${POSTGRES_REPLICATION_USER:-repl_user}"
REPL_PASSWORD="${POSTGRES_REPLICATION_PASSWORD:-repl_password}"
PRIMARY_HOST="${POSTGRES_PRIMARY_HOST:-postgres}"
PRIMARY_PORT="${POSTGRES_PRIMARY_PORT:-5432}"

if [ ! -s "$PGDATA/PG_VERSION" ]; then
  echo "Replica: waiting for primary ${PRIMARY_HOST}:${PRIMARY_PORT}..."
  until pg_isready -h "$PRIMARY_HOST" -p "$PRIMARY_PORT" -U "$POSTGRES_USER" >/dev/null 2>&1; do
    sleep 2
  done

  echo "Replica: cloning primary via pg_basebackup..."
  rm -rf "${PGDATA:?}/"*
  export PGPASSWORD="$REPL_PASSWORD"
  pg_basebackup -h "$PRIMARY_HOST" -p "$PRIMARY_PORT" -U "$REPL_USER" \
    -D "$PGDATA" -Fp -Xs -P

  # Mark as a standby and point it at the primary for streaming.
  touch "$PGDATA/standby.signal"
  cat > "$PGDATA/postgresql.auto.conf" <<EOF
primary_conninfo = 'host=${PRIMARY_HOST} port=${PRIMARY_PORT} user=${REPL_USER} password=${REPL_PASSWORD} application_name=flowdesk_replica'
hot_standby = on
EOF
  chmod 0700 "$PGDATA"
  echo "Replica: clone complete; starting as hot standby."
fi

# Hand off to the stock entrypoint, which will start Postgres against $PGDATA.
exec docker-entrypoint.sh postgres
