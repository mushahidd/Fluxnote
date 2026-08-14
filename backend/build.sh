#!/bin/bash
# Render build script for backend

echo "Installing dependencies..."
npm install

echo "Generating Prisma client..."
npx prisma generate --schema=src/db/schema.prisma

echo "Build completed successfully!"
