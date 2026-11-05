# Apps & Games / Date Lotto Generator / Unity LevelPlay
# Non-destructive Windows Android/OPPO toolchain diagnostics only.
# No APK/AAB build, no ad SDK initialization, no device installation.
# adb devices may start the local adb server; it does not install anything.
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$expected = 'pilot/levelplay-android-banner-2026-11-04'

function Get-CommandPath([string]$name) {
    $found = Get-Command -Name $name -ErrorAction SilentlyContinue
    if ($found) { return $found.Source }
    return $null
}

# External programs such as adb and java legitimately write diagnostic
# startup/version messages to STDERR with exit code zero. Windows PowerShell
# 5.1 + ErrorActionPreference=Stop must NOT turn that into NativeCommandError.
function Invoke-NativeInfo([string]$exe, [string]$arguments) {
    $start = New-Object System.Diagnostics.ProcessStartInfo
    $start.FileName = $exe
    $start.Arguments = $arguments
    $start.UseShellExecute = $false
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $start.CreateNoWindow = $true

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $start
    try {
        [void]$process.Start()
        if (-not $process.WaitForExit(15000)) {
            $process.Kill()
            throw "Command timed out: $arguments"
        }
        $stdout = $process.StandardOutput.ReadToEnd()
        $stderr = $process.StandardError.ReadToEnd()
        return [pscustomobject]@{
            ExitCode = $process.ExitCode
            Stdout = $stdout
            Stderr = $stderr
        }
    } finally {
        $process.Dispose()
    }
}

Write-Output '=== LEVELPLAY ANDROID READ-ONLY PREFLIGHT V2 ==='
Write-Output 'NO_ANDROID_BUILD=TRUE; NO_AD_REQUEST=TRUE; NO_APK_INSTALL=TRUE'

$git = Get-CommandPath 'git'
if (-not $git) {
    Write-Output 'GIT=NOT_FOUND'
} else {
    $branch = ((& $git -C $repo branch --show-current) | Select-Object -First 1)
    if ($null -eq $branch) { $branch = '' }
    $branch = $branch.Trim()
    Write-Output ('BRANCH=' + $branch)
    Write-Output ('EXPECTED_PILOT_BRANCH=' + [bool]($branch -eq $expected))
    $dirty = @(& $git -C $repo status --porcelain).Count
    Write-Output ('UNCOMMITTED_FILE_COUNT=' + $dirty)
}

$gradle = Join-Path $repo 'src-tauri\gen\android\app\build.gradle.kts'
$sdkKotlin = Join-Path $repo 'src-tauri\gen\android\app\src\levelplayPilot\java\org\appsandgames\datelottogenerator\LevelPlaySdkBannerDraft.kt'
if (Test-Path -LiteralPath $gradle) {
    $buildContents = Get-Content -LiteralPath $gradle -Raw
    Write-Output ('GRADLE_SDK_OPT_IN_GUARD=' + [bool]($buildContents.Contains('appsGamesLevelPlaySdkPilot')))
} else {
    Write-Output 'GRADLE_FILE=MISSING'
}
if (Test-Path -LiteralPath $sdkKotlin) {
    $kotlinContents = Get-Content -LiteralPath $sdkKotlin -Raw
    Write-Output ('SDK_AD_REQUESTS_HARD_STOP=' + [bool]($kotlinContents.Contains('APPROVED_AD_REQUESTS = false')))
} else {
    Write-Output 'SDK_PILOT_FILE=MISSING'
}

# JAVA_HOME and Android Studio's embedded JBR are valid even when java.exe
# is not available in the PATH of the current PowerShell session.
$java = Get-CommandPath 'java.exe'
if (-not $java -and $env:JAVA_HOME) {
    $possible = Join-Path $env:JAVA_HOME 'bin\java.exe'
    if (Test-Path -LiteralPath $possible) { $java = $possible }
}
if (-not $java) {
    $androidStudioJava = Join-Path $env:ProgramFiles 'Android\Android Studio\jbr\bin\java.exe'
    if (Test-Path -LiteralPath $androidStudioJava) { $java = $androidStudioJava }
}
if (-not $java) {
    foreach ($parent in @(
        (Join-Path $env:ProgramFiles 'Eclipse Adoptium'),
        (Join-Path $env:ProgramFiles 'Java'),
        (Join-Path $env:ProgramFiles 'Microsoft')
    )) {
        if (-not (Test-Path -LiteralPath $parent)) { continue }
        foreach ($folder in @(Get-ChildItem -LiteralPath $parent -Directory -ErrorAction SilentlyContinue)) {
            $possible = Join-Path $folder.FullName 'bin\java.exe'
            if (Test-Path -LiteralPath $possible) {
                $java = $possible
                break
            }
        }
        if ($java) { break }
    }
}
Write-Output ('JAVA_FOUND=' + [bool]($java))
if ($java) {
    Write-Output ('JAVA_EXECUTABLE=' + $java)
    try {
        $result = Invoke-NativeInfo -exe $java -arguments '-version'
        $javaOutput = ($result.Stderr + [Environment]::NewLine + $result.Stdout).Trim()
        $firstLine = ($javaOutput -split '\r?\n' | Select-Object -First 1)
        Write-Output ('JAVA_VERSION=' + $firstLine)
        Write-Output ('JAVA_COMMAND_EXIT_CODE=' + $result.ExitCode)
    } catch {
        Write-Output 'JAVA_VERSION_CHECK=FAILED'
    }
} else {
    Write-Output 'JAVA_HINT=JDK_NOT_FOUND_IN_PATH_OR_COMMON_INSTALL_LOCATIONS'
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

$adb = Get-CommandPath 'adb.exe'
if (-not $adb) {
    $localAdb = Join-Path $sdk 'platform-tools\adb.exe'
    if (Test-Path -LiteralPath $localAdb) { $adb = $localAdb }
}
Write-Output ('ADB_FOUND=' + [bool]($adb))
if ($adb) {
    try {
        $adbResult = Invoke-NativeInfo -exe $adb -arguments 'devices'
        Write-Output ('ADB_EXIT_CODE=' + $adbResult.ExitCode)
        if ($adbResult.ExitCode -eq 0) {
            $lines = @($adbResult.Stdout -split '\r?\n')
            $connected = @($lines | Where-Object { $_ -match '^\S+\s+device(?:\s|$)' }).Count
            $unauthorized = @($lines | Where-Object { $_ -match '^\S+\s+unauthorized(?:\s|$)' }).Count
            $offline = @($lines | Where-Object { $_ -match '^\S+\s+offline(?:\s|$)' }).Count
            Write-Output ('AUTHORIZED_ADB_DEVICE_COUNT=' + $connected)
            Write-Output ('UNAUTHORIZED_ADB_DEVICE_COUNT=' + $unauthorized)
            Write-Output ('OFFLINE_ADB_DEVICE_COUNT=' + $offline)
            if ($connected -eq 0) {
                Write-Output 'ADB_HINT=CONNECT_OPPO_USB_ENABLE_USB_DEBUGGING_AND_APPROVE_PC'
            }
        } else {
            Write-Output 'ADB_HINT=ADB_RETURNED_NONZERO_EXIT_CODE'
        }
    } catch {
        Write-Output 'ADB_CHECK=FAILED_OR_TIMEOUT'
        Write-Output 'ADB_HINT=CHECK_USB_DEBUGGING_AND_RETRY'
    }
}

Write-Output 'ADVERTISING_ID_NOT_READ=TRUE; PRIVATE_IDS_NOT_PRINTED=TRUE'
Write-Output 'NO_SOURCE_CHANGES=TRUE; PRODUCTION_NO_GO=TRUE'
Write-Output '=== END PREFLIGHT ==='
