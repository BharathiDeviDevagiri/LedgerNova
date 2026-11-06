# ==============================================================================
# LedgerLine - Master Startup Script (Windows PowerShell)
# Snovasys Fresher Hiring Challenge 2026
# ==============================================================================

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  LedgerLine: Money Movement with a Ledger You Can Prove  " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$RootPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RootPath

# 1. Check Docker Availability
Write-Host "[1/6] Checking Docker availability..." -ForegroundColor Yellow
$dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
if (-not $dockerCmd) {
    Write-Host "ERROR: Docker is not installed or not in PATH." -ForegroundColor Red
    Write-Host "Please install Docker Desktop and start it before running LedgerLine." -ForegroundColor Red
    Exit 1
}

# 2. Start PostgreSQL via Docker Compose
Write-Host "[2/6] Starting PostgreSQL database container..." -ForegroundColor Yellow
docker compose up -d

Write-Host "Waiting for PostgreSQL container to become ready..." -ForegroundColor Yellow
$maxRetries = 20
$retryCount = 0
$dbReady = $false

while (-not $dbReady -and $retryCount -lt $maxRetries) {
    Start-Sleep -Seconds 2
    $retryCount++
    $check = docker compose exec -T postgres pg_isready -U postgres -d ledgerline 2>&1
    if ($check -match "accepting connections") {
        $dbReady = $true
        Write-Host "PostgreSQL is healthy and accepting connections!" -ForegroundColor Green
    } else {
        Write-Host "Waiting for database ($retryCount/$maxRetries)..." -ForegroundColor Gray
    }
}

if (-not $dbReady) {
    Write-Host "WARNING: PostgreSQL took longer than expected to report ready. Proceeding with caution..." -ForegroundColor DarkYellow
}

# 3. Setup Backend
Write-Host ""
Write-Host "[3/6] Setting up Backend dependencies & Prisma..." -ForegroundColor Yellow
Set-Location "$RootPath\backend"

if (-not (Test-Path "node_modules")) {
    Write-Host "Installing backend npm packages..." -ForegroundColor Gray
    npm install
}

Write-Host "Generating Prisma Client..." -ForegroundColor Gray
npx prisma generate

Write-Host "Deploying database migrations & schema..." -ForegroundColor Gray
npx prisma migrate dev --name init_ledgerline_schema 2>&1

Write-Host "Applying database triggers and financial invariants..." -ForegroundColor Gray
if (Test-Path "prisma\sql\invariants_and_triggers.sql") {
    docker compose -f "$RootPath\docker-compose.yml" exec -T postgres psql -U postgres -d ledgerline -f /dev/stdin < "$RootPath\backend\prisma\sql\invariants_and_triggers.sql" 2>$null
}

Write-Host "Seeding initial accounts and personas..." -ForegroundColor Gray
npm run db:seed
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Seeding failed. Set the three LEDGERLINE_SEED_*_PASSWORD values in backend\.env and retry." -ForegroundColor Red
    Exit 1
}

# 4. Setup Frontend
Write-Host ""
Write-Host "[4/6] Setting up Frontend dependencies..." -ForegroundColor Yellow
Set-Location "$RootPath\frontend"

if (-not (Test-Path "node_modules")) {
    Write-Host "Installing frontend npm packages..." -ForegroundColor Gray
    npm install
}

# 5. Launch Backend and Frontend in Dedicated Terminals
Write-Host ""
Write-Host "[5/6] Launching development servers..." -ForegroundColor Yellow

# Start Backend Server in a new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$RootPath\backend'; Write-Host 'Starting LedgerLine Backend...' -ForegroundColor Green; npm run dev"

# Start Frontend Server in a new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$RootPath\frontend'; Write-Host 'Starting LedgerLine Frontend...' -ForegroundColor Cyan; npm run dev"

# 6. Display Operational Summary
Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "   LedgerLine Platform Running Successfully!             " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  * Frontend Application: http://localhost:5173" -ForegroundColor Cyan
Write-Host "  * Backend API Server:   http://localhost:5000" -ForegroundColor Cyan
Write-Host "  * System Health Check:  http://localhost:5000/api/health" -ForegroundColor Cyan
Write-Host ""
Write-Host "Seed login passwords are supplied through backend environment variables and are not displayed here." -ForegroundColor Yellow
Write-Host ""
Write-Host "Press any key to exit this launcher window..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
