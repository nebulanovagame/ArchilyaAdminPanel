# ANDROID NATIVE KNOWLEDGE BASE

## OVERVIEW
`android/` is the native Android project used by Expo run/build flows. It contains both real Gradle/source files and a large amount of generated build noise.

## STRUCTURE
```text
android/
├── build.gradle        # root Gradle config
├── settings.gradle     # module wiring
├── gradle.properties   # Gradle flags
├── gradlew*            # wrapper scripts
├── app/build.gradle    # app module config
├── app/src/            # manifest + native source/resources
└── app/.cxx/, build/   # generated output; ignore for source work
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Package/build config | `app/build.gradle` | App module settings |
| Root build behavior | `build.gradle`, `settings.gradle`, `gradle.properties` | Shared Gradle configuration |
| Manifest/native resources | `app/src/` | Android source tree |
| Wrapper / local runs | `gradlew`, `gradlew.bat` | Native Gradle entrypoints |
| Expo/EAS relationship | root `eas.json` + this folder | Preview builds output APKs |

## CONVENTIONS
- Treat Gradle files and `app/src/` as source; treat `.cxx/`, `build/`, and log files as generated output.
- Use Expo/EAS as the primary build orchestration layer; touch native files only when the mobile feature truly requires it.
- Keep native changes minimal and explicit because most app logic lives outside this folder.

## ANTI-PATTERNS
- Do not inspect or document `app/.cxx/` as if it were authored code.
- Do not commit more generated logs or build artifacts from native runs.
- Do not assume preview APKs in the repo root are release source; they are outputs.

## NOTES
- `android/` currently includes generated folders (`.gradle`, `.kotlin`, `app/.cxx`, `build`) that heavily skew file-count metrics.
- `local.properties` is machine-specific and should stay contributor-local.
- `debug.keystore` exists under `android/app/`; treat it as development-only material unless release policy says otherwise.
- `android/app/build.gradle` currently points the `release` build type at `signingConfigs.debug`, so native release signing is not production-ready yet.
