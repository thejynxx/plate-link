const { withAppBuildGradle } = require("@expo/config-plugins")

/**
 * Expo Config Plugin to inject release signing configuration into android/app/build.gradle.
 * Survives `expo prebuild --clean`.
 * Reads signing credentials from Gradle properties (~/.gradle/gradle.properties):
 *   - PLATELINK_UPLOAD_STORE_FILE
 *   - PLATELINK_UPLOAD_STORE_PASSWORD
 *   - PLATELINK_UPLOAD_KEY_ALIAS
 *   - PLATELINK_UPLOAD_KEY_PASSWORD
 *
 * Falls back to debug signing with a clear warning if the properties are missing.
 */
function withReleaseSigning(config) {
  return withAppBuildGradle(config, (modConfig) => {
    let contents = modConfig.modResults.contents

    // Avoid double injection
    if (contents.includes("PLATELINK_UPLOAD_STORE_FILE")) {
      return modConfig
    }

    const releaseSigningConfig = `        release {
            if (project.hasProperty('PLATELINK_UPLOAD_STORE_FILE') &&
                project.hasProperty('PLATELINK_UPLOAD_STORE_PASSWORD') &&
                project.hasProperty('PLATELINK_UPLOAD_KEY_ALIAS') &&
                project.hasProperty('PLATELINK_UPLOAD_KEY_PASSWORD')) {
                storeFile file(PLATELINK_UPLOAD_STORE_FILE)
                storePassword PLATELINK_UPLOAD_STORE_PASSWORD
                keyAlias PLATELINK_UPLOAD_KEY_ALIAS
                keyPassword PLATELINK_UPLOAD_KEY_PASSWORD
            } else {
                println "[withReleaseSigning] WARNING: PLATELINK_UPLOAD_* credentials missing in gradle.properties. Falling back to debug signing for release build."
                storeFile file('debug.keystore')
                storePassword 'android'
                keyAlias 'androiddebugkey'
                keyPassword 'android'
            }
        }`

    // 1. Inject release signing config block inside signingConfigs { ... }
    contents = contents.replace(
      /signingConfigs\s*\{([\s\S]*?)\n    \}/,
      (match, inner) => `signingConfigs {${inner}\n${releaseSigningConfig}\n    }`
    )

    // 2. Set release build type to use signingConfigs.release
    contents = contents.replace(
      /buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?signingConfig\s+signingConfigs\.debug/,
      (match) => match.replace("signingConfigs.debug", "signingConfigs.release")
    )

    modConfig.modResults.contents = contents
    return modConfig
  })
}

module.exports = withReleaseSigning
