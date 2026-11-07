// N11 throwaway manifest-merger audit. No APK, application source, SDK init
// or network ad requests are built or executed by this project.
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "date-lotto-n11-manifest-audit"
