# LIGMA Database Setup Script for Windows

Write-Host "🚀 Setting up LIGMA database..." -ForegroundColor Green

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "❌ Error: .env file not found!" -ForegroundColor Red
    Write-Host "Please create backend/.env with DATABASE_URL and other variables"
    exit 1
}

Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
npm install

Write-Host "🗄️  Generating Prisma Client..." -ForegroundColor Yellow
npx prisma generate

Write-Host "🔄 Running database migrations..." -ForegroundColor Yellow
npx prisma migrate dev --name init

Write-Host "✅ Database setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Update GROQ_API_KEY in .env if you want AI features"
Write-Host "2. Run 'npm start' to start the backend server"
