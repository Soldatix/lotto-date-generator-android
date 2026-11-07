// Compile the PR's Kotlin draft against the actual LevelPlay AAR.
// Android library artifact only: no APK, ads, SDK initialization or manifest
// from the published Date Lotto Generator is executed here.
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.library") version "9.3.1"
    id("org.jetbrains.kotlin.android") version "2.2.10"
}

android {
    namespace = "org.appsandgames.datelottogenerator"
    compileSdk = 36
    defaultConfig {
        minSdk = 24
    }
    // N12 is compiled ONLY against this disposable library + a local Tauri
    // stub. The only valid CI test authorization is permanently FALSE.
    buildFeatures { buildConfig = true }
    buildTypes.getByName("debug").buildConfigField(
        "boolean", "N12_OWNER_TEST_AD_REQUESTS_APPROVED", "false"
    )
    buildTypes.getByName("debug").buildConfigField("String", "N12_APP_KEY", "\"\"")
    buildTypes.getByName("debug").buildConfigField("String", "N12_BANNER_UNIT_ID", "\"\"")
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    compilerOptions {
        jvmTarget = JvmTarget.JVM_17
    }
}

dependencies {
    implementation("com.unity3d.ads-mediation:mediation-sdk:9.5.0")
    implementation("com.google.android.ump:user-messaging-platform:4.0.0")
    testImplementation("junit:junit:4.13.2")
}
