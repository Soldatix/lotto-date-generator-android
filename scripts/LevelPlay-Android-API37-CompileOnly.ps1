# Date Lotto Generator / Unity LevelPlay / Windows API 37 verification
# ISOLATED AND NON-DISTRIBUTABLE: compiles two Kotlin source files against
# Unity LevelPlay SDK in a temporary Android LIBRARY project only.
# Does not assemble, install, sign or run any APK/AAB. No ads are requested.
# Gradle may download build dependencies to its normal user Gradle cache.
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$expectedBranch = 'pilot/levelplay-android-banner-2026-11-04'
$repo = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path

Write-Output '=== LEVELPLAY ANDROID API37 ISOLATED KOTLIN COMPILE ==='
Write-Output 'PRODUCTION_NO_GO=TRUE; NO_APP_BUILD=TRUE; APK=NONE; NO_DEVICE_INSTALL=TRUE; ADS=OFF'
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'GIT_NOT_FOUND' }
$actualBranch = (& git -C $repo branch --show-current).Trim()
if ($LASTEXITCODE -ne 0 -or $actualBranch -ne $expectedBranch) {
    throw 'UNEXPECTED_GIT_BRANCH'
}
$dirty = @(& git -C $repo status --porcelain)
if ($LASTEXITCODE -ne 0 -or $dirty.Count -ne 0) {
    throw 'WORKTREE_NOT_CLEAN'
}
Write-Output 'PILOT_BRANCH=PASS; WORKTREE_CLEAN=PASS'

$gradle = Join-Path $repo 'src-tauri\gen\android\app\build.gradle.kts'
$pilot = Join-Path $repo 'src-tauri\gen\android\app\src\levelplayPilot\java\org\appsandgames\datelottogenerator\LevelPlaySdkBannerDraft.kt'
# PowerShell's automatic $Host variable is read-only; use a unique name.
$bannerHostFile = Join-Path $repo 'src-tauri\gen\android\app\src\main\java\org\appsandgames\datelottogenerator\LevelPlayBannerHost.kt'
$harness = Join-Path $repo 'ci\android-levelplay-compile'
$wrapper = Join-Path $repo 'src-tauri\gen\android\gradlew.bat'
foreach ($file in @($gradle, $pilot, $bannerHostFile, $wrapper,
                    (Join-Path $harness 'build.gradle.kts'),
                    (Join-Path $harness 'settings.gradle.kts'),
                    (Join-Path $harness 'gradle.properties'))) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw ('FILE_MISSING=' + $file) }
}
$productionGradle = Get-Content -LiteralPath $gradle -Raw
$pilotCode = Get-Content -LiteralPath $pilot -Raw
if (-not $productionGradle.Contains('appsGamesLevelPlaySdkPilot') -or
    -not $pilotCode.Contains('APPROVED_AD_REQUESTS = false')) {
    throw 'LEVELPLAY_SAFETY_GATES_NOT_PRESENT'
}
if ($pilotCode -match '294760d25|vu3eqmvs1u5vo6wi') {
    throw 'PUBLISHER_ID_UNEXPECTEDLY_IN_SOURCE'
}
Write-Output 'DOUBLE_SAFETY_GATES=PASS'

$sdk = $env:ANDROID_HOME
if (-not $sdk) { $sdk = $env:ANDROID_SDK_ROOT }
if (-not $sdk) { $sdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
$sdk37 = Join-Path $sdk 'platforms\android-37.0\android.jar'
$sdk37Legacy = Join-Path $sdk 'platforms\android-37\android.jar'
if (-not (Test-Path -LiteralPath $sdk37 -PathType Leaf) -and
    -not (Test-Path -LiteralPath $sdk37Legacy -PathType Leaf)) {
    throw 'ANDROID_API_37_JAR_MISSING'
}
Write-Output 'ANDROID_API37_JAR_FOUND=PASS'

$javaRoot = Join-Path $env:ProgramFiles 'Android\Android Studio\jbr'
$java = Join-Path $javaRoot 'bin\java.exe'
if (-not (Test-Path -LiteralPath $java -PathType Leaf)) {
    if ($env:JAVA_HOME -and (Test-Path -LiteralPath (Join-Path $env:JAVA_HOME 'bin\java.exe'))) {
        $javaRoot = $env:JAVA_HOME
    } else {
        throw 'JAVA_JDK_NOT_FOUND'
    }
}
Write-Output ('JAVA_HOME_FOR_THIS_RUN=' + $javaRoot)

# Unique new folder only. Never overwrite or remove an existing directory.
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss-ffff'
$tempRoot = Join-Path $env:TEMP ('DateLotto-LevelPlay-API37-CompileOnly-' + $stamp)
if (Test-Path -LiteralPath $tempRoot) { throw 'TEMP_FOLDER_ALREADY_EXISTS' }
$null = New-Item -ItemType Directory -Path $tempRoot -ErrorAction Stop
foreach ($name in @('settings.gradle.kts', 'gradle.properties', 'build.gradle.kts')) {
    Copy-Item -LiteralPath (Join-Path $harness $name) -Destination (Join-Path $tempRoot $name) -ErrorAction Stop
}
$dest = Join-Path $tempRoot 'src\main\java\org\appsandgames\datelottogenerator'
$null = New-Item -ItemType Directory -Path $dest -Force
Copy-Item -LiteralPath $pilot -Destination (Join-Path $dest 'LevelPlaySdkBannerDraft.kt')
Copy-Item -LiteralPath $bannerHostFile -Destination (Join-Path $dest 'LevelPlayBannerHost.kt')

# The only Gradle edit is a replacement inside the throwaway temp directory.
$copiedGradle = Join-Path $tempRoot 'build.gradle.kts'
$gradleText = Get-Content -LiteralPath $copiedGradle -Raw
if (($gradleText.Split(@('compileSdk = 36'), [System.StringSplitOptions]::None).Count - 1) -ne 1) {
    throw 'COMPILE_SDK_BASELINE_UNEXPECTED'
}
$gradleText = $gradleText.Replace('compileSdk = 36', 'compileSdk = 37')
[System.IO.File]::WriteAllText($copiedGradle, $gradleText, (New-Object System.Text.UTF8Encoding($false)))

Write-Output 'TEMP_ONLY_SOURCE_COPY=PASS; SOURCE_REPO_UNCHANGED=TRUE'
Write-Output 'REQUESTED_COMPILE_SDK=37'
Write-Output 'GRADLE_TASK=compileDebugKotlin'
Write-Output ('TEMP_BUILD_DIRECTORY=' + $tempRoot)

$originalJavaHome = $env:JAVA_HOME
$originalAndroidHome = $env:ANDROID_HOME
try {
    $env:JAVA_HOME = $javaRoot
    $env:ANDROID_HOME = $sdk
    & $wrapper -p $tempRoot --no-daemon --console=plain compileDebugKotlin
    $code = $LASTEXITCODE
    Write-Output ('GRADLE_EXIT_CODE=' + $code)
    if ($code -ne 0) { throw ('API37_GRADLE_COMPILE_FAILED_EXIT=' + $code) }
    Write-Output 'API37_SDK_RESOLUTION=PASS'
    Write-Output 'LEVELPLAY_KOTLIN_COMPILE=PASS'
    Write-Output 'NO_APK_OR_AAB_TASK_INVOKED=TRUE'
} finally {
    $env:JAVA_HOME = $originalJavaHome
    $env:ANDROID_HOME = $originalAndroidHome
}
$after = @(& git -C $repo status --porcelain)
Write-Output ('ORIGINAL_REPO_UNMODIFIED=' + [bool]($after.Count -eq 0))
Write-Output 'NO_AD_REQUESTS=TRUE; PRODUCTION_NO_GO=TRUE'
Write-Output '=== API37 COMPILE CHECK COMPLETE ==='
