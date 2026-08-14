#!/bin/bash

# Apply sharing RLS fix to Supabase database
# This script updates the RLS policies for room_shares and room_share_invites tables

set -e

echo "🔧 Applying Sharing RLS Fix..."
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  if [ -f .env ]; then
    echo "📄 Loading DATABASE_URL from .env file..."
    export $(grep -v '^#' .env | grep DATABASE_URL | xargs)
  fi
fi

if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL not found"
  echo ""
  echo "Please set DATABASE_URL environment variable or add it to .env file"
  echo "Example: DATABASE_URL=postgresql://user:pass@host:port/database"
  exit 1
fi

echo "✅ DATABASE_URL found"
echo ""

# Check if psql is installed
if ! command -v psql &> /dev/null; then
  echo "❌ ERROR: psql command not found"
  echo ""
  echo "Please install PostgreSQL client:"
  echo "  - Ubuntu/Debian: sudo apt-get install postgresql-client"
  echo "  - macOS: brew install postgresql"
  echo "  - Windows: Download from https://www.postgresql.org/download/windows/"
  exit 1
fi

echo "✅ psql found"
echo ""

# Check if fix-sharing-rls.sql exists
if [ ! -f "fix-sharing-rls.sql" ]; then
  echo "❌ ERROR: fix-sharing-rls.sql not found"
  echo ""
  echo "Please make sure you're running this script from the backend directory"
  exit 1
fi

echo "✅ fix-sharing-rls.sql found"
echo ""

# Apply the fix
echo "🚀 Applying RLS policy updates..."
echo ""

psql "$DATABASE_URL" < fix-sharing-rls.sql

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ SUCCESS! Sharing RLS policies have been updated"
  echo ""
  echo "📋 What was changed:"
  echo "  - Updated room_shares RLS policies to handle rooms without workspaces"
  echo "  - Updated room_share_invites RLS policies to handle rooms without workspaces"
  echo "  - Changed JOIN to LEFT JOIN for workspace_members"
  echo "  - Added checks for NULL workspace_id"
  echo ""
  echo "🧪 Next steps:"
  echo "  1. Restart your backend server (if running)"
  echo "  2. Test the share modal in the editor"
  echo "  3. Verify no 401 errors in browser console"
else
  echo ""
  echo "❌ FAILED to apply RLS policy updates"
  echo ""
  echo "💡 Alternative: Apply manually via Supabase Dashboard"
  echo "  1. Open Supabase Dashboard → SQL Editor"
  echo "  2. Copy contents of fix-sharing-rls.sql"
  echo "  3. Paste and run in SQL Editor"
  exit 1
fi
