#!/bin/bash
# Runs once during primary initdb (official postgres image initdb.d hook).
# Creates a replication role and allows replication connections from the replica.
set -e

REPL_USER="${POSTGRES_REPLICATION_USER:-repl_user}"
REPL_PASSWORD="${POSTGRES_REPLICATION_PASSWORD:-repl_password}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE ROLE "$REPL_USER" WITH REPLICATION LOGIN PASSWORD '$REPL_PASSWORD';
EOSQL

# Permit streaming-replication connections for that role over the compose network.
echo "host replication $REPL_USER all scram-sha-256" >> "$PGDATA/pg_hba.conf"

echo "Primary configured for streaming replication (role: $REPL_USER)."
