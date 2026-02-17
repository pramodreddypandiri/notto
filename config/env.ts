import Constants from 'expo-constants';

// Get environment variables from Expo Constants (for EAS builds)
// Falls back to empty strings - set values via EAS Secrets for production builds
// For local development, create a .env.local file or set environment variables
const extra = Constants.expoConfig?.extra || {};

export const ENV = {
  // Get from: https://platform.deepseek.com
  // Set via: eas secret:create --name DEEPSEEK_API_KEY --value "your-key"
  DEEPSEEK_API_KEY: extra.DEEPSEEK_API_KEY || process.env.EXPO_PUBLIC_DEEPSEEK_API_KEY || '',

  // Get from: https://platform.openai.com
  // Set via: eas secret:create --name OPENAI_API_KEY --value "your-key"
  OPENAI_API_KEY: extra.OPENAI_API_KEY || process.env.EXPO_PUBLIC_OPENAI_API_KEY || '',

  // Optional: Get from: https://console.cloud.google.com
  // Set via: eas secret:create --name GOOGLE_PLACES_API_KEY --value "your-key"
  GOOGLE_PLACES_API_KEY: extra.GOOGLE_PLACES_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '',
};
