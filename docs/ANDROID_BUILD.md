# Building the Signed Release Android APK (Local Build)

Plate-Link builds standalone, signed release Android APKs locally without requiring Expo Application Services (EAS) cloud builders or subscriptions.

---

## 1. Generate Your Release Keystore (Outside the Repository)

> [!CAUTION]
> **CRITICAL SECURITY WARNING: Back Up Your Keystore & Passwords**
> Never commit your keystore or passwords to Git. Store your `.jks` file in a secure location outside the repository (e.g. `C:\Users\Anurag\keys\`). Back it up to an encrypted password manager or secure vault. **If you lose this key or its passwords, you will permanently lose the ability to update your application.**

Create a dedicated folder for your keys outside the repository and generate a PKCS12 upload keystore using the Java `keytool` utility:

```powershell
# Create keys directory
mkdir C:\Users\Anurag\keys -ErrorAction SilentlyContinue

# Generate 2048-bit RSA keypair valid for 10,000 days
keytool -genkeypair -v -storetype PKCS12 -keystore C:\Users\Anurag\keys\platelink-upload.jks -alias platelink -keyalg RSA -keysize 2048 -validity 10000
```

You will be prompted to enter a password and basic certificate details (name, organization, city). Remember the password you set.

---

## 2. Configure Gradle Credentials

Add your signing credentials to your user-level Gradle configuration at `C:\Users\Anurag\.gradle\gradle.properties`. This keeps credentials on your local machine and prevents them from ever touching source control:

```properties
PLATELINK_UPLOAD_STORE_FILE=C:/Users/Anurag/keys/platelink-upload.jks
PLATELINK_UPLOAD_STORE_PASSWORD=your_keystore_password_here
PLATELINK_UPLOAD_KEY_ALIAS=platelink
PLATELINK_UPLOAD_KEY_PASSWORD=your_key_password_here
```

> [!NOTE]
> If these properties are missing, the Expo build plugin (`plugins/withReleaseSigning.js`) will automatically fall back to debug signing with a warning.

---

## 3. Verify Production Environment Variables

The release APK embeds production API endpoints:
- `apps/mobile/.env.production` (gitignored) should contain:
  ```env
  EXPO_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
  EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
  EXPO_PUBLIC_WEB_URL=https://plate-link-sigma.vercel.app
  ```

During build execution, `scripts/build-apk.ps1` automatically loads `.env.production` so production URLs are compiled into the binary, and restores your development `.env` (`http://127.0.0.1:3000`) once complete.

---

## 4. Run the Local Build Script

Open PowerShell and execute the build script from `apps/mobile`:

```powershell
cd apps/mobile
.\scripts\build-apk.ps1
```

### What the Script Automates:
1. Configures `ANDROID_HOME` and Gradle IPv4 network preferences.
2. Applies `.env.production` while backing up your development `.env`.
3. Runs `npx expo prebuild --platform android --clean` to ensure fresh native code with the `withReleaseSigning` plugin applied.
4. Regenerates `android/local.properties` with your SDK and CMake paths.
5. Invokes `gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a` to build a lean, optimized ARM64 binary.
6. Copies the final APK to `apps/mobile/dist/plate-link-1.0.0.apk` and outputs the file size.

---

## 5. Install the APK on Your Android Device

### Option A: Via ADB (USB Debugging Enabled)
Connect your Android phone via USB and run:
```powershell
adb install -r dist\plate-link-1.0.0.apk
```

### Option B: Direct File Transfer
Transfer `dist\plate-link-1.0.0.apk` to your phone via Google Drive, WhatsApp, or USB storage:
1. Tap the `.apk` file on your phone.
2. If prompted, toggle **"Allow from this source"** in Android Settings (*Install unknown apps*).
3. Tap **Install** and launch **Plate-Link**.

---

## 6. One-Command Google Drive APK Upload (via rclone)

To share the latest APK or install directly onto your Android device without connecting a USB cable, Plate-Link provides a one-command upload script using [rclone](https://rclone.org/).

### Initial Setup (One-Time)

1. **Install rclone on Windows**:
   ```powershell
   winget install Rclone.Rclone
   ```
   *(Restart your terminal if `rclone` is not recognized immediately)*.

2. **Configure your Google Drive remote**:
   Run the interactive configuration wizard:
   ```powershell
   rclone config
   ```
   Follow the prompts:
   - `n` — New remote
   - Name: `gdrive`
   - Storage type: `drive` (Google Drive)
   - `client_id` / `client_secret`: leave blank (press Enter)
   - Scope: `drive.file` (or pick the option for *access to files created by rclone only*)
   - `root_folder_id` / `service_account_file`: leave blank (press Enter)
   - Edit advanced config: `n`
   - Use auto config: `y` *(launches your default browser to sign in to Google and authorize)*
   - Configure as Team Drive: `n`
   - Confirm and save: `y`, then `q` to quit

> [!NOTE]
> All credentials and OAuth refresh tokens are stored securely in `%APPDATA%\rclone\rclone.conf` on your machine. No tokens or configs touch the git repository.

### Uploading the Latest APK

From `apps/mobile`, run:

```powershell
cd apps/mobile
.\scripts\upload-apk.ps1
```

### What `upload-apk.ps1` Does:
1. Automatically picks up the newest APK in `apps/mobile/dist/plate-link-*.apk`.
2. Overwrites `gdrive:PlateLink/Plate-Link-latest.apk` so the remote file always has a fixed, stable destination.
3. Sets public link-sharing via `rclone link` and prints the Google Drive share URL.
4. Generates and displays the direct download link:
   `https://drive.google.com/uc?export=download&id=<FILE_ID>`
   *(Opens directly in mobile Chrome/browsers to download and install the APK immediately)*.

