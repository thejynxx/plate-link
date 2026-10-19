# Plate-Link - Google Drive APK Upload Script via rclone
# Usage: Run from apps/mobile directory: .\scripts\upload-apk.ps1

$ErrorActionPreference = "Stop"

# Ensure rclone is accessible in current session
$rcloneCmd = "rclone"
if (-not (Get-Command "rclone" -ErrorAction SilentlyContinue)) {
    # Refresh PATH from user environment in case shell hasn't restarted after winget
    $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $env:Path = "$userPath;$machinePath"

    if (-not (Get-Command "rclone" -ErrorAction SilentlyContinue)) {
        # Check standard winget package path as fallback
        $wingetPackages = "$env:LOCALAPPDATA\Microsoft\WinGet\Packages"
        $fallback = Get-ChildItem -Path $wingetPackages -Filter "rclone.exe" -Recurse -File -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($fallback) {
            $rcloneCmd = $fallback.FullName
        } else {
            Write-Error "rclone is not installed or not in PATH. Please run 'winget install Rclone.Rclone' and restart your terminal."
            exit 1
        }
    }
}

# Resolve directories
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$mobileDir = Split-Path -Parent $scriptDir
$distDir = Join-Path $mobileDir "dist"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "       Plate-Link Release APK Upload -> Google Drive      " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Locate the newest APK
if (-not (Test-Path $distDir)) {
    Write-Error "dist directory not found at $distDir. Run .\scripts\build-apk.ps1 first."
    exit 1
}

$apkList = Get-ChildItem -Path $distDir -Filter "plate-link-*.apk" | Sort-Object LastWriteTime -Descending
if (-not $apkList -or $apkList.Count -eq 0) {
    Write-Error "No APK matching 'plate-link-*.apk' found in $distDir. Build one first with .\scripts\build-apk.ps1."
    exit 1
}

$latestApk = $apkList[0]
$apkSizeMB = [math]::Round($latestApk.Length / 1MB, 2)
Write-Host "Found APK: $($latestApk.Name) ($apkSizeMB MB)" -ForegroundColor Green
Write-Host "Target:    gdrive:PlateLink/Plate-Link-latest.apk (overwriting latest)" -ForegroundColor Green
Write-Host ""

# 2. Upload to Google Drive
Write-Host "[1/2] Uploading APK to Google Drive..." -ForegroundColor Yellow
& $rcloneCmd copyto "$($latestApk.FullName)" "gdrive:PlateLink/Plate-Link-latest.apk" --progress
if ($LASTEXITCODE -ne 0) {
    Write-Error "rclone copyto failed with exit code $LASTEXITCODE. Ensure you have configured the 'gdrive' remote with 'rclone config'."
    exit $LASTEXITCODE
}

# 3. Create public link and generate direct download URL
Write-Host ""
Write-Host "[2/2] Generating public share link..." -ForegroundColor Yellow
$shareUrl = (& $rcloneCmd link "gdrive:PlateLink/Plate-Link-latest.apk").Trim()

if (-not $shareUrl) {
    Write-Warning "Could not retrieve share link from rclone."
    exit 0
}

# Extract Google Drive File ID for direct download URL
$fileId = $null
if ($shareUrl -match "[?&]id=([a-zA-Z0-9_-]+)") {
    $fileId = $matches[1]
} elseif ($shareUrl -match "/file/d/([a-zA-Z0-9_-]+)") {
    $fileId = $matches[1]
} elseif ($shareUrl -match "/d/([a-zA-Z0-9_-]+)") {
    $fileId = $matches[1]
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  UPLOAD SUCCESSFUL!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  Share Link:           $shareUrl" -ForegroundColor Cyan
if ($fileId) {
    $directDownloadUrl = "https://drive.google.com/uc?export=download&id=$fileId"
    Write-Host "  Direct Download URL:  $directDownloadUrl" -ForegroundColor White
}
Write-Host "==========================================================" -ForegroundColor Green
