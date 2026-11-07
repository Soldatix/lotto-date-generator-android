# N12 Date Lotto Android — the FIRST real banner-capable isolated APK build.
# OWNER-RUN, build-only. No install, no ADB, no SDK execution, no ad requests.
# PowerShell 5.1, Android Studio JBR, API 37, Tauri2, NDK 30.
# SDK test-permission is ALWAYS compiled FALSE in this script.
# Unity identifiers are provided in the runner process environment, NEVER
# copied to GitHub, printed, or written into the source tree.
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$branch = 'pilot/levelplay-android-banner-2026-11-04'
$pkg = 'org.appsandgames.datelottogenerator.levelplaypilot'
$sdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$java = Join-Path $env:ProgramFiles 'Android\Android Studio\jbr'
$ndk = Join-Path $sdk 'ndk\30.0.16248370'
$oldN8 = Join-Path $env:TEMP 'DateLotto-N8-20261107-134705\src-tauri\gen\android\app\build\outputs\apk\universal\debug\app-universal-debug.apk'
$oldN8Sha = '40CE83AC44EF7C1398C0A74558F6BE7299BCF1F340C9FE12C828D7418C639798'
$git = (Get-Command git.exe -ErrorAction Stop).Source
$npm = (Get-Command npm.cmd -ErrorAction Stop).Source

Write-Output '=== DATE LOTTO N12 BANNER-CAPABLE APK BUILD ONLY ==='
Write-Output 'NO_PROMPTS=TRUE; NO_ADB=TRUE; NO_INSTALL=TRUE; NO_LAUNCH=TRUE'
Write-Output 'TEST_AD_REQUESTS=OFF; REAL_ADS=OFF; PRODUCTION_NO_GO=TRUE'

function NativeChecked([string]$Executable,[string[]]$Arg) {
    $prior = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $output = (& $Executable @Arg 2>&1 | Out-String)
        $exitCode = $LASTEXITCODE
    } finally { $ErrorActionPreference = $prior }
    if ($null -eq $exitCode -or $exitCode -ne 0) {
        throw ('N12_EXTERNAL_EXIT_'+[string]$exitCode+' '+$output)
    }
    return $output.Trim()
}

function VerifyContains([string]$Path,[string]$Text) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf) -or
        -not (Get-Content -LiteralPath $Path -Raw).Contains($Text)) {
        throw ('N12_SOURCE_GUARD_'+$Text)
    }
}

if (-not $root.StartsWith(
    (Join-Path $env:TEMP 'DateLotto-N12-'),
    [StringComparison]::OrdinalIgnoreCase)) {
    throw 'N12_DISPOSABLE_CLONE_REQUIRED'
}
if ((NativeChecked $git @('-C',$root,'branch','--show-current')) -cne $branch) {
    throw 'N12_BRANCH_MISMATCH'
}
if ((NativeChecked $git @('-C',$root,'status','--porcelain')) -ne '') {
    throw 'N12_DIRTY_SOURCE'
}

$gradle = Join-Path $root 'src-tauri\gen\android\app\build.gradle.kts'
$activity = Join-Path $root 'src-tauri\gen\android\app\src\n12BannerPilot\java\org\appsandgames\datelottogenerator\N12LottoBannerActivity.kt'
$manifest = Join-Path $root 'src-tauri\gen\android\app\src\n12BannerPilot\AndroidManifest.xml'
VerifyContains $gradle 'N12_PRODUCTION_NO_GO'
VerifyContains $gradle 'N12_SEPARATE_ISOLATED_DEBUG_ONLY'
VerifyContains $activity 'BuildConfig.N12_OWNER_TEST_AD_REQUESTS_APPROVED'
VerifyContains $activity 'LevelPlayBannerAdView'
VerifyContains $activity 'requestConsentInfoUpdate'
VerifyContains $activity 'N4BannerSizeFitPolicy.fit'
VerifyContains $manifest 'tools:node="remove"'
VerifyContains $manifest 'N12LottoBannerActivity'

$unit = [Environment]::GetEnvironmentVariable('APPSGAMES_N12_LEVELPLAY_BANNER_UNIT_ID','Process')
$appKey = [Environment]::GetEnvironmentVariable('APPSGAMES_N12_LEVELPLAY_APP_KEY','Process')
if ($null -eq $unit -or $unit -cnotmatch '^[A-Za-z0-9_-]{6,128}$' -or
    $null -eq $appKey -or $appKey -cnotmatch '^[A-Za-z0-9_-]{6,128}$') {
    throw 'N12_LEVELPLAY_IDS_MISSING_OR_INVALID'
}
if ([Environment]::GetEnvironmentVariable('APPSGAMES_N12_OWNER_TEST_APPROVAL','Process')) {
    throw 'N12_BUILD_ONLY_AD_REQUEST_APPROVAL_MUST_BE_UNSET'
}
foreach ($setting in @('appsGamesN7UmpPreview','appsGamesN9ConsentBannerReview','appsGamesLevelPlaySdkPilot')) {
    if ([Environment]::GetEnvironmentVariable(
        'ORG_GRADLE_PROJECT_'+$setting,'Process') -match '^(?i:true)$') {
        throw ('N12_CONFLICTING_GRADLE_FLAG_'+$setting)
    }
}
foreach ($f in @(
    (Join-Path $env:USERPROFILE '.gradle\gradle.properties'),
    (Join-Path $root 'src-tauri\gen\android\gradle.properties')
)) {
    if ((Test-Path -LiteralPath $f) -and
        (Get-Content -LiteralPath $f -Raw) -match
        '(?mi)^\s*appsGames(LevelPlaySdkPilot|N7UmpPreview|N9ConsentBannerReview|N12LottoBannerPilot)\s*=\s*true\b') {
        throw 'N12_PERSISTENT_SDK_OPTIN_FORBIDDEN'
    }
}
foreach ($f in @(
    (Join-Path $java 'bin\java.exe'),
    (Join-Path $ndk 'source.properties'),
    (Join-Path $sdk 'platforms\android-37.0\android.jar')
)) {
    if (-not (Test-Path -LiteralPath $f -PathType Leaf)) {
        throw ('N12_ANDROID_TOOLCHAIN_MISSING_'+$f)
    }
}
$aapt = @(Get-ChildItem -LiteralPath (Join-Path $sdk 'build-tools') -Filter 'aapt.exe' -Recurse -File |
    Sort-Object FullName -Descending | Select-Object -First 1)
if ($aapt.Count -ne 1) {throw 'N12_AAPT_REQUIRED'}

# Existing SHA-verified N8 UMP-only APK is the local source of the
# existing AdMob Android App ID: never ask owner to retype or expose it.
if (-not (Test-Path -LiteralPath $oldN8 -PathType Leaf) -or
    (Get-FileHash -LiteralPath $oldN8 -Algorithm SHA256).Hash -cne $oldN8Sha) {
    throw 'N12_N8_UMP_SOURCE_APK_HASH_MISMATCH'
}
$badging = NativeChecked $aapt[0].FullName @('dump','badging',$oldN8)
if (-not $badging.Contains("package: name='$pkg'") -or
    -not $badging.Contains('application-debuggable')) {
    throw 'N12_N8_UMP_SOURCE_IDENTITY_INVALID'
}
$oldXml = NativeChecked $aapt[0].FullName @('dump','xmltree',$oldN8,'AndroidManifest.xml')
if (-not $oldXml.Contains('com.google.android.gms.ads.APPLICATION_ID')) {
    throw 'N12_N8_UMP_SOURCE_MANIFEST_INVALID'
}
$values = @([regex]::Matches($oldXml,'ca-app-pub-\d{16}~\d{10}') |
    ForEach-Object Value | Select-Object -Unique)
if ($values.Count -ne 1) {throw 'N12_N8_ADMOB_APP_ID_NOT_UNIQUE'}
$privateAdMobId = $values[0]
$values = @()
$oldXml = $null
Write-Output 'N12_UMP_APP_ID_RECOVERED_LOCALLY=PASS; NO_PUBLISHER_ID_PRINTED=TRUE'

$oldJava = $env:JAVA_HOME; $oldAndroid = $env:ANDROID_HOME
$oldNdk = $env:NDK_HOME; $oldCI = $env:CI
$oldN12 = $env:ORG_GRADLE_PROJECT_appsGamesN12LottoBannerPilot
$oldAdMob = $env:APPSGAMES_N7_ADMOB_APP_ID
$oldApproval = $env:APPSGAMES_N12_OWNER_TEST_APPROVAL
$started = Get-Date
try {
    $env:JAVA_HOME = $java
    $env:ANDROID_HOME = $sdk
    $env:NDK_HOME = $ndk
    $env:CI = 'true'
    $env:ORG_GRADLE_PROJECT_appsGamesN12LottoBannerPilot = 'true'
    $env:APPSGAMES_N7_ADMOB_APP_ID = $privateAdMobId
    $env:APPSGAMES_N12_OWNER_TEST_APPROVAL = $null
    $privateAdMobId = $null
    Push-Location -LiteralPath $root
    try {
        $tauri = Join-Path $root 'node_modules\.bin\tauri.cmd'
        $localLock = Join-Path $root 'node_modules\.package-lock.json'
        $repoLock = Join-Path $root 'package-lock.json'
        if (-not ((Test-Path -LiteralPath $tauri -PathType Leaf) -and
            (Test-Path -LiteralPath $localLock -PathType Leaf) -and
            (Get-Item -LiteralPath $localLock).LastWriteTimeUtc -ge
              (Get-Item -LiteralPath $repoLock).LastWriteTimeUtc)) {
            Write-Output 'N12_NPM_INSTALL=START'
            $oldPreference = $ErrorActionPreference
            try {
                $ErrorActionPreference = 'Continue'
                & $npm ci --no-audit --no-fund
                $code = $LASTEXITCODE
            } finally { $ErrorActionPreference = $oldPreference }
            if ($code -ne 0) {throw ('N12_NPM_INSTALL_FAILED_'+$code)}
        }
        Write-Output 'N12_NPM=PASS'
        Write-Output 'N12_DEBUG_APK_BUILD=START; AD_REQUESTS_COMPILED_OFF=TRUE'
        $oldPreference = $ErrorActionPreference
        try {
            $ErrorActionPreference = 'Continue'
            & $npm run tauri -- android build --debug --apk --ci --target aarch64
            $code = $LASTEXITCODE
        } finally {$ErrorActionPreference = $oldPreference}
        if ($code -ne 0) {throw ('N12_APK_BUILD_FAILED_'+$code)}
    } finally {Pop-Location}
} finally {
    $env:JAVA_HOME = $oldJava
    $env:ANDROID_HOME = $oldAndroid
    $env:NDK_HOME = $oldNdk
    $env:CI = $oldCI
    $env:ORG_GRADLE_PROJECT_appsGamesN12LottoBannerPilot = $oldN12
    $env:APPSGAMES_N7_ADMOB_APP_ID = $oldAdMob
    $env:APPSGAMES_N12_OWNER_TEST_APPROVAL = $oldApproval
    $privateAdMobId = $null
}
$apk = Join-Path $root 'src-tauri\gen\android\app\build\outputs\apk\universal\debug\app-universal-debug.apk'
if (-not (Test-Path -LiteralPath $apk -PathType Leaf) -or
    (Get-Item -LiteralPath $apk).LastWriteTime -lt $started.AddMinutes(-2)) {
    throw 'N12_NEW_APK_MISSING'
}
$newBadging = NativeChecked $aapt[0].FullName @('dump','badging',$apk)
$newManifest = NativeChecked $aapt[0].FullName @('dump','xmltree',$apk,'AndroidManifest.xml')
if (-not $newBadging.Contains("package: name='$pkg'") -or
    -not $newBadging.Contains('application-debuggable') -or
    -not $newManifest.Contains('N12LottoBannerActivity') -or
    -not $newManifest.Contains('com.google.android.gms.ads.APPLICATION_ID')) {
    throw 'N12_APK_PACKAGE_MANIFEST_MISMATCH'
}
foreach ($forbidden in @(
    'com.ironsource.lifecycle.IronsourceLifecycleProvider',
    'com.ironsource.lifecycle.LevelPlayActivityLifecycleProvider'
)) {
    if ($newManifest.Contains($forbidden)) {
        throw 'N12_PRECONSENT_SDK_PROVIDER_PRESENT'
    }
}
Write-Output 'N12_BUILD=PASS; N12_MANIFEST=PASS; DEBUG_PACKAGE_ISOLATION=PASS'
Write-Output ('N12_APK_SHA256='+(Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash)
Write-Output ('N12_APK_PATH='+$apk)
Write-Output 'NO_ADB=TRUE; NO_INSTALL=TRUE; NO_LAUNCH=TRUE'
Write-Output 'TEST_AD_REQUESTS=OFF; REAL_ADS=OFF; PRODUCTION_NO_GO=TRUE'
