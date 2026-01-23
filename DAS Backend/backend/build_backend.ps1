# Build script for School Management Backend
# This script compiles the Python backend into a single executable using PyInstaller

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "School Management Backend - Build Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Stop"

# Activate virtual environment
Write-Host "[1/3] Activating virtual environment..." -ForegroundColor Yellow
.\venv\Scripts\Activate.ps1

# Install PyInstaller if not already installed
Write-Host "[2/3] Checking PyInstaller..." -ForegroundColor Yellow
try {
    python -m PyInstaller --version | Out-Null
    Write-Host "     ✓ PyInstaller is installed" -ForegroundColor Green
} catch {
    Write-Host "     Installing PyInstaller..." -ForegroundColor Gray
    pip install pyinstaller
}

# Build the executable
Write-Host "[3/3] Building executable..." -ForegroundColor Yellow
python -m PyInstaller das_backend.spec --clean --noconfirm

if (Test-Path "dist\school-management-backend-x86_64-pc-windows-msvc.exe") {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "✓ Build successful!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "Executable location: dist\school-management-backend-x86_64-pc-windows-msvc.exe"
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "✗ Build failed!" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    exit 1
}
