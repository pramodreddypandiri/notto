export default {
  expo: {
    name: "Nottos",
    slug: "notes",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "notes",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.notesapp.voicenotes",
      infoPlist: {
        NSSpeechRecognitionUsageDescription: "This app uses speech recognition to convert your voice notes to text.",
        NSMicrophoneUsageDescription: "This app needs microphone access to record voice notes.",
        NSLocationWhenInUseUsageDescription: "This app uses your location to provide location-based reminders when you arrive at or leave saved places.",
        NSLocationAlwaysAndWhenInUseUsageDescription: "This app uses your location in the background to remind you of tasks when you arrive at or leave saved places like home, work, or stores.",
        NSPhotoLibraryUsageDescription: "This app may access your photo library to attach images to your notes.",
        UIBackgroundModes: ["location"],
        ITSAppUsesNonExemptEncryption: false
      }
    },
    android: {
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/images/android-icon-foreground.png",
        backgroundImage: "./assets/images/android-icon-background.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png"
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: "com.notesapp.voicenotes",
      permissions: [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "android.permission.RECORD_AUDIO",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_BACKGROUND_LOCATION",
        "android.permission.FOREGROUND_SERVICE",
        "android.permission.FOREGROUND_SERVICE_LOCATION"
      ]
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
          dark: {
            backgroundColor: "#000000"
          }
        }
      ],
      "expo-speech-recognition",
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "This app uses your location to remind you of tasks when you arrive at or leave saved places.",
          isAndroidBackgroundLocationEnabled: true,
          isIosBackgroundLocationEnabled: true
        }
      ],
      "@react-native-community/datetimepicker"
    ],
    experiments: {
      typedRoutes: true
    },
    extra: {
      router: {},
      // Environment variables from EAS Secrets
      DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || '',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
      GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY || '',
      eas: {
        projectId: "d676cf2a-5bc7-4bf8-b616-7ccb12f07aa4"
      }
    }
  }
};
