<#
  DAS Management System - Master Build Script
  Builds complete application with Python backend and Tauri frontend
#>

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " DAS Management System - Complete Build" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Stop"
$startTime = Get-Date

function Get-ElapsedTime {
    $elapsed = (Get-Date) - $startTime
    return "{0:D2}:{1:D2}:{2:D2}" -f $elapsed.Hours, $elapsed.Minutes, $elapsed.Seconds
}

try {
    # Step 1: Build Python Backend
    Write-Host "[$(Get-ElapsedTime)] Step 1/3: Building Python Backend..." -ForegroundColor Yellow
    Write-Host ""

    Push-Location "DAS Backend\backend"

    Write-Host "   -> Activating Python virtual environment..." -ForegroundColor Gray
    .\venv\Scripts\Activate.ps1

    Write-Host "   -> Checking PyInstaller..." -ForegroundColor Gray
    try {
        python -m PyInstaller --version | Out-Null
        Write-Host "      PyInstaller already installed" -ForegroundColor Green
    } catch {
        Write-Host "      Installing PyInstaller..." -ForegroundColor Gray
        pip install pyinstaller
        Write-Host "      PyInstaller installed" -ForegroundColor Green
    }

    Write-Host "   -> Compiling Python backend to executable..." -ForegroundColor Gray
    python -m PyInstaller das_backend.spec --clean --noconfirm

    # Check for the actual executable name from the spec file
    $backendExePath = "dist\das-backend-x86_64-pc-windows-msvc.exe"
    if (Test-Path $backendExePath) {
        $backendExe = Get-Item $backendExePath
        $backendSizeMB = [math]::Round($backendExe.Length / 1MB, 2)
        Write-Host "      Backend compiled successfully (${backendSizeMB} MB)" -ForegroundColor Green
    } else {
        throw "Backend compilation failed - executable not found at $backendExePath"
    }

    Pop-Location
    Write-Host ""

    # Step 2: Build Frontend React App
    Write-Host "[$(Get-ElapsedTime)] Step 2/3: Building React Frontend..." -ForegroundColor Yellow
    Write-Host ""

    Push-Location "DAS Frontend"

    if (-not (Test-Path "node_modules")) {
        Write-Host "   -> Installing npm dependencies..." -ForegroundColor Gray
        npm install
    } else {
        Write-Host "   -> Using existing npm dependencies" -ForegroundColor Gray
    }

    Write-Host "   -> Building production React bundle..." -ForegroundColor Gray
    npm run build:prod

    if (Test-Path "dist\index.html") {
        $distSizeBytes = (Get-ChildItem "dist" -Recurse | Measure-Object -Property Length -Sum).Sum
        $distSizeMB = [math]::Round($distSizeBytes / 1MB, 2)
        Write-Host "      Frontend built successfully (${distSizeMB} MB)" -ForegroundColor Green
    } else {
        throw "Frontend build failed - dist folder not found"
    }

    Pop-Location
    Write-Host ""

    # Step 3: Build Tauri Application
    Write-Host "[$(Get-ElapsedTime)] Step 3/3: Building Tauri Application..." -ForegroundColor Yellow
    Write-Host ""

    Push-Location "DAS Frontend"
    Write-Host "   -> Compiling Rust and creating installer (this may take several minutes)..." -ForegroundColor Gray
    npm run tauri build

    # Copy backend exe next to Tauri exe for runtime
    $backendExePath = "..\DAS Backend\backend\dist\das-backend-x86_64-pc-windows-msvc.exe"
    $tauriReleaseDir = "src-tauri\target\release"
    if (Test-Path $backendExePath) {
        Write-Host "   -> Copying backend exe next to Tauri exe..." -ForegroundColor Gray
        Copy-Item $backendExePath (Join-Path $tauriReleaseDir "das-backend.exe") -Force
    } else {
        Write-Host "   -> WARNING: Backend exe not found at $backendExePath" -ForegroundColor Yellow
    }

    Pop-Location

    # Verify Output
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host " Build Verification" -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host ""

    $bundlePath = "DAS Frontend\src-tauri\target\release\bundle"

    $msiFiles = Get-ChildItem "$bundlePath\msi\*.msi" -ErrorAction SilentlyContinue
    if ($msiFiles) {
        foreach ($msi in $msiFiles) {
            $msiSizeMB = [math]::Round($msi.Length / 1MB, 2)
            Write-Host "MSI Installer: $($msi.Name) (${msiSizeMB} MB)" -ForegroundColor Green
            Write-Host "  Location: $($msi.FullName)" -ForegroundColor Gray
        }
    } else {
        Write-Host "MSI installer not found" -ForegroundColor Yellow
    }

    $exePath = "DAS Frontend\src-tauri\target\release\DAS Management.exe"
    if (Test-Path $exePath) {
        $exeItem = Get-Item $exePath
        $exeSizeMB = [math]::Round($exeItem.Length / 1MB, 2)
        Write-Host "Executable: DAS Management.exe (${exeSizeMB} MB)" -ForegroundColor Green
        Write-Host "  Location: $exePath" -ForegroundColor Gray
    } else {
        Write-Host "Executable not found at expected location" -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host " BUILD SUCCESSFUL" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Total build time: $(Get-ElapsedTime)" -ForegroundColor Cyan
    Write-Host ""
} catch {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Red
    Write-Host " BUILD FAILED" -ForegroundColor Red
    Write-Host "============================================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Stack trace:" -ForegroundColor Gray
    Write-Host $_.ScriptStackTrace -ForegroundColor Gray
    Write-Host ""
    exit 1
}
