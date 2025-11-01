#!/bin/bash

# Seed Database Script for Circls Application
# This script populates the database with test data

set -e

echo "=========================================="
echo "Circls Database Seeding"
echo "=========================================="
echo ""

# Check if Supabase is running
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

echo "📋 Checking Supabase status..."
if ! supabase status &> /dev/null; then
    echo "❌ Supabase is not running. Starting it now..."
    supabase start
fi

echo ""
echo "🌱 Seeding database..."
echo ""

# Get the database URL from Supabase status
DB_URL=$(supabase status | grep "DB URL" | awk '{print $3}')

if [ -z "$DB_URL" ]; then
    echo "❌ Could not determine database URL"
    exit 1
fi

echo "Database URL: $DB_URL"
echo ""

# Run the seed file
psql "$DB_URL" -f supabase/seed.sql

echo ""
echo "=========================================="
echo "✅ Database seeding completed!"
echo "=========================================="
echo ""
echo "Test Credentials:"
echo "  Email: user1@example.com to user1000@example.com"
echo "  Password: password123"
echo ""
echo "Quick Start:"
echo "  - user1@example.com: Organization owner"
echo "  - user2@example.com: Organization owner"
echo "  - user51@example.com: Destination manager"
echo ""
echo "Run 'npm run dev' to start the application"
echo ""
