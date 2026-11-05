# Date Lotto Generator (Tauri 2) / isolated LevelPlay pilot
# Safe build: produces a DEBUG ARM64 APK only. Never installs or launches.
# Does not include Unity SDK by default. Never runs Gradle release tasks.
# APK package ID MUST be independently verified before any future installation.
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$branch = 'pilot/levelplay-android-banner-2026-11-04'
$productionId = 'org.appsandgames.datelottogenerator'
$expectedId = 'org.appsandgames.datelottogenerator.levelplaypilot'

Write-Output '=== DATE LOTTO SAFE ISOLATED ANDROID DEBUG APK BUILD ==='
Write-Output 'PRODUCTION_NO_GO=TRUE; RELEASE_BUILD=FORBIDDEN; APK_INSTALL=FORBIDDEN; ADS=OFF'

if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'GIT_NOT_FOUND' }
$current = (& git -C $repo branch --show-current).Trim()
if ($LASTEXITCODE -ne 0 -or $current -ne $branch) { throw 'WRONG_GIT_BRANCH' }
$dirty = @(& git -C $repo status --porcelain)
if ($LASTEXITCODE -ne 0 -or $dirty.Count -ne 0) { throw 'UNCLEAN_GIT_WORKTREE' }
Write-Output 'BRANCH_AND_WORKTREE=PASS'

$configPath = Join-Path $repo 'src-tauri\tauri.conf.json'
$gradlePath = Join-Path $repo 'src-tauri\gen\android\app\build.gradle.kts'
$kotlinPath = Join-Path $repo 'src-tauri\gen\android\app\src\levelplayPilot\java\org\appsandgames\datelottogenerator\LevelPlaySdkBannerDraft.kt'
$labelPath = Join-Path $repo 'src-tauri\gen\android\app\src\debug\res\values\strings.xml'
$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$gradle = Get-Content -LiteralPath $gradlePath -Raw
$kotlin = Get-Content -LiteralPath $kotlinPath -Raw
$labels = Get-Content -LiteralPath $labelPath -Raw

if ($config.identifier -ne $productionId -or
    $config.bundle.android.debugApplicationIdSuffix -ne '.levelplaypilot' -or
    -not $gradle.Contains('applicationIdSuffix = ".levelplaypilot"') -or
    -not $gradle.Contains('appsGamesLevelPlaySdkPilot') -or
    -not $kotlin.Contains('APPROVED_AD_REQUESTS = false') -or
    -not $labels.Contains('Date Lotto - LP TEST')) {
    throw 'DEBUG_ID_OR_PRIVACY_GUARD_MISSING'
}
Write-Output ('PRODUCTION_ID=' + $productionId)
Write-Output ('EXPECTED_DEBUG_ID=' + $expectedId)
Write-Output 'DEBUG_APPLICATION_ID_AND_SDK_HARD_STOPS=PASS'

# A hidden global Gradle property must not silently add the advertising SDK.
if ($env:ORG_GRADLE_PROJECT_appsGamesLevelPlaySdkPilot -eq 'true') {
    throw 'LEVELPLAY_SDK_GLOBAL_OPT_IN_FORBIDDEN'
}
foreach ($propertyFile in @(
    (Join-Path $HOME '.gradle\gradle.properties'),
    (Join-Path $repo 'src-tauri\gen\android\gradle.properties'),
    (Join-Path $repo 'src-tauri\gen\android\app\gradle.properties')
)) {
    if (Test-Path -LiteralPath $propertyFile) {
        $propertyText = Get-Content -LiteralPath $propertyFile -Raw
        if ($propertyText -match '(?mi)^\s*appsGamesLevelPlaySdkPilot\s*=\s*true\b') {
            throw ('LEVELPLAY_SDK_OPT_IN_FORBIDDEN=' + $propertyFile)
        }
    }
}
Write-Output 'OPTIONAL_AD_SDK_DISABLED=TRUE'

$sdk = $env:ANDROID_HOME
if (-not $sdk) { $sdk = $env:ANDROID_SDK_ROOT }
if (-not $sdk) { $sdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
if (-not (Test-Path -LiteralPath (Join-Path $sdk 'platforms\android-37.0\android.jar'))) {
    throw 'API37_0_MISSING'
}
$javaRoot = Join-Path $env:ProgramFiles 'Android\Android Studio\jbr'
if (-not (Test-Path -LiteralPath (Join-Path $javaRoot 'bin\java.exe'))) {
    throw 'ANDROID_STUDIO_JAVA_NOT_FOUND'
}
if (-not (Get-Command 'npm.cmd' -ErrorAction SilentlyContinue)) {
    throw 'NPM_CMD_NOT_FOUND'
}
$androidBuildTools = Join-Path $sdk 'build-tools'
$aapt = @(Get-ChildItem -LiteralPath $androidBuildTools -Filter 'aapt.exe' -Recurse -File -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending | Select-Object -First 1)
if ($aapt.Count -ne 1) { throw 'ANDROID_AAPT_TOOL_NOT_FOUND' }
Write-Output ('AAPT_TOOL=' + $aapt[0].FullName)

$oldJava = $env:JAVA_HOME
$oldAndroid = $env:ANDROID_HOME
$oldCi = $env:CI
$started = Get-Date
try {
    $env:JAVA_HOME = $javaRoot
    $env:ANDROID_HOME = $sdk
    $env:CI = 'true'
    Push-Location -LiteralPath $repo
    try {
        Write-Output 'NPM_CI=START'
        & npm.cmd ci --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { throw 'NPM_CI_FAILED' }
        Write-Output 'NPM_CI=PASS'
        Write-Output 'TAURI_ANDROID_DEBUG_BUILD=START'
        # Explicitly select debug + APK + arm64. No run/install command.
        & npm.cmd run tauri -- android build --debug --apk --ci --target aarch64
        if ($LASTEXITCODE -ne 0) { throw ('TAURI_DEBUG_BUILD_FAILED_EXIT=' + $LASTEXITCODE) }
        Write-Output 'TAURI_ANDROID_DEBUG_BUILD=PASS'
    } finally {
        Pop-Location
    }
} finally {
    $env:JAVA_HOME = $oldJava
    $env:ANDROID_HOME = $oldAndroid
    $env:CI = $oldCi
}

$apkDir = Join-Path $repo 'src-tauri\gen\android\app\build\outputs\apk'
if (-not (Test-Path -LiteralPath $apkDir)) { throw 'APK_OUTPUT_DIRECTORY_MISSING' }
$apkCandidates = @(Get-ChildItem -LiteralPath $apkDir -Filter '*.apk' -Recurse -File |
    Where-Object { $_.LastWriteTime -ge $started.AddSeconds(-2) } |
    Sort-Object LastWriteTime -Descending)
if ($apkCandidates.Count -eq 0) { throw 'NO_NEW_DEBUG_APK_FOUND' }

foreach ($candidate in $apkCandidates) {
    # Use Android build-tools to read the actual package ID, not filenames.
    $badging = & $aapt[0].FullName dump badging $candidate.FullName
    if ($LASTEXITCODE -ne 0) { throw 'AAPT_BADGING_FAILED' }
    $line = @($badging | Where-Object { $_ -match "^package: name='([^']+)'" } | Select-Object -First 1)
    if ($line.Count -ne 1) { throw 'APK_PACKAGE_ID_NOT_READABLE' }
    $actualId = [regex]::Match($line[0], "^package: name='([^']+)'").Groups[1].Value
    Write-Output ('APK_PACKAGE_ID=' + $actualId)
    if ($actualId -ne $expectedId) {
        Write-Output 'APK_INSTALL=BLOCKED'
        throw ('WRONG_APK_PACKAGE_ID_EXPECTED=' + $expectedId)
    }
    $appLabel = @($badging | Where-Object { $_ -match "^application-label:" } | Select-Object -First 1)
    if ($appLabel.Count -ne 1 -or $appLabel[0] -notmatch 'Date Lotto - LP TEST') {
        Write-Output 'APK_INSTALL=BLOCKED'
        throw 'DEBUG_APK_LABEL_NOT_VERIFIED'
    }
    Write-Output ('APK_SHA256=' + (Get-FileHash -LiteralPath $candidate.FullName -Algorithm SHA256).Hash)
    Write-Output ('VERIFIED_APK_PATH=' + $candidate.FullName)
}
$after = @(& git -C $repo status --porcelain)
Write-Output ('SOURCE_WORKTREE_CLEAN=' + [bool]($after.Count -eq 0))
Write-Output 'APP_PACKAGE_ISOLATION=PASS'
Write-Output 'NO_AD_SDK_BY_DEFAULT=TRUE; NO_AD_REQUESTS=TRUE'
Write-Output 'APK_NOT_INSTALLED=TRUE; PRODUCTION_NO_GO=TRUE'
Write-Output '=== SAFE DEBUG APK BUILD COMPLETE ==='
