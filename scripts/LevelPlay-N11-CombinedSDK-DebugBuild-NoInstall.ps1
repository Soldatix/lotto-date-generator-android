# N11 Windows 11 / PowerShell 5.1 — build-only real API-37 manifest audit.
# Creates a disposable debug APK with Google UMP 4.0.0 + LevelPlay 9.5.0
# for static inspection. NEVER installs, executes or sends ad requests.
# The isolated test APK is NOT approved for deployment to any device.
# NO prompts, NO approval input, NO real Ads ID printed.
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repo=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$branch='pilot/levelplay-android-banner-2026-11-04'
$testPkg='org.appsandgames.datelottogenerator.levelplaypilot'
$sdk=Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$java=Join-Path $env:ProgramFiles 'Android\Android Studio\jbr'
$ndk=Join-Path $sdk 'ndk\30.0.16248370'
$sourceApk=Join-Path $env:TEMP 'DateLotto-N8-20261107-134705\src-tauri\gen\android\app\build\outputs\apk\universal\debug\app-universal-debug.apk'
$sourceSha='40CE83AC44EF7C1398C0A74558F6BE7299BCF1F340C9FE12C828D7418C639798'
$git=(Get-Command git.exe -ErrorAction Stop).Source
$npm=(Get-Command npm.cmd -ErrorAction Stop).Source

Write-Output '=== DATE LOTTO N11 COMBINED UMP + LEVELPLAY BUILD ONLY ==='
Write-Output 'NO_PROMPTS=TRUE; NO_ADB=TRUE; NO_INSTALL=TRUE; NO_LAUNCH=TRUE'
Write-Output 'TEST_AD_REQUESTS=OFF; REAL_ADS=OFF; PRODUCTION_NO_GO=TRUE'

function Checked([string]$Exe,[string[]]$Arguments) {
    $pref=$ErrorActionPreference
    try {
        $ErrorActionPreference='Continue'
        $output=(& $Exe @Arguments 2>&1 | Out-String)
        $exitCode=$LASTEXITCODE
    } finally {$ErrorActionPreference=$pref}
    if($null -eq $exitCode -or $exitCode -ne 0) {
        throw ('N11_EXTERNAL_COMMAND_FAILED_'+[string]$exitCode+' '+$Exe+' '+$output)
    }
    return $output.Trim()
}
function MustContain([string]$Path,[string]$Needle) {
    if(-not (Test-Path -LiteralPath $Path -PathType Leaf) -or
        -not (Get-Content -LiteralPath $Path -Raw).Contains($Needle)) {
        throw ('N11_SOURCE_GUARD_FAILED_'+$Needle)
    }
}
function Npm([string[]]$CommandArgs) {
    $pref=$ErrorActionPreference
    $nativeExit=$null
    try {
        $ErrorActionPreference='Continue'
        & $npm @CommandArgs
        $nativeExit=$LASTEXITCODE
    } finally {$ErrorActionPreference=$pref}
    if($null -eq $nativeExit -or $nativeExit -ne 0){
        throw ('N11_NPM_EXIT_'+[string]$nativeExit)
    }
}
if(-not $repo.StartsWith(
   (Join-Path $env:TEMP 'DateLotto-N11-'),
   [StringComparison]::OrdinalIgnoreCase)) {
    throw 'N11_DISPOSABLE_TEMP_CLONE_REQUIRED'
}
if((Checked -Exe $git -Arguments @('-C',$repo,'branch','--show-current')) -cne $branch) {
    throw 'N11_WRONG_BRANCH'
}
if((Checked -Exe $git -Arguments @('-C',$repo,'status','--porcelain')) -ne '') {
    throw 'N11_DIRTY_WORKTREE'
}

$gradle=Join-Path $repo 'src-tauri\gen\android\app\build.gradle.kts'
$sdkDraft=Join-Path $repo 'src-tauri\gen\android\app\src\levelplayPilot\java\org\appsandgames\datelottogenerator\LevelPlaySdkBannerDraft.kt'
$n10=Join-Path $repo 'src-tauri\gen\android\app\src\levelplayPilot\java\org\appsandgames\datelottogenerator\N10FailClosedSession.kt'
$umpCoordinator=Join-Path $repo 'src-tauri\gen\android\app\src\levelplayPilot\java\org\appsandgames\datelottogenerator\N10UmpNativeCoordinator.kt'
$nativeAnchor=Join-Path $repo 'src-tauri\gen\android\app\src\main\java\org\appsandgames\datelottogenerator\NativeAnchoredBannerProbe.kt'
MustContain $gradle 'N9_PRODUCTION_NO_GO'
MustContain $gradle 'N9_SEPARATE_DEBUG_REVIEW_REQUIRED'
MustContain $gradle 'N9_PRIVATE_ADMOB_APP_ID_REQUIRED'
MustContain $gradle 'com.unity3d.ads-mediation:mediation-sdk:9.5.0'
MustContain $sdkDraft 'APPROVED_AD_REQUESTS = false'
MustContain $n10 'N10_SDK_INIT_APPROVED = false'
MustContain $n10 'N10_TEST_AD_REQUESTS_APPROVED = false'
MustContain $umpCoordinator 'N10_UMP_RUNTIME_APPROVED = false'
MustContain $umpCoordinator 'N10_N5_SDK_HANDOFF_APPROVED = false'
MustContain $nativeAnchor 'N3_SDK_PLACEMENT_HANDOFF_APPROVED = false'
Write-Output 'N11_NO_AD_REQUEST_GATES=PASS'

foreach($prop in @('appsGamesLevelPlaySdkPilot','appsGamesN7UmpPreview')) {
    $value=[Environment]::GetEnvironmentVariable(
        'ORG_GRADLE_PROJECT_'+$prop,'Process'
    )
    if($value -match '^(?i:true)$'){throw ('N11_INCOMPATIBLE_GLOBAL_PROPERTY_'+$prop)}
}
foreach($file in @(
    (Join-Path $env:USERPROFILE '.gradle\gradle.properties'),
    (Join-Path $repo 'src-tauri\gen\android\gradle.properties')
)) {
    if(-not (Test-Path -LiteralPath $file -PathType Leaf)){continue}
    $props=Get-Content -LiteralPath $file -Raw
    if($props -match '(?mi)^\s*appsGames(LevelPlaySdkPilot|N7UmpPreview|N9ConsentBannerReview)\s*=\s*true\b') {
        throw 'N11_PERSISTENT_AD_SDK_PROPERTY_FORBIDDEN'
    }
}
foreach($f in @(
    (Join-Path $java 'bin\java.exe'),
    (Join-Path $ndk 'source.properties'),
    (Join-Path $sdk 'platforms\android-37.0\android.jar')
)) {
    if(-not (Test-Path -LiteralPath $f -PathType Leaf)) {
        throw ('N11_MISSING_ANDROID_TOOLCHAIN_'+$f)
    }
}
$aapt=@(Get-ChildItem -LiteralPath (Join-Path $sdk 'build-tools') -Filter aapt.exe -File -Recurse |
    Sort-Object FullName -Descending | Select-Object -First 1)
if($aapt.Count -ne 1){throw 'N11_AAPT_MISSING'}

# Reuse the ONLY known-good owner's prior debug APK for its private AdMob
# App ID; never prompt, print, persist in the repo or fabricate an ID.
if(-not (Test-Path -LiteralPath $sourceApk -PathType Leaf) -or
   (Get-FileHash -LiteralPath $sourceApk -Algorithm SHA256).Hash -cne $sourceSha) {
    throw 'N11_PRIOR_N8_APK_SHA256_MISSING_OR_MISMATCH'
}
$badging=Checked -Exe $aapt[0].FullName -Arguments @('dump','badging',$sourceApk)
if(-not $badging.Contains("package: name='$testPkg'") -or
   -not $badging.Contains('application-debuggable')){
    throw 'N11_PRIOR_N8_APK_IDENTITY_FAILED'
}
$xml=Checked -Exe $aapt[0].FullName -Arguments @('dump','xmltree',$sourceApk,'AndroidManifest.xml')
if(-not $xml.Contains('com.google.android.gms.ads.APPLICATION_ID')) {
    throw 'N11_PRIOR_N8_APK_UMP_METADATA_MISSING'
}
$ids=@([regex]::Matches($xml,'ca-app-pub-\d{16}~\d{10}') |
    ForEach-Object Value | Select-Object -Unique)
if($ids.Count -ne 1){throw 'N11_PRIVATE_APP_ID_NOT_UNIQUE'}
$privateId=$ids[0]
$ids=@();$xml=$null
Write-Output 'N11_ADMOB_ID_RECOVERED_LOCALLY=PASS; ID_NOT_PRINTED=TRUE'

$oldJava=$env:JAVA_HOME
$oldAndroid=$env:ANDROID_HOME
$oldNdk=$env:NDK_HOME
$oldCi=$env:CI
$oldN9=$env:ORG_GRADLE_PROJECT_appsGamesN9ConsentBannerReview
$oldAdMob=$env:APPSGAMES_N7_ADMOB_APP_ID
$buildStarted=Get-Date
try {
    $env:JAVA_HOME=$java
    $env:ANDROID_HOME=$sdk
    $env:NDK_HOME=$ndk
    $env:CI='true'
    $env:ORG_GRADLE_PROJECT_appsGamesN9ConsentBannerReview='true'
    $env:APPSGAMES_N7_ADMOB_APP_ID=$privateId
    $privateId=$null
    Push-Location -LiteralPath $repo
    try {
        $lock=Join-Path $repo 'node_modules\.package-lock.json'
        $cmd=Join-Path $repo 'node_modules\.bin\tauri.cmd'
        $sourceLock=Join-Path $repo 'package-lock.json'
        if((Test-Path -LiteralPath $lock -PathType Leaf) -and
           (Test-Path -LiteralPath $cmd -PathType Leaf) -and
           (Get-Item -LiteralPath $lock).LastWriteTimeUtc -ge
           (Get-Item -LiteralPath $sourceLock).LastWriteTimeUtc){
            Write-Output 'N11_NPM=REUSE_EXISTING'
        } else {
            Write-Output 'N11_NPM_CI=START'
            Npm -CommandArgs @('ci','--no-audit','--no-fund')
            Write-Output 'N11_NPM_CI=PASS'
        }
        Write-Output 'N11_BUILD_ONLY=START; NEVER_INSTALL=TRUE'
        Npm -CommandArgs @('run','tauri','--','android','build','--debug','--apk','--ci','--target','aarch64')
        Write-Output 'N11_COMBINED_APK_COMPILED=PASS'
    } finally {Pop-Location}
} finally {
    $env:JAVA_HOME=$oldJava
    $env:ANDROID_HOME=$oldAndroid
    $env:NDK_HOME=$oldNdk
    $env:CI=$oldCi
    $env:ORG_GRADLE_PROJECT_appsGamesN9ConsentBannerReview=$oldN9
    $env:APPSGAMES_N7_ADMOB_APP_ID=$oldAdMob
    $privateId=$null
}
$apk=Join-Path $repo 'src-tauri\gen\android\app\build\outputs\apk\universal\debug\app-universal-debug.apk'
if(-not (Test-Path -LiteralPath $apk -PathType Leaf) -or
  (Get-Item -LiteralPath $apk).LastWriteTime -lt $buildStarted.AddMinutes(-2)) {
    throw 'N11_FRESH_COMBINED_APK_MISSING'
}
$testBadging=Checked -Exe $aapt[0].FullName -Arguments @('dump','badging',$apk)
$testManifest=Checked -Exe $aapt[0].FullName -Arguments @('dump','xmltree',$apk,'AndroidManifest.xml')
if(-not $testBadging.Contains("package: name='$testPkg'") -or
   -not $testBadging.Contains('application-debuggable') -or
   -not $testManifest.Contains('N7UmpPreviewActivity') -or
   -not $testManifest.Contains('N8UmpPrivacyOptionsActivity') -or
   -not $testManifest.Contains('com.google.android.gms.ads.APPLICATION_ID')){
    throw 'N11_COMBINED_APK_PACKAGE_OR_UMP_FAILED'
}
foreach($component in @(
    'com.ironsource.lifecycle.IronsourceLifecycleProvider',
    'com.ironsource.lifecycle.LevelPlayActivityLifecycleProvider',
    'com.ironsource.mediationsdk.testSuite.TestSuiteActivity'
)) {
    if(-not $testManifest.Contains($component)) {
        throw ('N11_SDK_MANIFEST_COMPONENT_NOT_PRESENT_'+$component)
    }
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip=[IO.Compression.ZipFile]::OpenRead($apk)
$hasUmp=$false;$hasLevelPlay=$false;$hasN10=$false
try {
    foreach($entry in $zip.Entries) {
        if($entry.FullName -notmatch '^classes\d*\.dex$'){continue}
        if($entry.Length -gt 67108864){throw 'N11_DEX_TOO_LARGE_FOR_SAFETY_SCAN'}
        $reader=New-Object IO.StreamReader($entry.Open(),[Text.Encoding]::ASCII)
        try {$dex=$reader.ReadToEnd()} finally {$reader.Dispose()}
        if($dex.Contains('Lcom/google/android/ump/')){$hasUmp=$true}
        if($dex.Contains('Lcom/unity3d/mediation/') -or
           $dex.Contains('Lcom/ironsource/mediationsdk/')){$hasLevelPlay=$true}
        if($dex.Contains('N10FailClosedSession')){$hasN10=$true}
    }
} finally {$zip.Dispose()}
if(-not $hasUmp -or -not $hasLevelPlay -or -not $hasN10) {
    throw 'N11_COMBINED_APK_DEX_IDENTITY_FAILED'
}
$hash=(Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash
Write-Output 'N11_REAL_API37_DEBUG_MANIFEST=PRELIMINARY_COMPONENT_CHECK_PASS'
Write-Output 'N11_UMP_PRESENT=TRUE; LEVELPLAY_SDK_PRESENT=TRUE; N10_GUARDS_PRESENT=TRUE'
Write-Output ('N11_COMBINED_APK_SHA256='+$hash)
Write-Output ('N11_APK_PATH='+$apk)
Write-Output 'NO_ADB=TRUE; NO_INSTALL=TRUE; NO_LAUNCH=TRUE'
Write-Output 'SDK_STARTUP_PRIVACY_REVIEW=PENDING'
Write-Output 'REAL_ADS=OFF; PRODUCTION_NO_GO=TRUE'
