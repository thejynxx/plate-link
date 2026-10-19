import { ExpoConfig, ConfigContext } from "expo/config"

export default ({ config }: ConfigContext): ExpoConfig & { newArchEnabled?: boolean } => ({
  ...config,
  name: "Plate-Link",
  slug: "plate-link",
  scheme: "platelink",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.platelink.app",
  },
  android: {
    package: "com.platelink.app",
    versionCode: 1,
    adaptiveIcon: {
      backgroundColor: "#32373B",
      foregroundImage: "./assets/adaptive-icon.png",
    },
    predictiveBackGestureEnabled: false,
    permissions: [
      "ACCESS_FINE_LOCATION",
      "ACCESS_COARSE_LOCATION",
      "ACCESS_BACKGROUND_LOCATION",
      "FOREGROUND_SERVICE",
      "FOREGROUND_SERVICE_LOCATION",
      "POST_NOTIFICATIONS",
      "CAMERA",
    ],
  },
  web: {
    bundler: "metro",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "./plugins/withReleaseSigning",
    "expo-router",
    "expo-font",
    "expo-secure-store",
    "@maplibre/maplibre-react-native",
    [
      "expo-image-picker",
      {
        cameraPermission:
          "Plate-Link uses the camera for optional pickup and delivery proof photos.",
      },
    ],
    [
      "expo-location",
      {
        locationWhenInUsePermission: "Plate-Link uses your location to show nearby pickups.",
        locationAlwaysAndWhenInUsePermission:
          "Plate-Link shares your location with the canteen and NGO only while you have an active delivery.",
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
      },
    ],
    [
      "expo-splash-screen",
      {
        backgroundColor: "#32373B",
        image: "./assets/splash.png",
        imageWidth: 120,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
})
