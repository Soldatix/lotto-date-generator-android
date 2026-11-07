# Date Lotto Android: Huawei CMR-W09 visual tablet banner preview.
# Run ONLY from a separate, SHA-pinned disposable pilot clone.
# PowerShell 5.1; real ads OFF; no release, no SDK enable, no PR merge.
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$tag = Get-Date -Format 'yyyyMMdd-HHmmss'
$report = Join-Path $env:USERPROFILE "Downloads\DateLotto-TabletV8-$tag"
$sdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$adb = Join-Path $sdk 'platform-tools\adb.exe'
$javaHome = Join-Path $env:ProgramFiles 'Android\Android Studio\jbr'
$ndk = Join-Path $sdk 'ndk\30.0.16248370'
$testPkg = 'org.appsandgames.datelottogenerator.levelplaypilot'
$prodPkg = 'org.appsandgames.datelottogenerator'
$extra = 'org.appsandgames.datelottogenerator.DEBUG_NATIVE_BANNER_PROBE'

function Run-Cli {
    param([string]$Exe, [string[]]$Arguments, [switch]$Capture)
    $original = $ErrorActionPreference
    $output = ''
    try {
        $ErrorActionPreference = 'Continue'
        if ($Capture) {
            $output = (& $Exe @Arguments 2>&1 | Out-String)
        } else {
            & $Exe @Arguments
        }
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $original
    }
    if ($exitCode -ne 0) {
        throw "COMMAND_FAILED=$exitCode; $Exe; $output"
    }
    return $output
}

Write-Output '=== DATE LOTTO HUAWEI TABLET IN-PANEL MOCK V8 ==='
Write-Output 'PRODUCTION_NO_GO=TRUE; REAL_ADS=OFF'
Write-Output 'DEBUG_ONLY=TRUE; SDK_OPT_IN=FALSE'
Write-Output 'OLD_WORKSPACES=UNTOUCHED; RELEASE_BUILD=FORBIDDEN'

$git = (Get-Command git.exe -ErrorAction Stop).Source
$npm = (Get-Command npm.cmd -ErrorAction Stop).Source
$repoTop = (Run-Cli $git @('-C',$root,'rev-parse','--show-toplevel') -Capture).Trim().Replace('/','\')
if ($repoTop -ne $root.Replace('/','\')) { throw 'UNEXPECTED_REPO_ROOT' }
if ($root -notlike "$env:TEMP\DateLotto-TabletV8-*") {
    throw 'WORKSPACE_NOT_DISPOSABLE_TABLET_V8'
}
$dirty = (Run-Cli $git @('-C',$root,'status','--porcelain') -Capture).Trim()
if ($dirty) { throw "SOURCE_NOT_CLEAN_BEFORE_BUILD=$dirty" }

$gradleFile = Join-Path $root 'src-tauri\gen\android\app\build.gradle.kts'
$sdkDraft = Join-Path $root 'src-tauri\gen\android\app\src\levelplayPilot\java\org\appsandgames\datelottogenerator\LevelPlaySdkBannerDraft.kt'
$probe = Join-Path $root 'src-tauri\gen\android\app\src\main\java\org\appsandgames\datelottogenerator\NativeBannerHostProbe.kt'
$index = Join-Path $root 'index.html'
if (-not (Get-Content -LiteralPath $gradleFile -Raw).Contains('appsGamesLevelPlaySdkPilot') -or
    -not (Get-Content -LiteralPath $sdkDraft -Raw).Contains('APPROVED_AD_REQUESTS = false') -or
    -not (Get-Content -LiteralPath $probe -Raw).Contains('HOST_PROBE=TABLET_PANEL_ATTACHED_NO_ADS') -or
    -not (Get-Content -LiteralPath $index -Raw).Contains('id="nativeTabletBannerProbe"')) {
    throw 'REQUIRED_SOURCE_OR_NO_AD_GUARDS_MISSING'
}
if ($env:ORG_GRADLE_PROJECT_appsGamesLevelPlaySdkPilot -match '^(?i:true)$') {
    throw 'SDK_GLOBAL_OPT_IN_FORBIDDEN'
}
foreach ($props in @((Join-Path $env:USERPROFILE '.gradle\gradle.properties'),
                     (Join-Path $root 'src-tauri\gen\android\gradle.properties'))) {
    if ((Test-Path -LiteralPath $props) -and
        (Get-Content -LiteralPath $props -Raw) -match '(?mi)^\s*appsGamesLevelPlaySdkPilot\s*=\s*true\b') {
        throw 'SDK_GRADLE_OPT_IN_FORBIDDEN'
    }
}

foreach ($needed in @($adb, (Join-Path $javaHome 'bin\java.exe'),
                     (Join-Path $ndk 'source.properties'),
                     (Join-Path $sdk 'platforms\android-37.0\android.jar'))) {
    if (-not (Test-Path -LiteralPath $needed)) { throw "BUILD_REQUIREMENT_MISSING=$needed" }
}

$devices = Run-Cli $adb @('devices') -Capture
$deviceMatches = @([regex]::Matches($devices, '(?m)^(\S+)\s+device\s*$'))
if ($deviceMatches.Count -ne 1) { throw 'EXPECTED_EXACTLY_ONE_AUTHORIZED_DEVICE' }
$serial = $deviceMatches[0].Groups[1].Value
function Run-Adb {
    param([string[]]$Commands)
    Run-Cli $adb (@('-s',$serial) + $Commands) -Capture
}
$model = (Run-Adb @('shell','getprop','ro.product.model')).Trim()
$api = (Run-Adb @('shell','getprop','ro.build.version.sdk')).Trim()
$abis = (Run-Adb @('shell','getprop','ro.product.cpu.abilist')).Trim()
if ($model -ne 'CMR-W09' -or $api -ne '28' -or
    $abis -notmatch '(^|,)arm64-v8a(,|$)') {
    throw 'WRONG_TABLET_OR_ARCHITECTURE'
}
Write-Output 'HUAWEI_CMR_W09=PASS'

$oldJava = $env:JAVA_HOME
$oldAndroid = $env:ANDROID_HOME
$oldNdk = $env:NDK_HOME
$oldCI = $env:CI
Push-Location -LiteralPath $root
try {
    $env:JAVA_HOME = $javaHome
    $env:ANDROID_HOME = $sdk
    $env:NDK_HOME = $ndk
    $env:CI = 'true'
    Write-Output 'NPM_CI=START'
    Run-Cli $npm @('ci','--no-audit','--no-fund') | Out-Host
    Write-Output 'NPM_CI=PASS'
    Write-Output 'DEBUG_APK_BUILD=START'
    Run-Cli $npm @('run','tauri','--','android','build','--debug','--apk','--ci','--target','aarch64') | Out-Host
    Write-Output 'DEBUG_APK_BUILD=PASS'
} finally {
    Pop-Location
    $env:JAVA_HOME = $oldJava
    $env:ANDROID_HOME = $oldAndroid
    $env:NDK_HOME = $oldNdk
    $env:CI = $oldCI
}

$changes = @( (Run-Cli $git @('-C',$root,'status','--porcelain') -Capture) -split '\r?\n' |
    Where-Object { $_.Length -gt 0 })
$allowed = @(' M src-tauri/gen/android/app/build.gradle.kts',
             ' M src-tauri/gen/android/gradlew')
foreach ($change in $changes) {
    if ($allowed -cnotcontains $change.TrimEnd()) {
        throw "UNEXPECTED_BUILD_SOURCE_CHANGE=$change"
    }
}
Write-Output 'BUILD_SOURCE_GATE=PASS'
$apk = Join-Path $root 'src-tauri\gen\android\app\build\outputs\apk\universal\debug\app-universal-debug.apk'
if (-not (Test-Path -LiteralPath $apk -PathType Leaf)) { throw 'APK_NOT_FOUND' }
$hash = (Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash
Write-Output "BUILT_APK_SHA256=$hash"

$aapt = @(Get-ChildItem -LiteralPath (Join-Path $sdk 'build-tools') -Filter aapt.exe -File -Recurse |
    Sort-Object FullName -Descending | Select-Object -First 1)
if ($aapt.Count -ne 1) { throw 'AAPT_NOT_FOUND' }
$badging = Run-Cli $aapt[0].FullName @('dump','badging',$apk) -Capture
if ($badging -notmatch "(?m)^package: name='org\.appsandgames\.datelottogenerator\.levelplaypilot'" -or
    $badging -notmatch "(?m)^application-label:'Date Lotto - LP TEST'" -or
    $badging -notmatch 'application-debuggable') { throw 'APK_DEBUG_IDENTITY_FAILED' }

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($apk)
$probeIncluded = $false
$sdkPresent = $false
try {
    foreach ($entry in $zip.Entries) {
        if ($entry.FullName -notmatch '^classes\d*\.dex$') { continue }
        if ($entry.Length -gt 67108864) { throw 'DEX_INSPECTION_SIZE_LIMIT' }
        $stream = $entry.Open()
        $mem = New-Object System.IO.MemoryStream
        try {
            $stream.CopyTo($mem)
            $dexString = [System.Text.Encoding]::ASCII.GetString($mem.ToArray())
            if ($dexString.Contains('HOST_PROBE=TABLET_PANEL_ATTACHED_NO_ADS')) {
                $probeIncluded = $true
            }
            if ($dexString.Contains('Lcom/unity3d/mediation/') -or
                $dexString.Contains('Lcom/ironsource/mediationsdk/') -or
                $dexString.Contains('Lcom/ironsource/adquality/')) {
                $sdkPresent = $true
            }
        } finally {
            $mem.Dispose()
            $stream.Dispose()
        }
    }
} finally {
    $zip.Dispose()
}
if (-not $probeIncluded -or $sdkPresent) {
    throw 'APK_COMPILED_DEBUG_PROBE_OR_SDK_GATE_FAILED'
}
Write-Output 'APK_IDENTITY_AND_NO_AD_GATES=PASS'

$before = Run-Adb @('shell','pm','list','packages')
$prodBefore = @($before -split '\r?\n' |
    Where-Object { $_.Trim() -eq "package:$prodPkg" }).Count -eq 1
New-Item -ItemType Directory -Path $report | Out-Null

Write-Output 'HUAWEI_INSTALL=START'
$install = Run-Adb @('install','-r',$apk)
if ($install -notmatch '(?m)^Success\s*$') { throw "INSTALL_FAILED=$install" }
Write-Output 'HUAWEI_INSTALL=PASS'

$component = "$testPkg/org.appsandgames.datelottogenerator.MainActivity"
$launch = Run-Adb @('shell','am','start','-S','-W','-n',$component,'--ez',$extra,'true')
if ($launch -notmatch 'Status:\s*ok') { throw "LAUNCH_FAILED=$launch" }
Start-Sleep -Seconds 6

$logs = Run-Adb @('logcat','-d','-v','brief','-t','2000',
                  '-s','DateLottoNativeHost:V','*:S')
$logPath = Join-Path $report 'Tablet-Host-Log.txt'
[System.IO.File]::WriteAllText($logPath,$logs,(New-Object System.Text.UTF8Encoding($false)))

$remote = "/sdcard/Download/DateLotto-TabletV8-$tag.png"
$screenshot = Join-Path $report 'Tablet-RightPanel.png'
$null = Run-Adb @('shell','screencap','-p',$remote)
$null = Run-Adb @('pull',$remote,$screenshot)
$null = Run-Adb @('shell','rm',$remote)
if (-not (Test-Path -LiteralPath $screenshot)) { throw 'SCREENSHOT_MISSING' }

$after = Run-Adb @('shell','pm','list','packages')
$prodAfter = @($after -split '\r?\n' |
    Where-Object { $_.Trim() -eq "package:$prodPkg" }).Count -eq 1
if ($prodAfter -ne $prodBefore) { throw 'PRODUCTION_PACKAGE_STATE_CHANGED' }

Write-Output ''
Write-Output '=== HUAWEI TABLET PANEL V8 RESULT ==='
Write-Output "TABLET_PANEL_ATTACHED=$($logs -match 'HOST_PROBE=TABLET_PANEL_ATTACHED_NO_ADS')"
Write-Output "TABLET_PANEL_NOT_READY=$($logs -match 'HOST_PROBE=TABLET_PANEL_NOT_READY_NO_ADS')"
Write-Output "UNEXPECTED_NATIVE_OVERLAY=$($logs -match 'HOST_PROBE=ATTACHED_NO_ADS')"
Write-Output 'PRODUCTION_PACKAGE_STATE=UNCHANGED'
Write-Output "APK_SHA256=$hash"
Write-Output "REPORT_DIRECTORY=$report"
$logs -split '\r?\n' | Where-Object { $_ -match 'HOST_PROBE=' } |
    Select-Object -Last 10 | ForEach-Object { Write-Output $_ }
Write-Output 'REAL_ADS=OFF; PRODUCTION_NO_GO=TRUE'
Write-Output '=== V8 COMPLETE ==='
