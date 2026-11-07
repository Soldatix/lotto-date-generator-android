import java.util.Properties
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("rust")
}

val tauriProperties = Properties().apply {
    val propFile = file("tauri.properties")
    if (propFile.exists()) {
        propFile.inputStream().use { load(it) }
    }
}

// LEVELPLAY PILOT: SDK is NOT in ordinary builds. It is only resolved when
// the developer explicitly builds a disposable DEBUG SDK test with
// -PappsGamesLevelPlaySdkPilot=true. Never enable for a release artifact.
// The SDK includes AdQuality; merely installing the dependency may change
// startup privacy behavior. No app key or ad unit ID belongs in this file.
val levelPlaySdkPilot = providers.gradleProperty("appsGamesLevelPlaySdkPilot")
    .orNull?.equals("true", ignoreCase = true) == true

// N7 isolated Google UMP form preview. Excludes LevelPlay/AdQuality entirely.
// Build-only explicit opt-in; never included in the ordinary or release APK.
val n7UmpPreview = providers.gradleProperty("appsGamesN7UmpPreview")
    .orNull?.equals("true", ignoreCase = true) == true
if (n7UmpPreview && levelPlaySdkPilot) {
    throw GradleException("N7_UMP_ONLY: LevelPlay cannot run before consent")
}
if (n7UmpPreview && gradle.startParameter.taskNames.any {
        it.contains("release", ignoreCase = true) ||
        it.contains("publish", ignoreCase = true) ||
        it.contains("bundle", ignoreCase = true)
    }) {
    throw GradleException("N7_PRODUCTION_NO_GO: preview is debug-only")
}
val n7AdMobAppId = if (n7UmpPreview)
    providers.environmentVariable("APPSGAMES_N7_ADMOB_APP_ID").orNull?.trim().orEmpty()
    else ""
if (n7UmpPreview &&
    !Regex("""ca-app-pub-\d{16}~\d{10}""").matches(n7AdMobAppId)) {
    throw GradleException("N7_PRIVATE_ADMOB_APP_ID_REQUIRED")
}
if (levelPlaySdkPilot && gradle.startParameter.taskNames.any {
        it.contains("release", ignoreCase = true) || it.contains("publish", ignoreCase = true)
    }) {
    throw GradleException("LEVELPLAY_PRODUCTION_NO_GO: release and publish tasks forbidden for SDK pilot")
}

// N9 REVIEW ONLY: separately opted-in combined UMP + LevelPlay debug classpath.
// Never merges with N7 consent-only or the original SDK-only draft flag.
// It does not initialize the LevelPlay SDK, load an ad or mount a banner.
val n9ReviewOnly = providers.gradleProperty("appsGamesN9ConsentBannerReview")
    .orNull?.equals("true", ignoreCase = true) == true
if (n9ReviewOnly && (n7UmpPreview || levelPlaySdkPilot)) {
    throw GradleException("N9_SEPARATE_DEBUG_REVIEW_REQUIRED")
}
if (n9ReviewOnly && gradle.startParameter.taskNames.any {
        it.contains("release", ignoreCase = true) ||
        it.contains("publish", ignoreCase = true) ||
        it.contains("bundle", ignoreCase = true)
    }) {
    throw GradleException("N9_PRODUCTION_NO_GO: review-only SDK cannot ship")
}
val n9AdMobAppId = if (n9ReviewOnly)
    providers.environmentVariable("APPSGAMES_N7_ADMOB_APP_ID").orNull?.trim().orEmpty()
    else ""
if (n9ReviewOnly &&
    !Regex("""ca-app-pub-\d{16}~\d{10}""").matches(n9AdMobAppId)) {
    throw GradleException("N9_PRIVATE_ADMOB_APP_ID_REQUIRED")
}

// N12 real-banner code is separate from the old N9 compile-only bridge.
// The new Activity exists only in a specially opted-in DEBUG APK. No build
// ever enables ad requests just because N12 sources are compiled.
val n12BannerPilot = providers.gradleProperty("appsGamesN12LottoBannerPilot")
    .orNull?.equals("true", ignoreCase = true) == true
if (n12BannerPilot && (n7UmpPreview || levelPlaySdkPilot || n9ReviewOnly)) {
    throw GradleException("N12_SEPARATE_ISOLATED_DEBUG_ONLY")
}
if (n12BannerPilot && gradle.startParameter.taskNames.any {
        it.contains("release", ignoreCase = true) ||
        it.contains("publish", ignoreCase = true) ||
        it.contains("bundle", ignoreCase = true)
    }) {
    throw GradleException("N12_PRODUCTION_NO_GO: no release or bundles")
}
val n12AdMobAppId = if (n12BannerPilot)
    providers.environmentVariable("APPSGAMES_N7_ADMOB_APP_ID").orNull?.trim().orEmpty()
    else ""
if (n12BannerPilot &&
    !Regex("""ca-app-pub-\d{16}~\d{10}""").matches(n12AdMobAppId)) {
    throw GradleException("N12_PRIVATE_ADMOB_APP_ID_REQUIRED")
}
val n12AppKey = if (n12BannerPilot)
    providers.environmentVariable("APPSGAMES_N12_LEVELPLAY_APP_KEY").orNull?.trim().orEmpty()
    else ""
val n12BannerUnitId = if (n12BannerPilot)
    providers.environmentVariable("APPSGAMES_N12_LEVELPLAY_BANNER_UNIT_ID").orNull?.trim().orEmpty()
    else ""
val n12ApprovedTest = n12BannerPilot &&
    providers.environmentVariable("APPSGAMES_N12_OWNER_TEST_APPROVAL").orNull ==
        "ENABLE_N12_HUAWEI_ONE_TEST_BANNER"
if (n12BannerPilot &&
    ((n12AppKey.isNotEmpty() && !Regex("""[A-Za-z0-9_-]{6,128}""").matches(n12AppKey)) ||
     (n12BannerUnitId.isNotEmpty() &&
        !Regex("""[A-Za-z0-9_-]{6,128}""").matches(n12BannerUnitId)))) {
    throw GradleException("N12_LEVELPLAY_CREDENTIAL_FORMAT_INVALID")
}
if (n12ApprovedTest && (n12AppKey.isBlank() || n12BannerUnitId.isBlank())) {
    throw GradleException("N12_TEST_APPROVAL_REQUIRES_APP_KEY_AND_BANNER_UNIT")
}

// DATE_LOTTO_RELEASE_SIGNING
val keystorePropertiesFile =
    rootProject.file("keystore.properties")

val keystoreProperties =
    Properties().apply {
        if (keystorePropertiesFile.exists()) {
            keystorePropertiesFile.inputStream().use {
                load(it)
            }
        }
    }

android {
    compileSdk = 37
    namespace = "org.appsandgames.datelottogenerator"
    defaultConfig {
        manifestPlaceholders["usesCleartextTraffic"] = "false"
        applicationId = "org.appsandgames.datelottogenerator"
        minSdk = 24
        targetSdk = 37
        versionCode = tauriProperties.getProperty("tauri.android.versionCode", "1").toInt()
        versionName = tauriProperties.getProperty("tauri.android.versionName", "1.0")
    }
    signingConfigs {
        if (keystorePropertiesFile.exists()) {
            create("release") {
                keyAlias =
                    keystoreProperties.getProperty("keyAlias")

                keyPassword =
                    keystoreProperties.getProperty("password")

                storeFile =
                    file(
                        keystoreProperties.getProperty("storeFile")
                    )

                storePassword =
                    keystoreProperties.getProperty("password")
            }
        }
    }

    buildTypes {
        getByName("debug") {
            // Tauri debugApplicationIdSuffix in tauri.conf.json is the source
            // of truth. Explicit matching suffix protects direct Studio builds.
            // Never modify defaultConfig.applicationId or release identity.
            applicationIdSuffix = ".levelplaypilot"
            versionNameSuffix = "-LevelPlayTest"
            manifestPlaceholders["usesCleartextTraffic"] = "true"
            isDebuggable = true
            isJniDebuggable = true
            isMinifyEnabled = false
            packaging {
                jniLibs.keepDebugSymbols.add("*/arm64-v8a/*.so")
                jniLibs.keepDebugSymbols.add("*/armeabi-v7a/*.so")
                jniLibs.keepDebugSymbols.add("*/x86/*.so")
                jniLibs.keepDebugSymbols.add("*/x86_64/*.so")
            }
        }
        getByName("release") {
            if (signingConfigs.names.contains("release")) {
                signingConfig =
                    signingConfigs.getByName("release")
            }

            optimization {
               enable = true
            }
            proguardFiles(
                *fileTree(".") {
                  include("**/*.pro")
                  exclude("build/**")
                }.files.toTypedArray()
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
    buildFeatures {
        buildConfig = true
    }
    // This Kotlin file set references the Unity SDK; it must not be compiled
    // into normal Android, Windows, or release builds.
    if (levelPlaySdkPilot) {
        sourceSets.getByName("main").java.srcDir("src/levelplayPilot/java")
    }
    if (n7UmpPreview) {
        sourceSets.getByName("main").java.srcDir("src/n7ConsentPilot/java")
        sourceSets.getByName("debug").manifest.srcFile("src/n7ConsentPilot/AndroidManifest.xml")
        buildTypes.getByName("debug").manifestPlaceholders["appsGamesN7AdMobAppId"] = n7AdMobAppId
    }
    if (n12BannerPilot) {
        sourceSets.getByName("debug").java.srcDir("src/n12BannerPilot/java")
        sourceSets.getByName("debug").manifest.srcFile("src/n12BannerPilot/AndroidManifest.xml")
        buildTypes.getByName("debug").manifestPlaceholders["appsGamesN12AdMobAppId"] =
            n12AdMobAppId
        buildTypes.getByName("debug").buildConfigField(
            "boolean", "N12_OWNER_TEST_AD_REQUESTS_APPROVED", n12ApprovedTest.toString()
        )
        buildTypes.getByName("debug").buildConfigField(
            "String", "N12_APP_KEY", "\"$n12AppKey\""
        )
        buildTypes.getByName("debug").buildConfigField(
            "String", "N12_BANNER_UNIT_ID", "\"$n12BannerUnitId\""
        )
    }
    if (n9ReviewOnly) {
        // Both sources exist ONLY in the isolated review DEBUG APK.
        // MainActivity remains untouched, and no SDK class is instantiated.
        sourceSets.getByName("debug").java.srcDir("src/levelplayPilot/java")
        sourceSets.getByName("debug").java.srcDir("src/n7ConsentPilot/java")
        sourceSets.getByName("debug").manifest.srcFile("src/n7ConsentPilot/AndroidManifest.xml")
        buildTypes.getByName("debug").manifestPlaceholders["appsGamesN7AdMobAppId"] = n9AdMobAppId
    }
}

kotlin {
    compilerOptions {
        jvmTarget = JvmTarget.JVM_1_8
    }
}

rust {
    rootDirRel = "../../../"
}

dependencies {
    // Test-build opt-in, version pinned to Unity's documented Android SDK.
    if (levelPlaySdkPilot) {
        implementation("com.unity3d.ads-mediation:mediation-sdk:9.5.0")
        // N6: UMP resolves ONLY in disposable opt-in LevelPlay debug source.
        // Normal Android, release and Windows builds remain UMP-free.
        implementation("com.google.android.ump:user-messaging-platform:4.0.0")
    }
    if (n7UmpPreview) {
        // Consent-only debug activity; deliberately no LevelPlay dependency.
        implementation("com.google.android.ump:user-messaging-platform:4.0.0")
    }
    if (n12BannerPilot) {
        implementation("com.google.android.ump:user-messaging-platform:4.0.0")
        implementation("com.unity3d.ads-mediation:mediation-sdk:9.5.0")
    }
    if (n9ReviewOnly) {
        // Linkage/consent review ONLY; never install or start without separate
        // preflight approval (SDK/AdQuality may have startup side effects).
        implementation("com.google.android.ump:user-messaging-platform:4.0.0")
        implementation("com.unity3d.ads-mediation:mediation-sdk:9.5.0")
    }
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.lifecycle:lifecycle-process:2.10.0")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.4")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.0")
}

apply(from = file("tauri.build.gradle.kts"))
