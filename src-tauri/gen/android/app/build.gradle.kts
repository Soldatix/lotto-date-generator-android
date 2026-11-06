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
if (levelPlaySdkPilot && gradle.startParameter.taskNames.any {
        it.contains("release", ignoreCase = true) || it.contains("publish", ignoreCase = true)
    }) {
    throw GradleException("LEVELPLAY_PRODUCTION_NO_GO: release and publish tasks forbidden for SDK pilot")
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
