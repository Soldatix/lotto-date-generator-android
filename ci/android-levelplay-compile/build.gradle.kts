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
    testImplementation("junit:junit:4.13.2")
}
