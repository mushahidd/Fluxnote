# LIGMA Quick Start Script for Windows
# This script sets up and starts the entire application

Write-Host "🚀 LIGMA Quick Start" -ForegroundColor Cyan
Write-Host "===================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
Write-Host "📦 Checking Docker..." -ForegroundColor Yellow
$dockerRunning = docker ps 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Docker is running" -ForegroundColor Green

# Start PostgreSQL
Write-Host ""
Write-Host "🗄️  Starting PostgreSQL..." -ForegroundColor Yellow
docker-compose up -d postgres
Start-Sleep -Seconds 5
Write-Host "✅ PostgreSQL started" -ForegroundColor Green

# Setup Backend
Write-Host ""
Write-Host "⚙️  Setting up backend..." -ForegroundColor Yellow
Push-Location backend
if (Test-Path "setup-db.ps1") {
    .\setup-db.ps1
} else {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
    Write-Host "Generating Prisma client..." -ForegroundColor Yellow
    npx prisma generate
    Write-Host "Running migrations..." -ForegroundColor Yellow
    npx prisma migrate dev --name init
}
Pop-Location
Write-Host "✅ Backend setup complete" -ForegroundColor Green

# Setup Frontend
Write-Host ""
Write-Host "🎨 Setting up frontend..." -ForegroundColor Yellow
Push-Location frontend
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
}
Pop-Location
Write-Host "✅ Frontend setup complete" -ForegroundColor Green

# Start Backend
Write-Host ""
Write-Host "🚀 Starting backend server..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; npm start"
Start-Sleep -Seconds 3

# Start Frontend
Write-Host ""
Write-Host "🎨 Starting frontend server..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"

Write-Host ""
Write-Host "✅ LIGMA is starting up!" -ForegroundColor Green
Write-Host ""
Write-Host "📍 Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "📍 Backend:  http://localhost:4000" -ForegroundColor Cyan
Write-Host ""
Write-Host "⏳ Wait 10-15 seconds for servers to start, then open:" -ForegroundColor Yellow
Write-Host "   http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "💡 Tip: Check the new terminal windows for server logs" -ForegroundColor Gray
