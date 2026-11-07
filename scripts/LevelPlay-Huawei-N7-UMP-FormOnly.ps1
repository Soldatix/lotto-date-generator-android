# N7 Huawei Google UMP form-only test. NO banner, NO LevelPlay, NO ad requests.
# PowerShell 5.1, separate SHA-pinned disposable pilot clone ONLY.
# Requires a PUBLISHED Android AdMob UMP message before expecting a dialog.
[CmdletBinding()]
param([switch]$InstallAndLaunch)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$branch = 'pilot/levelplay-android-banner-2026-11-04'
$testPkg = 'org.appsandgames.datelottogenerator.levelplaypilot'
$prodPkg = 'org.appsandgames.datelottogenerator'
$sdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$adb = Join-Path $sdk 'platform-tools\adb.exe'
$java = Join-Path $env:ProgramFiles 'Android\Android Studio\jbr'
$ndk = Join-Path $sdk 'ndk\30.0.16248370'
$report = Join-Path $env:USERPROFILE ('Downloads\DateLotto-N7-UMP-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
Write-Output '=== DATE LOTTO N7 HUAWEI UMP FORM ONLY ==='
Write-Output 'LEVELPLAY=OFF; AD_REQUESTS=OFF; PRODUCTION_NO_GO=TRUE'
Write-Output 'DEBUG_ONLY=TRUE; N7_UMP_NETWORK_CALL=OPT_IN'

function Invoke-Checked([string]$exe, [string[]]$argv) {
    $oldPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $result = (& $exe @argv 2>&1 | Out-String)
        $code = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $oldPreference
    }
    if ($code -ne 0) { throw ('COMMAND_FAILED_'+$code+' '+$exe+' '+$result) }
    return $result.Trim()
}
function Assert-Source([string]$path,[string]$needle) {
    if (-not (Test-Path -LiteralPath $path) -or
        -not (Get-Content -LiteralPath $path -Raw).Contains($needle)) {
        throw ('SOURCE_GUARD_FAILED_'+$path)
    }
}
$git = (Get-Command git.exe -ErrorAction Stop).Source
$npm = (Get-Command npm.cmd -ErrorAction Stop).Source
$base = (Invoke-Checked -exe $git -argv @('-C',$repo,'rev-parse','--show-toplevel')).Replace('/','\')
if ($base -ne $repo.Replace('/','\')) { throw 'WRONG_REPO_ROOT' }
if (-not $repo.StartsWith((Join-Path $env:TEMP 'DateLotto-N7-'),[StringComparison]::OrdinalIgnoreCase)) {
    throw 'DISPOSABLE_CLONE_REQUIRED'
}
if ((Invoke-Checked -exe $git -argv @('-C',$repo,'branch','--show-current')) -ne $branch) {
    throw 'WRONG_GIT_BRANCH'
}
if ((Invoke-Checked -exe $git -argv @('-C',$repo,'status','--porcelain')) -ne '') {
    throw 'DIRTY_WORKTREE'
}
$gradle = Join-Path $repo 'src-tauri\gen\android\app\build.gradle.kts'
$activity = Join-Path $repo 'src-tauri\gen\android\app\src\n7ConsentPilot\java\org\appsandgames\datelottogenerator\N7UmpPreviewActivity.kt'
$sdkDraft = Join-Path $repo 'src-tauri\gen\android\app\src\levelplayPilot\java\org\appsandgames\datelottogenerator\LevelPlaySdkBannerDraft.kt'
Assert-Source $gradle 'N7_UMP_ONLY: LevelPlay cannot run before consent'
Assert-Source $gradle 'N7_PRODUCTION_NO_GO'
Assert-Source $activity 'DEBUG_N7_UMP_PREVIEW'
Assert-Source $activity 'loadAndShowConsentFormIfRequired'
Assert-Source $sdkDraft 'APPROVED_AD_REQUESTS = false'
if ($env:ORG_GRADLE_PROJECT_appsGamesLevelPlaySdkPilot -match '^(?i:true)$') {
    throw 'GLOBAL_LEVELPLAY_OPT_IN_FORBIDDEN'
}
foreach ($p in @((Join-Path $env:USERPROFILE '.gradle\gradle.properties'),
                  (Join-Path $repo 'src-tauri\gen\android\gradle.properties'))) {
    if ((Test-Path -LiteralPath $p) -and
        (Get-Content -LiteralPath $p -Raw) -match '(?mi)^\s*appsGamesLevelPlaySdkPilot\s*=\s*true\b') {
        throw 'PERSISTENT_LEVELPLAY_OPT_IN_FORBIDDEN'
    }
}
foreach ($p in @($adb,(Join-Path $java 'bin\java.exe'),
                  (Join-Path $ndk 'source.properties'),
                  (Join-Path $sdk 'platforms\android-37.0\android.jar'))) {
    if (-not (Test-Path -LiteralPath $p)) { throw ('MISSING_PREREQUISITE_'+$p) }
}
$list = Invoke-Checked -exe $adb -argv @('devices')
$devices = @([regex]::Matches($list,'(?m)^(\S+)\s+device\s*$'))
if ($devices.Count -ne 1) { throw 'EXACTLY_ONE_AUTHORIZED_DEVICE_REQUIRED' }
$serial = $devices[0].Groups[1].Value
function Adb([string[]]$cmd) {
    return Invoke-Checked -exe $adb -argv (@('-s',$serial)+$cmd)
}
if ((Adb -cmd @('shell','getprop','ro.product.model')) -ne 'CMR-W09' -or
    (Adb -cmd @('shell','getprop','ro.build.version.sdk')) -ne '28') {
    throw 'HUAWEI_CMR_W09_ANDROID9_REQUIRED'
}
Write-Output 'HUAWEI_CMR_W09=PASS'
Write-Output 'SOURCE_GATES=PASS'

# The local AdMob Android application ID is NOT saved, printed or sent to GitHub.
$secureId = Read-Host 'Unesi Android AdMob App ID (skriven unos)' -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureId)
try {
    $privateAppId = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
}
if ($privateAppId -cnotmatch '^ca-app-pub-\d{16}~\d{10}$') {
    throw 'INVALID_PRIVATE_ADMOB_APP_ID_SHAPE'
}
Write-Output 'PRIVATE_ADMOB_APP_ID_FORMAT=PASS; ID_NOT_PRINTED=TRUE'
$oldJava=$env:JAVA_HOME; $oldSdk=$env:ANDROID_HOME; $oldNdk=$env:NDK_HOME
$oldCi=$env:CI; $oldOpt=$env:ORG_GRADLE_PROJECT_appsGamesN7UmpPreview
$oldAppId=$env:APPSGAMES_N7_ADMOB_APP_ID
$buildStarted=Get-Date
try {
    $env:JAVA_HOME=$java
    $env:ANDROID_HOME=$sdk
    $env:NDK_HOME=$ndk
    $env:CI='true'
    $env:ORG_GRADLE_PROJECT_appsGamesN7UmpPreview='true'
    $env:APPSGAMES_N7_ADMOB_APP_ID=$privateAppId
    $privateAppId=$null
    Push-Location -LiteralPath $repo
    try {
        Write-Output 'NPM_CI=START'
        $p=Start-Process -FilePath $npm -ArgumentList @('ci','--no-audit','--no-fund') -NoNewWindow -Wait -PassThru
        if($p.ExitCode -ne 0){throw ('NPM_CI_FAILED_'+$p.ExitCode)}
        Write-Output 'NPM_CI=PASS; N7_DEBUG_BUILD=START'
        $p=Start-Process -FilePath $npm -ArgumentList @(
            'run','tauri','--','android','build','--debug','--apk','--ci','--target','aarch64'
        ) -NoNewWindow -Wait -PassThru
        if($p.ExitCode -ne 0){throw ('N7_BUILD_FAILED_'+$p.ExitCode)}
        Write-Output 'N7_DEBUG_BUILD=PASS'
    } finally { Pop-Location }
} finally {
    $env:JAVA_HOME=$oldJava; $env:ANDROID_HOME=$oldSdk
    $env:NDK_HOME=$oldNdk; $env:CI=$oldCi
    $env:ORG_GRADLE_PROJECT_appsGamesN7UmpPreview=$oldOpt
    $env:APPSGAMES_N7_ADMOB_APP_ID=$oldAppId
    $privateAppId=$null
}
$apk=Join-Path $repo 'src-tauri\gen\android\app\build\outputs\apk\universal\debug\app-universal-debug.apk'
if (-not (Test-Path -LiteralPath $apk) -or
    (Get-Item -LiteralPath $apk).LastWriteTime -lt $buildStarted.AddMinutes(-2)) {
    throw 'FRESH_DEBUG_APK_NOT_FOUND'
}
$aapt = @(Get-ChildItem -LiteralPath (Join-Path $sdk 'build-tools') -Filter aapt.exe -Recurse -File |
          Sort-Object FullName -Descending | Select-Object -First 1)
if ($aapt.Count -ne 1) { throw 'AAPT_NOT_FOUND' }
$badging=Invoke-Checked -exe $aapt[0].FullName -argv @('dump','badging',$apk)
if ($badging -notmatch "package: name='org\.appsandgames\.datelottogenerator\.levelplaypilot'" -or
    $badging -notmatch 'application-debuggable') { throw 'PILOT_DEBUG_APK_IDENTITY_FAILED' }
$xml=Invoke-Checked -exe $aapt[0].FullName -argv @('dump','xmltree',$apk,'AndroidManifest.xml')
if ($xml -notmatch 'N7UmpPreviewActivity' -or
    $xml -notmatch 'com.google.android.gms.ads.APPLICATION_ID') {
    throw 'N7_ACTIVITY_OR_MANIFEST_APP_ID_MISSING'
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip=[System.IO.Compression.ZipFile]::OpenRead($apk)
$hasUmp=$false;$hasLevelPlay=$false
try {
    foreach($entry in $zip.Entries){
        if($entry.FullName -notmatch '^classes\d*\.dex$'){continue}
        if($entry.Length -gt 67108864){throw 'DEX_TOO_LARGE_TO_INSPECT'}
        $reader=New-Object IO.StreamReader($entry.Open(),[Text.Encoding]::ASCII)
        try{$dex=$reader.ReadToEnd()}finally{$reader.Dispose()}
        if($dex.Contains('Lcom/google/android/ump/')){$hasUmp=$true}
        if($dex.Contains('Lcom/unity3d/mediation/') -or
           $dex.Contains('Lcom/ironsource/mediationsdk/') -or
           $dex.Contains('Lcom/ironsource/adquality/')){$hasLevelPlay=$true}
    }
} finally {$zip.Dispose()}
if (-not $hasUmp -or $hasLevelPlay){throw 'N7_ONLY_DEX_GATE_FAILED'}
$sha=(Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash
Write-Output 'APK_DEBUG_ID=PASS; UMP_ONLY=PASS; LEVELPLAY_SDK=ABSENT'
Write-Output ('APK_SHA256='+$sha)
Write-Output 'REAL_ADS=OFF; PRODUCTION_NO_GO=TRUE'
if(-not $InstallAndLaunch){
    Write-Output 'APK_NOT_INSTALLED=TRUE; use -InstallAndLaunch after Android UMP form is published'
    return
}
$approval=Read-Host 'Za testni UMP poziv (bez oglasa) upisi: APPROVE N7 UMP'
if($approval -cne 'APPROVE N7 UMP'){throw 'N7_TEST_NOT_APPROVED'}
$before=(Adb -cmd @('shell','pm','list','packages')) -split '\r?\n'
$productionBefore=($before -contains ('package:'+$prodPkg))
New-Item -ItemType Directory -Path $report -Force | Out-Null
Write-Output 'ISOLATED_HUAWEI_INSTALL=START'
$install=Adb -cmd @('install','-r',$apk)
if($install -notmatch '(?m)^Success\s*$'){throw 'N7_INSTALL_FAILED'}
Write-Output 'ISOLATED_HUAWEI_INSTALL=PASS'
$component=$testPkg+'/org.appsandgames.datelottogenerator.N7UmpPreviewActivity'
$launch=Adb -cmd @('shell','am','start','-W','-n',$component,'--ez',
    'org.appsandgames.datelottogenerator.DEBUG_N7_UMP_PREVIEW','true')
if($launch -notmatch 'Status:\s*ok'){throw 'N7_ACTIVITY_LAUNCH_FAILED'}
Start-Sleep -Seconds 4
$logs=Adb -cmd @('logcat','-d','-v','brief','-t','1200','-s','DateLottoN7UMP:V','*:S')
[IO.File]::WriteAllText((Join-Path $report 'N7-UMP-generic-logs.txt'),$logs,
    (New-Object System.Text.UTF8Encoding($false)))
$remote='/sdcard/Download/DateLotto-N7-UMP.png'
$null=Adb -cmd @('shell','screencap','-p',$remote)
$null=Adb -cmd @('pull',$remote,(Join-Path $report 'N7-UMP-screen.png'))
$null=Adb -cmd @('shell','rm',$remote)
$after=(Adb -cmd @('shell','pm','list','packages')) -split '\r?\n'
if(($after -contains ('package:'+$prodPkg)) -ne $productionBefore){
    throw 'PRODUCTION_PACKAGE_STATE_CHANGED'
}
Write-Output '=== N7 HUAWEI RESULT ==='
Write-Output ('UMP_STARTED='+$logs.Contains('N7_UMP=REFRESH_STARTED_NO_ADS'))
Write-Output ('UMP_REFRESH_OK='+$logs.Contains('N7_UMP=REFRESH_OK_NO_ADS'))
Write-Output ('UMP_FORM_DONE_OR_NOT_REQUIRED='+$logs.Contains('N7_UMP=FORM_COMPLETED_OR_NOT_REQUIRED_NO_ADS'))
Write-Output 'PRODUCTION_PACKAGE_STATE=UNCHANGED'
Write-Output ('REPORT_DIRECTORY='+$report)
Write-Output 'REAL_ADS=OFF; PRODUCTION_NO_GO=TRUE'
