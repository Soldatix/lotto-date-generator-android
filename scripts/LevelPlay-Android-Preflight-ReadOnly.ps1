# Apps & Games / Date Lotto Generator / LevelPlay Android
# READ-ONLY preflight for a local Windows PC and OPPO Find X5 Lite.
# No APK build, installation, network requests, advertisement, permission
# changes, Git pulls, or device configuration changes are performed.
# Running "adb devices" can start the local adb server, but does not install.
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$expected = 'pilot/levelplay-android-banner-2026-11-04'
function Get-CommandPath($name) {
    $found = Get-Command $name -ErrorAction SilentlyContinue
    if ($found) { return $found.Source }
    return $null
}

Write-Output '=== LEVELPLAY ANDROID READ-ONLY PREFLIGHT ==='
Write-Output 'NO_ANDROID_BUILD=TRUE; NO_AD_REQUEST=TRUE; NO_APK_INSTALL=TRUE'
$git = Get-CommandPath 'git'
if (-not $git) {
    Write-Output 'GIT=NOT_FOUND'
} else {
    $branch = (& $git -C $repo branch --show-current 2>$null | Select-Object -First 1).Trim()
    Write-Output ('BRANCH=' + $branch)
    Write-Output ('EXPECTED_PILOT_BRANCH=' + [bool]($branch -eq $expected))
    $dirty = @(& $git -C $repo status --porcelain 2>$null).Count
    Write-Output ('UNCOMMITTED_FILE_COUNT=' + $dirty)
}
$gradle = Join-Path $repo 'src-tauri\gen\android\app\build.gradle.kts'
$sdkKotlin = Join-Path $repo 'src-tauri\gen\android\app\src\levelplayPilot\java\org\appsandgames\datelottogenerator\LevelPlaySdkBannerDraft.kt'
if (Test-Path -LiteralPath $gradle) {
    $buildContents = Get-Content -LiteralPath $gradle -Raw
    Write-Output ('GRADLE_SDK_OPT_IN_GUARD=' + [bool]($buildContents.Contains('appsGamesLevelPlaySdkPilot')))
} else { Write-Output 'GRADLE_FILE=MISSING' }
if (Test-Path -LiteralPath $sdkKotlin) {
    $kotlinContents = Get-Content -LiteralPath $sdkKotlin -Raw
    Write-Output ('SDK_AD_REQUESTS_HARD_STOP=' + [bool]($kotlinContents.Contains('APPROVED_AD_REQUESTS = false')))
} else { Write-Output 'SDK_PILOT_FILE=MISSING' }
$java = Get-CommandPath 'java'
Write-Output ('JAVA_FOUND=' + [bool]($java))
if ($java) {
    $javaLine = (& $java -version 2>&1 | Select-Object -First 1).ToString()
    Write-Output ('JAVA_VERSION=' + $javaLine)
}
$node = Get-CommandPath 'node'
Write-Output ('NODE_FOUND=' + [bool]($node))
if ($node) { Write-Output ('NODE_VERSION=' + ((& $node --version) -join '')) }
$npm = Get-CommandPath 'npm'
Write-Output ('NPM_FOUND=' + [bool]($npm))
$sdk = $env:ANDROID_HOME
if (-not $sdk) { $sdk = $env:ANDROID_SDK_ROOT }
if (-not $sdk) { $sdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
Write-Output ('ANDROID_SDK_DIRECTORY_FOUND=' + [bool](Test-Path -LiteralPath $sdk))
Write-Output ('ANDROID_API_36_INSTALLED=' + [bool](Test-Path -LiteralPath (Join-Path $sdk 'platforms\android-36')))
Write-Output ('ANDROID_API_37_INSTALLED=' + [bool](Test-Path -LiteralPath (Join-Path $sdk 'platforms\android-37')))
$adb = Get-CommandPath 'adb'
if (-not $adb) {
    $localAdb = Join-Path $sdk 'platform-tools\adb.exe'
    if (Test-Path -LiteralPath $localAdb) { $adb = $localAdb }
}
Write-Output ('ADB_FOUND=' + [bool]($adb))
if ($adb) {
    $devices = @(& $adb devices 2>$null | Where-Object { $_ -match '^[^\s]+\s+device(?:\s|$)' })
    Write-Output ('AUTHORIZED_ADB_DEVICE_COUNT=' + $devices.Count)
    if ($devices.Count -eq 0) {
        Write-Output 'ADB_HINT=Connect OPPO by USB, enable debugging, then authorize the PC on the phone'
    }
}
Write-Output 'ADVERTISING_ID_NOT_READ=TRUE; PRIVATE_IDS_NOT_PRINTED=TRUE'
Write-Output 'CHANGES_MADE=NONE; PRODUCTION_NO_GO=TRUE'
Write-Output '=== END PREFLIGHT ==='
