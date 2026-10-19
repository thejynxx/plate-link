# Plate-Link - Local Android Release APK Build Script
# Run from apps/mobile directory: .\scripts\build-apk.ps1

$ErrorActionPreference = "Stop"

# Ensure we operate in apps/mobile directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$mobileDir = Split-Path -Parent $scriptDir
Set-Location $mobileDir

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   Plate-Link Android Release APK Build (Local Machine)   " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Environment & SDK configuration
$sdkDir = "C:/Users/Anurag/AppData/Local/Android/Sdk"
$cmakeDir = "C:/Users/Anurag/AppData/Local/Android/Sdk/cmake/3.31.6"

if (-not (Test-Path $sdkDir)) {
    Write-Warning "Android SDK directory not found at: $sdkDir"
}

$env:ANDROID_HOME = $sdkDir
$env:GRADLE_OPTS = "-Djava.net.preferIPv4Stack=true"
Write-Host "[1/5] Set ANDROID_HOME and GRADLE_OPTS" -ForegroundColor Green

# 2. Swap in .env.production values if available, keeping dev safe
$envProdPath = Join-Path $mobileDir ".env.production"
$envDevPath = Join-Path $mobileDir ".env"
$envBakPath = Join-Path $mobileDir ".env.dev.bak"
$swappedEnv = $false

try {
    if (Test-Path $envProdPath) {
        Write-Host "[2/5] Applying production environment variables from .env.production..." -ForegroundColor Green
        Get-Content $envProdPath | ForEach-Object {
            $line = $_.Trim()
            if ($line -and -not $line.StartsWith("#") -and $line -match "^([^=]+)=(.*)$") {
                $k = $matches[1].Trim()
                $v = $matches[2].Trim()
                [System.Environment]::SetEnvironmentVariable($k, $v, "Process")
                Write-Host "  -> Loaded $k" -ForegroundColor DarkGray
            }
        }

        if (Test-Path $envDevPath) {
            Copy-Item $envDevPath $envBakPath -Force
            $swappedEnv = $true
        }
        Copy-Item $envProdPath $envDevPath -Force
    } else {
        Write-Host "[2/5] No .env.production found. Using existing environment values." -ForegroundColor Yellow
    }

    # 3. Clean prebuild
    Write-Host "[3/5] Running 'npx expo prebuild --platform android --clean'..." -ForegroundColor Green
    npx expo prebuild --platform android --clean
    if ($LASTEXITCODE -ne 0) {
        throw "expo prebuild failed with exit code $LASTEXITCODE"
    }

    # 4. Recreate local.properties wiped by prebuild --clean
    Write-Host "[4/5] Writing android/local.properties..." -ForegroundColor Green
    $localPropsContent = @"
sdk.dir=$sdkDir
cmake.dir=$cmakeDir
"@
    Set-Content -Path (Join-Path $mobileDir "android\local.properties") -Value $localPropsContent -Encoding ASCII

    # 5. Build signed release APK using Gradle
    Write-Host "[5/5] Building release APK (arm64-v8a architecture)..." -ForegroundColor Green
    Set-Location (Join-Path $mobileDir "android")
    
    .\gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a
    if ($LASTEXITCODE -ne 0) {
        throw "Gradle build failed with exit code $LASTEXITCODE"
    }

    Set-Location $mobileDir

    # 6. Locate built APK and copy to dist/
    $distDir = Join-Path $mobileDir "dist"
    if (-not (Test-Path $distDir)) {
        New-Item -ItemType Directory -Path $distDir | Out-Null
    }

    $candidates = Get-ChildItem -Path (Join-Path $mobileDir "android\app\build\outputs\apk\release") -Filter "*.apk" -Recurse
    if (-not $candidates) {
        throw "No release APK found in android/app/build/outputs/apk/release/"
    }

    # Pick the most relevant release apk (e.g. app-arm64-v8a-release.apk or app-release.apk)
    $builtApk = $candidates | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    $targetApkPath = Join-Path $distDir "plate-link-1.0.0.apk"
    Copy-Item $builtApk.FullName -Destination $targetApkPath -Force

    $fileSizeMB = [math]::Round((Get-Item $targetApkPath).Length / 1MB, 2)
    Write-Host ""
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "  BUILD SUCCESSFUL!" -ForegroundColor Green
    Write-Host "  APK Location: $targetApkPath" -ForegroundColor White
    Write-Host "  APK Size:     $fileSizeMB MB" -ForegroundColor White
    Write-Host "==========================================================" -ForegroundColor Green
}
finally {
    # Restore dev .env if we backed it up
    if ($swappedEnv -and (Test-Path $envBakPath)) {
        Move-Item $envBakPath $envDevPath -Force
        Write-Host "Restored development .env." -ForegroundColor DarkGray
    }
}
