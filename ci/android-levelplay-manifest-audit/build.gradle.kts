// Android manifest merger ONLY. CI invokes processDebugMainManifest, never
// assemble, package, install, init SDK, create ads or make ad requests.
// Copies the actual project's main + n7ConsentPilot AndroidManifest.xml into
// this throwaway project at CI runtime. No real AdMob/Unity identifiers.
// Audit targetSdk/compileSdk 36 because CI Android 37 is unavailable: the
// real Tauri target/compileSdk 37 MUST be audited separately before install.
plugins {
    id("com.android.application") version "9.3.1"
}

val n11WithLevelPlay = providers.gradleProperty("n11WithLevelPlay").orNull == "true"

android {
    namespace = "org.appsandgames.datelottogenerator"
    compileSdk = 36

    defaultConfig {
        applicationId = "org.appsandgames.datelottogenerator"
        minSdk = 24
        targetSdk = 36
        manifestPlaceholders["usesCleartextTraffic"] = "false"
    }

    buildTypes {
        getByName("debug") {
            applicationIdSuffix = ".levelplaypilot"
            isDebuggable = true
            manifestPlaceholders["usesCleartextTraffic"] = "true"
            // Unusable sentinel; manifest merging only. Never compile/install.
            manifestPlaceholders["appsGamesN7AdMobAppId"] = "N11_AUDIT_NO_REAL_ADMOB_ID"
        }
    }
}

dependencies {
    implementation("com.google.android.ump:user-messaging-platform:4.0.0")
    if (n11WithLevelPlay) {
        implementation("com.unity3d.ads-mediation:mediation-sdk:9.5.0")
    }
}
