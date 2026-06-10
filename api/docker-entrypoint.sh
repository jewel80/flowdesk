#!/bin/sh
set -e

# Apply database migrations, then load demo data, before starting the API.
# `migrate deploy` is idempotent; the seed script is also safe to re-run.
echo "Running database migrations..."
npx prisma migrate deploy

echo "Seeding demo data..."
node dist/seed.js || echo "Seed skipped or already applied."

echo "Starting FlowDesk API..."
exec node dist/main.js
