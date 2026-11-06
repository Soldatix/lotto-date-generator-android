# N2: Huawei no-build / no-install native-anchor state matrix.
# Only ADB read calls, screenshots and logs; user rotates/scrolls manually.
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$adb=Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
$testPkg='org.appsandgames.datelottogenerator.levelplaypilot'
$prodPkg='org.appsandgames.datelottogenerator'
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
$report=Join-Path $env:USERPROFILE "Downloads\DateLotto-NativeAnchor-N2-$stamp"

function Invoke-ADB {
    param([string[]]$Arguments)
    $psi=New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName=$adb
    $psi.Arguments=(@($Arguments | ForEach-Object {
        if($_ -match '[\s"]') { '"' + $_.Replace('"','\"') + '"' }
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
        $ot=$p.StandardOutput.ReadToEndAsync()
        $et=$p.StandardError.ReadToEndAsync()
        if(-not $p.WaitForExit(60000)) {
            $p.Kill()
            throw 'ADB_TIMEOUT'
        }
        $out=$ot.GetAwaiter().GetResult()
        $err=$et.GetAwaiter().GetResult()
        if($p.ExitCode -ne 0){throw "ADB_EXIT=$($p.ExitCode) $err $out"}
        return $out
    } finally { $p.Dispose() }
}

Write-Output '=== DATE LOTTO N2 NATIVE VIEW LIFECYCLE MATRIX ==='
Write-Output 'NO_BUILD=TRUE; NO_INSTALL=TRUE; REAL_ADS=OFF; PRODUCTION_NO_GO=TRUE'
if(-not (Test-Path -LiteralPath $adb -PathType Leaf)){throw 'ADB_NOT_FOUND'}
$devices=Invoke-ADB @('devices')
$matches=@([regex]::Matches($devices,'(?m)^(\S+)\s+device\s*$'))
if($matches.Count -ne 1){throw 'EXPECTED_ONE_AUTHORIZED_DEVICE'}
$serial=$matches[0].Groups[1].Value
function Device {
    param([string[]]$Arguments)
    Invoke-ADB (@('-s',$serial)+$Arguments)
}
$model=(Device @('shell','getprop','ro.product.model')).Trim()
$api=(Device @('shell','getprop','ro.build.version.sdk')).Trim()
if($model -ne 'CMR-W09' -or $api -ne '28'){throw 'HUAWEI_CMR_W09_EXPECTED'}
$before=Device @('shell','pm','list','packages')
$prodBefore=@($before -split '\r?\n' | Where-Object {
    $_.Trim() -eq "package:$prodPkg"
}).Count -eq 1
$pilotBefore=@($before -split '\r?\n' | Where-Object {
    $_.Trim() -eq "package:$testPkg"
}).Count -eq 1
if(-not $pilotBefore){throw 'PILOT_PACKAGE_NOT_INSTALLED'}
$appPid=(Device @('shell','pidof','-s',$testPkg)).Trim()
if($appPid -notmatch '^\d+$'){throw 'N1_PILOT_MUST_ALREADY_BE_RUNNING'}
$baseline=Device @('logcat','-d','-v','brief',"--pid=$appPid",'-t','3000',
 '-s','DateLottoNativeAnchor:V','DateLottoNativeHost:V','*:S')
if($baseline -notmatch 'NATIVE_ANCHOR=STARTED_NO_ADS'){
    throw 'NATIVE_ANCHOR_NOT_STARTED_IN_CURRENT_PROCESS'
}
Write-Output "HUAWEI_DEVICE=PASS; N1_CURRENT_PID=$appPid"
New-Item -ItemType Directory -Path $report | Out-Null
$rows=New-Object System.Collections.Generic.List[object]

function Snapshot {
    param([string]$Name)
    Start-Sleep -Seconds 2
    $currentPid=(Device @('shell','pidof','-s',$testPkg)).Trim()
    $same=$currentPid -eq $appPid
    $remote="/sdcard/Download/DateLotto-$Name-$stamp.png"
    $local=Join-Path $report "$Name.png"
    $null=Device @('shell','screencap','-p',$remote)
    $null=Device @('pull',$remote,$local)
    $null=Device @('shell','rm',$remote)
    if(-not (Test-Path -LiteralPath $local -PathType Leaf)){
        throw "SCREENSHOT_NOT_FOUND=$Name"
    }
    $logs=''
    if($same){
        $logs=Device @('logcat','-d','-v','time',"--pid=$appPid",'-t','3000',
            '-s','DateLottoNativeAnchor:V','DateLottoNativeHost:V','*:S')
    }
    [System.IO.File]::WriteAllText(
        (Join-Path $report "$Name-log.txt"),
        $logs,
        (New-Object System.Text.UTF8Encoding($false))
    )
    $aligned=@([regex]::Matches($logs,'NATIVE_ANCHOR=ALIGNED_NO_ADS')).Count
    $hidden=@([regex]::Matches($logs,'NATIVE_ANCHOR=HIDDEN_OFFSCREEN_OR_SYSTEM_INSET')).Count
    $rows.Add([pscustomobject]@{
        Stage=$Name;SameProcess=$same;AlignedLogCount=$aligned;
        HiddenLogCount=$hidden;Screenshot=$local
    })
    Write-Output "STATE=$Name; SCREENSHOT=PASS; PROCESS_UNCHANGED=$same; ALIGNED_LOGS=$aligned; HIDDEN_LOGS=$hidden"
}

Write-Output 'STATE 1: Landscape, banner visible, page at top.'
Read-Host 'Press ENTER when ready'
Snapshot '01-landscape-top'
Write-Output 'STATE 2: Rotate Huawei to portrait; keep app open.'
Read-Host 'Press ENTER when ready'
Snapshot '02-portrait'
Write-Output 'STATE 3: Rotate to landscape and scroll until banner exits viewport.'
Read-Host 'Press ENTER when ready'
Snapshot '03-landscape-scrolled'
Write-Output 'STATE 4: Return to date input and open Android keyboard.'
Read-Host 'Press ENTER when keyboard is visible'
Snapshot '04-keyboard-open'
Write-Output 'STATE 5: Close keyboard, press HOME, return to the SAME app.'
Read-Host 'Press ENTER when foreground app is visible'
Snapshot '05-background-return'

$after=Device @('shell','pm','list','packages')
$prodAfter=@($after -split '\r?\n' | Where-Object {
    $_.Trim() -eq "package:$prodPkg"
}).Count -eq 1
if($prodBefore -ne $prodAfter){throw 'PRODUCTION_PACKAGE_STATE_CHANGED'}
$rows | Export-Csv -LiteralPath (Join-Path $report 'N2-stages.csv') -NoTypeInformation -Encoding UTF8
$allSame=@($rows | Where-Object { -not $_.SameProcess }).Count -eq 0
Write-Output ''
Write-Output '=== N2 HUAWEI RESULT ==='
Write-Output "STAGE_SCREENSHOTS=$($rows.Count)"
Write-Output "SAME_APP_PROCESS_ALL_STAGES=$allSame"
Write-Output 'PRODUCTION_PACKAGE_STATE=UNCHANGED'
Write-Output "REPORT_DIRECTORY=$report"
Write-Output 'NO_INSTALL=TRUE; REAL_ADS=OFF; PRODUCTION_NO_GO=TRUE'
Write-Output '=== N2 COMPLETE ==='
