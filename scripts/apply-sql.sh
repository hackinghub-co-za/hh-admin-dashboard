#!/usr/bin/env bash
set -euo pipefail

# Hacking Hub Admin Dashboard - apply one or more SQL files straight to the
# real, linked Supabase database, instead of copy-pasting them into the
# Supabase Dashboard's SQL Editor by hand.
#
# Uses `supabase db query --linked --file <path>` - the Supabase CLI (a
# devDependency already, see package.json) is already logged in and this
# project is already linked to hh-admin-portal (kveiflphktpvsddhkspz), so
# this needs no database password, no .env file, and no extra setup at
# all. It talks to the database via the Supabase Management API using your
# existing CLI login, not a direct Postgres connection.
#
# Every migration under supabase/0NN_*.sql is deliberately written to be
# safe to re-run (CREATE TABLE IF NOT EXISTS, CREATE OR REPLACE FUNCTION,
# DROP POLICY IF EXISTS + CREATE POLICY, etc.) - there is no tracked
# "migration history" table to manage here, so this script does the one
# thing that's actually needed: run the file.
#
# If the CLI ever reports it's not logged in or not linked (e.g. on a new
# machine), fix that once with:
#   npx supabase login
#   npx supabase link --project-ref kveiflphktpvsddhkspz
#
# Usage:
#   npm run db:apply -- supabase/060_merch_orders.sql
#   npm run db:apply -- supabase/060_merch_orders.sql supabase/061_admin_notifications.sql
#
# This only handles SQL files. Edge Functions (supabase/functions/*) still
# deploy via the CLI's own command, which needs no wrapper:
#   npx supabase functions deploy <name>
#   npx supabase functions deploy   (no name - deploys every function)

if [ $# -eq 0 ]; then
  echo "Usage: npm run db:apply -- <path-to-sql-file> [more files...]" >&2
  exit 1
fi

for file in "$@"; do
  echo "Applying $file..."
  npx supabase db query --linked --file "$file"
  echo "Applied $file"
done
