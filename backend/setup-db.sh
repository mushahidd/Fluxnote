#!/bin/bash

# LIGMA Database Setup Script

echo "🚀 Setting up LIGMA database..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Please create backend/.env with DATABASE_URL and other variables"
    exit 1
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

echo "📦 Installing dependencies..."
npm install

echo "🗄️  Generating Prisma Client..."
npx prisma generate

echo "🔄 Running database migrations..."
npx prisma migrate dev --name init

echo "✅ Database setup complete!"
echo ""
echo "Next steps:"
echo "1. Update GROQ_API_KEY in .env if you want AI features"
echo "2. Run 'npm start' to start the backend server"
