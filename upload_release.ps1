# Upload Release to GitHub
# Usage: .\upload_release.ps1 -Version "1.0.6"

param(
    [Parameter(Mandatory=$true)]
    [string]$Version
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "GitHub Release Upload Script" -ForegroundColor Cyan
Write-Host "Version: $Version" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$REPO = "Qais9alnoS/educore"
$TAG = "v$Version"

# Check if gh CLI is installed
Write-Host "[1/5] Checking GitHub CLI..." -ForegroundColor Yellow
try {
    gh --version | Out-Null
    Write-Host "     ✓ GitHub CLI is installed" -ForegroundColor Green
} catch {
    Write-Host "     ✗ GitHub CLI is not installed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install GitHub CLI from: https://cli.github.com/" -ForegroundColor Yellow
    Write-Host "Or run: winget install --id GitHub.cli" -ForegroundColor Yellow
    exit 1
}

# Check if user is authenticated
Write-Host "[2/5] Checking authentication..." -ForegroundColor Yellow
try {
    gh auth status | Out-Null
    Write-Host "     ✓ Authenticated" -ForegroundColor Green
} catch {
    Write-Host "     ✗ Not authenticated!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please run: gh auth login" -ForegroundColor Yellow
    exit 1
}

# Check if files exist
Write-Host "[3/5] Checking build files..." -ForegroundColor Yellow

$backendPath = "DAS Backend\backend\dist\school-management-backend-x86_64-pc-windows-msvc"
$backendExe = Join-Path $backendPath "school-management-backend-x86_64-pc-windows-msvc.exe"

if (-not (Test-Path $backendExe)) {
    Write-Host "     ✗ Backend EXE not found!" -ForegroundColor Red
    Write-Host "     Expected: $backendExe" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Please build backend first:" -ForegroundColor Yellow
    Write-Host "  cd 'DAS Backend\backend'" -ForegroundColor Gray
    Write-Host "  .\venv\Scripts\python -m PyInstaller das_backend.spec --clean --noconfirm" -ForegroundColor Gray
    exit 1
}
Write-Host "     ✓ Backend EXE found" -ForegroundColor Green

# Look for frontend MSI
$frontendMsi = Get-ChildItem -Path "DAS Frontend\src-tauri\target\release\bundle\msi" -Filter "*.msi" -ErrorAction SilentlyContinue | Select-Object -First 1

if (-not $frontendMsi) {
    Write-Host "     ⚠ Frontend MSI not found (optional)" -ForegroundColor Yellow
    Write-Host "     You can build it later with: cd 'DAS Frontend' ; npm run tauri build" -ForegroundColor Gray
    $uploadFrontend = $false
} else {
    Write-Host "     ✓ Frontend MSI found: $($frontendMsi.Name)" -ForegroundColor Green
    $uploadFrontend = $true
}

# Create or update tag
Write-Host "[4/5] Creating tag and pushing..." -ForegroundColor Yellow
try {
    # Delete tag if exists
    git tag -d $TAG 2>$null
    git push origin ":refs/tags/$TAG" 2>$null
    
    # Create new tag
    git tag $TAG
    git push origin $TAG
    Write-Host "     ✓ Tag $TAG created and pushed" -ForegroundColor Green
} catch {
    Write-Host "     ✗ Failed to create tag!" -ForegroundColor Red
    Write-Host "     Error: $_" -ForegroundColor Gray
    exit 1
}

# Create release and upload files
Write-Host "[5/5] Creating release and uploading files..." -ForegroundColor Yellow

try {
    # Delete release if exists
    gh release delete $TAG --yes --repo $REPO 2>$null
    
    # Create release notes
    $releaseNotes = @"
## 📦 Release $Version

### Backend
- School Management Backend executable included

$(if ($uploadFrontend) { "### Frontend`n- Desktop application installer (MSI) included" } else { "### Frontend`n- Build frontend separately with: ``npm run tauri build``" })

### Installation
1. Download the MSI installer
2. Run the installer
3. Launch the application

### Updates
- The application will check for updates automatically
"@

    # Create release
    if ($uploadFrontend) {
        # Zip backend folder
        $backendZip = "DAS Backend\backend\dist\backend-$Version.zip"
        Compress-Archive -Path $backendPath -DestinationPath $backendZip -Force
        
        gh release create $TAG `
            --repo $REPO `
            --title "Release $Version" `
            --notes $releaseNotes `
            $backendZip `
            $frontendMsi.FullName
            
        Remove-Item $backendZip
    } else {
        # Zip backend folder
        $backendZip = "DAS Backend\backend\dist\backend-$Version.zip"
        Compress-Archive -Path $backendPath -DestinationPath $backendZip -Force
        
        gh release create $TAG `
            --repo $REPO `
            --title "Release $Version" `
            --notes $releaseNotes `
            $backendZip
            
        Remove-Item $backendZip
    }
    
    Write-Host "     ✓ Release created successfully!" -ForegroundColor Green
} catch {
    Write-Host "     ✗ Failed to create release!" -ForegroundColor Red
    Write-Host "     Error: $_" -ForegroundColor Gray
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "✓ Release $Version uploaded successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "View release at: https://github.com/$REPO/releases/tag/$TAG" -ForegroundColor Cyan
Write-Host ""
