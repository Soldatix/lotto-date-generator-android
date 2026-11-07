# Huawei N1: only after the pinned, SDK-free V8 builder has installed a pilot debug APK.
# Triggers the *second* ADB opt-in; no build, no ad SDK activation, no production change.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$pkg = 'org.appsandgames.datelottogenerator.levelplaypilot'
$prod = 'org.appsandgames.datelottogenerator'
$extra1 = 'org.appsandgames.datelottogenerator.DEBUG_NATIVE_BANNER_PROBE'
$extra2 = 'org.appsandgames.datelottogenerator.DEBUG_NATIVE_ANCHORED_PREVIEW'
$adb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
$sdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$report = Join-Path $env:USERPROFILE "Downloads\DateLotto-NativeAnchor-N1-$stamp"

function Invoke-CmdSafe {
    param([string]$Exe,[string[]]$Arguments,[int]$TimeoutMs=90000)
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName=$Exe
    $psi.Arguments=(@($Arguments | ForEach-Object {
        if ($_ -match '[\s"]') { '"' + $_.Replace('"','\"') + '"' }
        else { $_ }
    }) -join ' ')
    $psi.UseShellExecute=$false
    $psi.CreateNoWindow=$true
    $psi.RedirectStandardOutput=$true
    $psi.RedirectStandardError=$true
    $p=New-Object System.Diagnostics.Process
    $p.StartInfo=$psi
    try {
        [void]$p.Start()
        $outTask=$p.StandardOutput.ReadToEndAsync()
        $errTask=$p.StandardError.ReadToEndAsync()
        if (-not $p.WaitForExit($TimeoutMs)) {
            $p.Kill()
            throw "COMMAND_TIMEOUT=$Exe"
        }
        $stdout=$outTask.GetAwaiter().GetResult()
        $stderr=$errTask.GetAwaiter().GetResult()
        if($p.ExitCode -ne 0) {
            throw "COMMAND_FAILED_EXIT=$($p.ExitCode): $stdout $stderr"
        }
        return $stdout
    } finally {
        $p.Dispose()
    }
}

Write-Output '=== DATE LOTTO HUAWEI NATIVE ANCHOR N1 ==='
Write-Output 'NO_BUILD=TRUE; NO_APK_INSTALL=TRUE'
Write-Output 'REAL_ADS=OFF; SDK_OPT_IN=FALSE'
Write-Output 'PRODUCTION_NO_GO=TRUE; PR_MERGE=NONE'

if ($root -notlike "$env:TEMP\DateLotto-TabletV8-*") {
    throw 'WRONG_OR_NONDISPOSABLE_WORKSPACE'
}
if (-not (Test-Path -LiteralPath $adb)) { throw 'ADB_NOT_FOUND' }
$apk=Join-Path $root 'src-tauri\gen\android\app\build\outputs\apk\universal\debug\app-universal-debug.apk'
if (-not (Test-Path -LiteralPath $apk -PathType Leaf)) {
    throw 'PILOT_APK_MUST_BE_BUILT_AND_INSTALLED_FIRST'
}
$hash=(Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash
$gradle=Get-Content -LiteralPath (Join-Path $root 'src-tauri\gen\android\app\build.gradle.kts') -Raw
$draft=Get-Content -LiteralPath (Join-Path $root 'src-tauri\gen\android\app\src\levelplayPilot\java\org\appsandgames\datelottogenerator\LevelPlaySdkBannerDraft.kt') -Raw
if (-not $gradle.Contains('appsGamesLevelPlaySdkPilot') -or
    -not $draft.Contains('APPROVED_AD_REQUESTS = false')) {
    throw 'SDK_SAFETY_GATES_MISSING'
}

$aapt=@(Get-ChildItem -LiteralPath (Join-Path $sdk 'build-tools') -Filter aapt.exe -File -Recurse |
   Sort-Object FullName -Descending | Select-Object -First 1)
if($aapt.Count -ne 1){ throw 'AAPT_NOT_FOUND' }
$badging=Invoke-CmdSafe $aapt[0].FullName @('dump','badging',$apk)
if($badging -notmatch "(?m)^package: name='org\.appsandgames\.datelottogenerator\.levelplaypilot'" -or
   $badging -notmatch "(?m)^application-label:'Date Lotto - LP TEST'" -or
   $badging -notmatch 'application-debuggable') { throw 'APK_DEBUG_IDENTITY_MISMATCH' }

# Do not proceed unless the compiled native anchor class really exists.
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive=[System.IO.Compression.ZipFile]::OpenRead($apk)
$found=$false
try {
    foreach($entry in $archive.Entries) {
        if($entry.FullName -notmatch '^classes\d*\.dex$') { continue }
        if($entry.Length -gt 67108864) { throw 'DEX_INSPECTION_LIMIT' }
        $s=$entry.Open()
        $ms=New-Object System.IO.MemoryStream
        try {
            $s.CopyTo($ms)
            $txt=[System.Text.Encoding]::ASCII.GetString($ms.ToArray())
            if($txt.Contains('NATIVE_ANCHOR=ALIGNED_NO_ADS') -and
               $txt.Contains('DEBUG_NATIVE_ANCHORED_PREVIEW')) { $found=$true }
        } finally { $ms.Dispose();$s.Dispose() }
    }
} finally { $archive.Dispose() }
if(-not $found){ throw 'NEW_NATIVE_ANCHOR_NOT_COMPILED_IN_APK' }
Write-Output 'PILOT_APK_AND_NATIVE_ANCHOR=PASS'

$deviceText=Invoke-CmdSafe $adb @('devices')
$matches=@([regex]::Matches($deviceText,'(?m)^(\S+)\s+device\s*$'))
if($matches.Count -ne 1){throw 'EXPECTED_ONE_AUTHORIZED_DEVICE'}
$serial=$matches[0].Groups[1].Value
function Run-Adb {
    param([string[]]$Arguments)
    Invoke-CmdSafe $adb (@('-s',$serial) + $Arguments)
}
$model=(Run-Adb @('shell','getprop','ro.product.model')).Trim()
$api=(Run-Adb @('shell','getprop','ro.build.version.sdk')).Trim()
if($model -ne 'CMR-W09' -or $api -ne '28'){throw 'EXPECTED_HUAWEI_CMR_W09_ANDROID_9'}
$before=Run-Adb @('shell','pm','list','packages')
$prodBefore=@($before -split '\r?\n' | Where-Object {$_.Trim() -eq "package:$prod"}).Count -eq 1
$pilotBefore=@($before -split '\r?\n' | Where-Object {$_.Trim() -eq "package:$pkg"}).Count -eq 1
if(-not $pilotBefore){throw 'PILOT_NOT_INSTALLED'}
Write-Output 'HUAWEI_AND_PILOT_INSTALL=PASS'

$component="$pkg/org.appsandgames.datelottogenerator.MainActivity"
$launch=Run-Adb @('shell','am','start','-S','-W','-n',$component,
     '--ez',$extra1,'true','--ez',$extra2,'true')
if($launch -notmatch 'Status:\s*ok'){throw "EXPLICIT_NATIVE_ANCHOR_LAUNCH_FAILED=$launch"}
Start-Sleep -Seconds 6
$pidText=(Run-Adb @('shell','pidof','-s',$pkg)).Trim()
if($pidText -notmatch '^\d+$'){throw 'PILOT_NOT_RUNNING'}
New-Item -ItemType Directory -Path $report | Out-Null
$log=Run-Adb @('logcat','-d','-v','brief',"--pid=$pidText",'-t','2500',
    '-s','DateLottoNativeAnchor:V','DateLottoNativeHost:V','*:S')
[System.IO.File]::WriteAllText((Join-Path $report 'NativeAnchor-N1-Log.txt'),
    $log,(New-Object System.Text.UTF8Encoding($false)))
$remote="/sdcard/Download/DateLotto-NativeAnchor-$stamp.png"
$screen=Join-Path $report 'N1-Native-Overlay.png'
$null=Run-Adb @('shell','screencap','-p',$remote)
$null=Run-Adb @('pull',$remote,$screen)
$null=Run-Adb @('shell','rm',$remote)
if(-not (Test-Path -LiteralPath $screen)){throw 'SCREENSHOT_MISSING'}

$after=Run-Adb @('shell','pm','list','packages')
$prodAfter=@($after -split '\r?\n' | Where-Object {$_.Trim() -eq "package:$prod"}).Count -eq 1
if($prodBefore -ne $prodAfter){throw 'PRODUCTION_PACKAGE_STATE_CHANGED'}

Write-Output ''
Write-Output '=== HUAWEI NATIVE ANCHOR N1 RESULT ==='
Write-Output 'NO_NEW_INSTALL=TRUE'
Write-Output 'TEST_APP_RUNNING=TRUE'
Write-Output "HTML_SLOT_ATTACHED=$($log -match 'HOST_PROBE=TABLET_PANEL_ATTACHED_NO_ADS')"
Write-Output "NATIVE_ANCHOR_STARTED=$($log -match 'NATIVE_ANCHOR=STARTED_NO_ADS')"
Write-Output "NATIVE_ANCHOR_ALIGNED=$($log -match 'NATIVE_ANCHOR=ALIGNED_NO_ADS')"
Write-Output "NATIVE_ANCHOR_HIDDEN=$($log -match 'NATIVE_ANCHOR=HIDDEN_OFFSCREEN_OR_SYSTEM_INSET')"
Write-Output 'PRODUCTION_PACKAGE_STATE=UNCHANGED'
Write-Output "APK_SHA256=$hash"
Write-Output "REPORT_DIRECTORY=$report"
$log -split '\r?\n' | Where-Object {$_ -match 'HOST_PROBE=|NATIVE_ANCHOR='} |
   Select-Object -Last 15 | ForEach-Object {Write-Output $_}
Write-Output 'REAL_ADS=OFF; PRODUCTION_NO_GO=TRUE'
Write-Output '=== N1 COMPLETE ==='
