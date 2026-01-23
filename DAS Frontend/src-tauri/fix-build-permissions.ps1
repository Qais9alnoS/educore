# Script to fix permission issues during Tauri build
# Run this script as Administrator

Write-Host "Fixing build permission issues..." -ForegroundColor Yellow
Write-Host ""

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "WARNING: Not running as Administrator. Some operations may fail." -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator' for best results." -ForegroundColor Yellow
    Write-Host ""
}

# Navigate to the tauri directory
$tauriDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $tauriDir

Write-Host "Step 1: Stopping any running processes..." -ForegroundColor Cyan
Get-Process | Where-Object {
    $_.Path -like "*das-backend*" -or 
    $_.Path -like "*DAS Management*" -or
    $_.ProcessName -like "*das-management*"
} | Stop-Process -Force -ErrorAction SilentlyContinue

Start-Sleep -Seconds 2

Write-Host "Step 2: Removing locked files..." -ForegroundColor Cyan
$lockedFiles = @(
    "target\release\das-backend.exe",
    "target\release\DAS Management.exe",
    "target\release\build\das-management-*\out\*"
)

foreach ($file in $lockedFiles) {
    $fullPath = Join-Path $tauriDir $file
    if (Test-Path $fullPath) {
        try {
            Remove-Item $fullPath -Recurse -Force -ErrorAction Stop
            Write-Host "  Removed: $file" -ForegroundColor Green
        } catch {
            Write-Host "  Failed to remove: $file - $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

Write-Host ""
Write-Host "Step 3: Cleaning Cargo build cache..." -ForegroundColor Cyan
try {
    cargo clean 2>&1 | Out-Null
    Write-Host "  Build cache cleaned successfully" -ForegroundColor Green
} catch {
    Write-Host "  Some files may still be locked" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Step 4: Adding Windows Defender exclusion (requires Admin)..." -ForegroundColor Cyan
if ($isAdmin) {
    $projectPath = Split-Path -Parent (Split-Path -Parent $tauriDir)
    try {
        Add-MpPreference -ExclusionPath $projectPath -ErrorAction SilentlyContinue
        Write-Host "  Added Windows Defender exclusion for: $projectPath" -ForegroundColor Green
    } catch {
        Write-Host "  Could not add exclusion (may already exist)" -ForegroundColor Yellow
    }
} else {
    Write-Host "  Skipped (requires Administrator privileges)" -ForegroundColor Yellow
    Write-Host "  To add manually:" -ForegroundColor Gray
    Write-Host "    1. Open Windows Security" -ForegroundColor Gray
    Write-Host "    2. Virus & threat protection > Manage settings" -ForegroundColor Gray
    Write-Host "    3. Add exclusion for: $projectPath" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Done! Try building again with: cargo build --release" -ForegroundColor Green
Write-Host ""
Write-Host "If issues persist:" -ForegroundColor Yellow
Write-Host "  1. Temporarily disable Windows Defender real-time protection" -ForegroundColor Gray
Write-Host "  2. Close all file explorers showing the project directory" -ForegroundColor Gray
Write-Host "  3. Restart your computer" -ForegroundColor Gray
Write-Host "  4. Run this script as Administrator" -ForegroundColor Gray





