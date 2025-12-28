# Build Troubleshooting Guide

## Permission Denied Error (OS Error 5)

If you encounter `Access is denied` errors during the build, follow these steps:

### Quick Fix

1. **Run PowerShell as Administrator** and navigate to the project:
   ```powershell
   cd "C:\Users\kaysa\Documents\GitHub\the ultimate programe\DAS Frontend\src-tauri"
   ```

2. **Run the fix script**:
   ```powershell
   .\fix-build-permissions.ps1
   ```

3. **Try building again**:
   ```powershell
   cargo build --release
   ```

### Permanent Solution: Add Windows Defender Exclusion

To prevent Windows Defender from locking files during builds:

1. **Open Windows Security**:
   - Press `Win + I` → Update & Security → Windows Security
   - Or search for "Windows Security" in Start menu

2. **Add Exclusion**:
   - Go to **Virus & threat protection**
   - Click **Manage settings** under Virus & threat protection settings
   - Scroll down to **Exclusions**
   - Click **Add or remove exclusions**
   - Click **Add an exclusion** → **Folder**
   - Add: `C:\Users\kaysa\Documents\GitHub\the ultimate programe`

3. **Alternative: Exclude via PowerShell (as Admin)**:
   ```powershell
   $projectPath = "C:\Users\kaysa\Documents\GitHub\the ultimate programe"
   Add-MpPreference -ExclusionPath $projectPath
   ```

### If Build Still Fails

1. **Close all file explorers** showing the project directory
2. **Stop any running instances** of the app:
   ```powershell
   Get-Process | Where-Object {$_.Path -like "*DAS Management*"} | Stop-Process -Force
   ```
3. **Clean and rebuild**:
   ```powershell
   cargo clean
   cargo build --release
   ```
4. **Temporarily disable real-time protection** (last resort):
   - Windows Security → Virus & threat protection → Manage settings
   - Turn off "Real-time protection" temporarily
   - Build your app
   - Turn it back on

### Common Causes

- **Windows Defender** scanning files during build
- **Antivirus software** locking executable files
- **File Explorer** having the directory open
- **Previous build process** still running
- **Insufficient permissions** (need Admin for some operations)

### Prevention Tips

- Always add your project directory to antivirus exclusions
- Close file explorers before building
- Run builds in Administrator mode if issues persist
- Use `cargo clean` before rebuilding if you encounter errors


