# N8 Huawei privacy-options / refusal / withdrawal device test.
# No prompts. Execution by owner explicitly starts this UMP-only debug test.
# Uses only the previously SHA-verified N7 isolated APK for the AdMob App ID.
# NO LevelPlay SDK, NO ad requests, NO Android production package changes.
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'

$repo=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$branch='pilot/levelplay-android-banner-2026-11-04'
$pilot='org.appsandgames.datelottogenerator.levelplaypilot'
$prod='org.appsandgames.datelottogenerator'
$sdk=Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$adb=Join-Path $sdk 'platform-tools\adb.exe'
$java=Join-Path $env:ProgramFiles 'Android\Android Studio\jbr'
$ndk=Join-Path $sdk 'ndk\30.0.16248370'
$sourceApk=Join-Path $env:TEMP 'DateLotto-N7-20261107-124816\src-tauri\gen\android\app\build\outputs\apk\universal\debug\app-universal-debug.apk'
$sourceSha='65ABEF8ED904BB808A10C5012175E69AA2D06645AED395E89F8A908CBE4EB6A1'
Write-Output '=== DATE LOTTO N8 UMP PRIVACY OPTIONS ==='
Write-Output 'NO_PROMPTS=TRUE; PREVIOUS_N7_APK_AS_INPUT=TRUE'
Write-Output 'REAL_ADS=OFF; PRODUCTION_NO_GO=TRUE'

function Checked([string]$Exe,[string[]]$Arguments) {
    $old=$ErrorActionPreference
    try {
        $ErrorActionPreference='Continue'
        $output=(& $Exe @Arguments 2>&1 | Out-String)
        $code=$LASTEXITCODE
    } finally {
        $ErrorActionPreference=$old
    }
    if($code -ne 0) {throw ('COMMAND_FAILED_'+$code+' '+$Exe+' '+$output)}
    return $output.Trim()
}
function Has([string]$File,[string]$Text) {
    if(-not (Test-Path -LiteralPath $File -PathType Leaf) -or
       -not (Get-Content -LiteralPath $File -Raw).Contains($Text)) {
        throw ('SOURCE_SAFETY_GATE_'+$File)
    }
}
$git=(Get-Command git.exe -ErrorAction Stop).Source
$npm=(Get-Command npm.cmd -ErrorAction Stop).Source
if(-not $repo.StartsWith((Join-Path $env:TEMP 'DateLotto-N8-'),[StringComparison]::OrdinalIgnoreCase)) {
    throw 'ISOLATED_TEMP_CLONE_REQUIRED'
}
if((Checked -Exe $git -Arguments @('-C',$repo,'branch','--show-current')) -ne $branch) {
    throw 'WRONG_BRANCH'
}
if((Checked -Exe $git -Arguments @('-C',$repo,'status','--porcelain')) -ne '') {
    throw 'DIRTY_WORKTREE'
}
if(-not (Test-Path -LiteralPath $sourceApk -PathType Leaf) -or
   (Get-FileHash -LiteralPath $sourceApk -Algorithm SHA256).Hash -ne $sourceSha) {
    throw 'OLD_N7_APK_SHA_MISMATCH'
}
$gradle=Join-Path $repo 'src-tauri\gen\android\app\build.gradle.kts'
$oldSdk=Join-Path $repo 'src-tauri\gen\android\app\src\levelplayPilot\java\org\appsandgames\datelottogenerator\LevelPlaySdkBannerDraft.kt'
$n8=Join-Path $repo 'src-tauri\gen\android\app\src\n7ConsentPilot\java\org\appsandgames\datelottogenerator\N8UmpPrivacyOptionsActivity.kt'
Has $gradle 'N7_UMP_ONLY: LevelPlay cannot run before consent'
Has $gradle 'N7_PRODUCTION_NO_GO'
Has $oldSdk 'APPROVED_AD_REQUESTS = false'
Has $n8 'DEBUG_N8_UMP_PRIVACY'
Has $n8 'showPrivacyOptionsForm'
if($env:ORG_GRADLE_PROJECT_appsGamesLevelPlaySdkPilot -match '^(?i:true)$'){
    throw 'GLOBAL_LEVELPLAY_OPT_IN_FORBIDDEN'
}
foreach($f in @((Join-Path $env:USERPROFILE '.gradle\gradle.properties'),
                (Join-Path $repo 'src-tauri\gen\android\gradle.properties'))) {
    if((Test-Path -LiteralPath $f) -and
       (Get-Content -LiteralPath $f -Raw) -match '(?mi)^\s*appsGamesLevelPlaySdkPilot\s*=\s*true\b') {
        throw 'PERSISTENT_LEVELPLAY_OPT_IN_FORBIDDEN'
    }
}
foreach($f in @($adb,(Join-Path $java 'bin\java.exe'),
                (Join-Path $ndk 'source.properties'),
                (Join-Path $sdk 'platforms\android-37.0\android.jar'))) {
    if(-not (Test-Path -LiteralPath $f)){throw ('MISSING_REQUIREMENT_'+$f)}
}
$aapt=@(Get-ChildItem -LiteralPath (Join-Path $sdk 'build-tools') -Filter aapt.exe -Recurse -File |
        Sort-Object FullName -Descending | Select-Object -First 1)
if($aapt.Count -ne 1){throw 'AAPT_MISSING'}
$oldBadging=Checked -Exe $aapt[0].FullName -Arguments @('dump','badging',$sourceApk)
if(-not $oldBadging.Contains("package: name='$pilot'") -or
   -not $oldBadging.Contains('application-debuggable')){
    throw 'N7_APK_DEBUG_PACKAGE_MISMATCH'
}
$manifest=Checked -Exe $aapt[0].FullName -Arguments @('dump','xmltree',$sourceApk,'AndroidManifest.xml')
if(-not $manifest.Contains('com.google.android.gms.ads.APPLICATION_ID')){
    throw 'SOURCE_N7_ADMOB_META_MISSING'
}
$matches=[regex]::Matches($manifest,'ca-app-pub-\d{16}~\d{10}')
$unique=@($matches | ForEach-Object Value | Select-Object -Unique)
if($unique.Count -ne 1){throw 'SOURCE_N7_ADMOB_APP_ID_NOT_UNIQUE'}
$privateId=$unique[0]
$unique=@()
$manifest=$null
Write-Output 'N7_SOURCE_ID_RECOVERED_LOCALLY=PASS; APP_ID_NOT_PRINTED=TRUE'

$deviceList=Checked -Exe $adb -Arguments @('devices')
$devices=@([regex]::Matches($deviceList,'(?m)^(\S+)\s+device\s*$'))
if($devices.Count -ne 1){throw 'ONE_AUTHORIZED_HUAWEI_REQUIRED'}
$serial=$devices[0].Groups[1].Value
function Device([string[]]$Arguments) {
    return Checked -Exe $adb -Arguments (@('-s',$serial)+$Arguments)
}
if((Device -Arguments @('shell','getprop','ro.product.model')) -ne 'CMR-W09' -or
   (Device -Arguments @('shell','getprop','ro.build.version.sdk')) -ne '28'){
    throw 'WRONG_HUAWEI_DEVICE'
}
Write-Output 'DEVICE=HUAWEI_CMR-W09_API28_PASS'

# Wait for npm parent process only (Start-Process -Wait could hang on Gradle descendants).
function RunBuild([string[]]$Args,[int]$TimeoutMs) {
    $p=Start-Process -FilePath $npm -ArgumentList $Args -NoNewWindow -PassThru
    if(-not $p.WaitForExit($TimeoutMs)){
        try { $p.Kill() } catch {}
        throw 'N8_BUILD_PROCESS_TIMEOUT'
    }
    if($p.ExitCode -ne 0){throw ('N8_NPM_EXIT_'+$p.ExitCode)}
}
$oldJava=$env:JAVA_HOME; $oldAndroid=$env:ANDROID_HOME; $oldNdk=$env:NDK_HOME
$oldCi=$env:CI; $oldFlag=$env:ORG_GRADLE_PROJECT_appsGamesN7UmpPreview
$oldApp=$env:APPSGAMES_N7_ADMOB_APP_ID
$buildStarted=Get-Date
try {
    $env:JAVA_HOME=$java
    $env:ANDROID_HOME=$sdk
    $env:NDK_HOME=$ndk
    $env:CI='true'
    $env:ORG_GRADLE_PROJECT_appsGamesN7UmpPreview='true'
    $env:APPSGAMES_N7_ADMOB_APP_ID=$privateId
    $privateId=$null
    Push-Location -LiteralPath $repo
    try {
        Write-Output 'N8_NPM_CI=START'
        RunBuild -Args @('ci','--no-audit','--no-fund') -TimeoutMs 600000
        Write-Output 'N8_NPM_CI=PASS; N8_BUILD=START'
        RunBuild -Args @('run','tauri','--','android','build','--debug','--apk','--ci','--target','aarch64') -TimeoutMs 900000
        Write-Output 'N8_APK_BUILD=PASS'
    } finally {Pop-Location}
} finally {
    $env:JAVA_HOME=$oldJava; $env:ANDROID_HOME=$oldAndroid
    $env:NDK_HOME=$oldNdk; $env:CI=$oldCi
    $env:ORG_GRADLE_PROJECT_appsGamesN7UmpPreview=$oldFlag
    $env:APPSGAMES_N7_ADMOB_APP_ID=$oldApp
    $privateId=$null
}
$apk=Join-Path $repo 'src-tauri\gen\android\app\build\outputs\apk\universal\debug\app-universal-debug.apk'
if(-not (Test-Path -LiteralPath $apk -PathType Leaf) -or
   (Get-Item -LiteralPath $apk).LastWriteTime -lt $buildStarted.AddMinutes(-2)){
    throw 'FRESH_N8_APK_NOT_FOUND'
}
$badging=Checked -Exe $aapt[0].FullName -Arguments @('dump','badging',$apk)
$xml=Checked -Exe $aapt[0].FullName -Arguments @('dump','xmltree',$apk,'AndroidManifest.xml')
if(-not $badging.Contains("package: name='$pilot'") -or
   -not $badging.Contains('application-debuggable') -or
   -not $xml.Contains('N8UmpPrivacyOptionsActivity') -or
   -not $xml.Contains('com.google.android.gms.ads.APPLICATION_ID')){
    throw 'N8_APK_ID_OR_MANIFEST_FAILED'
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip=[IO.Compression.ZipFile]::OpenRead($apk)
$hasUmp=$false; $hasLevelPlay=$false; $hasN8=$false
try {
    foreach($entry in $zip.Entries) {
        if($entry.FullName -notmatch '^classes\d*\.dex$'){continue}
        if($entry.Length -gt 67108864){throw 'DEX_INSPECT_TOO_LARGE'}
        $reader=New-Object IO.StreamReader($entry.Open(),[Text.Encoding]::ASCII)
        try{$dex=$reader.ReadToEnd()}finally{$reader.Dispose()}
        if($dex.Contains('Lcom/google/android/ump/')){$hasUmp=$true}
        if($dex.Contains('N8UmpPrivacyOptionsActivity')){$hasN8=$true}
        if($dex.Contains('Lcom/unity3d/mediation/') -or
           $dex.Contains('Lcom/ironsource/mediationsdk/') -or
           $dex.Contains('Lcom/ironsource/adquality/')){$hasLevelPlay=$true}
    }
} finally {$zip.Dispose()}
if(-not $hasUmp -or -not $hasN8 -or $hasLevelPlay){throw 'N8_UMP_ONLY_DEX_GATE_FAILED'}
Write-Output 'N8_APK_DEBUG_ID=PASS; UMP_ONLY=PASS; LEVELPLAY_SDK=ABSENT'
Write-Output ('N8_APK_SHA256='+(Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash)
$prior=Device -Arguments @('shell','pm','list','packages')
$prodPrior=($prior -split '\r?\n') -contains ('package:'+$prod)
Write-Output 'N8_INSTALLING_ISOLATED_PILOT=TRUE'
$installed=Device -Arguments @('install','-r',$apk)
if($installed -notmatch '(?m)^Success\s*$'){throw 'N8_INSTALL_FAILED'}
$component=$pilot+'/org.appsandgames.datelottogenerator.N8UmpPrivacyOptionsActivity'
$launched=Device -Arguments @('shell','am','start','-W','-n',$component,
    '--ez','org.appsandgames.datelottogenerator.DEBUG_N8_UMP_PRIVACY','true')
if($launched -notmatch 'Status:\s*ok'){throw 'N8_LAUNCH_FAILED'}
$now=Device -Arguments @('shell','pm','list','packages')
$prodNow=($now -split '\r?\n') -contains ('package:'+$prod)
if($prodPrior -ne $prodNow){throw 'PRODUCTION_PACKAGE_CHANGED'}
Write-Output 'N8_LAUNCHED=PASS; PRODUCTION_PACKAGE_STATE=UNCHANGED'
Write-Output 'ON_HUAWEI: TEST_PRIVACY_OPTIONS_AND_DEBUG_RESET_BUTTON'
Write-Output 'REAL_ADS=OFF; PRODUCTION_NO_GO=TRUE'
