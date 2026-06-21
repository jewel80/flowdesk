#!/bin/sh
set -e

# Apply database migrations, then load demo data, before starting the API.
# `migrate deploy` is idempotent; the seed script is also safe to re-run.
echo "Running database migrations..."
./node_modules/.bin/prisma migrate deploy || echo "Migration deploy skipped or failed"

echo "Seeding demo data..."
node dist/seed.js || echo "Seed skipped or already applied."

echo "Starting FlowDesk API..."
exec node dist/main.js
