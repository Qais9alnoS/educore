# Fix Database Encryption Error Script
# This script helps resolve SQLCipher HMAC check failures

Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 79) -ForegroundColor Cyan
Write-Host "DATABASE ENCRYPTION FIX UTILITY" -ForegroundColor Yellow
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 79) -ForegroundColor Cyan
Write-Host ""

# Find all database files
$backendDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$dbFiles = @(
    "$backendDir\backend\school_management.db",
    "$backendDir\backend\app\das_database.db",
    "$backendDir\school_management.db"
)

Write-Host "Searching for database files..." -ForegroundColor Cyan
$foundDbs = @()
foreach ($dbFile in $dbFiles) {
    if (Test-Path $dbFile) {
        $foundDbs += $dbFile
        Write-Host "  [FOUND] $dbFile" -ForegroundColor Green
    }
}

if ($foundDbs.Count -eq 0) {
    Write-Host "`nNo database files found. The database will be created on next startup." -ForegroundColor Yellow
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit
}

Write-Host "`nFound $($foundDbs.Count) database file(s)" -ForegroundColor Yellow
Write-Host ""
Write-Host "IMPORTANT: This error occurs when:" -ForegroundColor Red
Write-Host "  1. Database was created without encryption (regular SQLite)" -ForegroundColor White
Write-Host "  2. Database was created with a different password" -ForegroundColor White
Write-Host "  3. Database file is corrupted" -ForegroundColor White
Write-Host ""
Write-Host "Choose an option:" -ForegroundColor Yellow
Write-Host "  [1] Delete database and start fresh (LOSE ALL DATA)" -ForegroundColor Red
Write-Host "  [2] Backup database and start fresh (KEEP BACKUP)" -ForegroundColor Green
Write-Host "  [3] Cancel and exit" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Enter your choice (1, 2, or 3)"

switch ($choice) {
    "1" {
        Write-Host "`nDeleting database files..." -ForegroundColor Red
        foreach ($db in $foundDbs) {
            try {
                Remove-Item $db -Force
                Write-Host "  [DELETED] $db" -ForegroundColor Green
            } catch {
                Write-Host "  [ERROR] Failed to delete $db : $_" -ForegroundColor Red
            }
        }
        Write-Host "`nDatabase files deleted. Restart the backend to create a new encrypted database." -ForegroundColor Green
    }
    "2" {
        $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
        Write-Host "`nBacking up database files..." -ForegroundColor Yellow
        foreach ($db in $foundDbs) {
            try {
                $backupPath = "$db.backup_$timestamp"
                Copy-Item $db $backupPath -Force
                Write-Host "  [BACKUP] $backupPath" -ForegroundColor Green
                Remove-Item $db -Force
                Write-Host "  [DELETED] $db" -ForegroundColor Green
            } catch {
                Write-Host "  [ERROR] Failed to backup/delete $db : $_" -ForegroundColor Red
            }
        }
        Write-Host "`nDatabase files backed up and deleted." -ForegroundColor Green
        Write-Host "Restart the backend to create a new encrypted database." -ForegroundColor Green
        Write-Host "`nBackup files are saved with timestamp: $timestamp" -ForegroundColor Cyan
    }
    "3" {
        Write-Host "`nOperation cancelled." -ForegroundColor Yellow
    }
    default {
        Write-Host "`nInvalid choice. Operation cancelled." -ForegroundColor Red
    }
}

Write-Host "`nPress any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
